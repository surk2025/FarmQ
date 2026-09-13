import asyncio
import sys
import os
import re
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import connect_to_mongo, get_database, close_mongo_connection
from backend.app.services.otp_service import (
    normalize_phone_number, hash_otp, verify_otp_hash,
    migrate_existing_user_phones
)

async def run_comprehensive_tests():
    print("=" * 70)
    print("🚀 FARMQ AUTHENTICATION & PHONE NORMALIZATION VERIFICATION SUITE")
    print("=" * 70)

    await connect_to_mongo()
    db = get_database()

    # Step 0: Ensure all existing users are migrated
    await migrate_existing_user_phones(db)

    with TestClient(app) as client:
        # =====================================================================
        # SCENARIO 1: REGISTER -> LOGOUT -> LOGIN WITH 9670253833
        # =====================================================================
        print("\n--- SCENARIO 1: Exact User Scenario: Register & Login with 9670253833 ---")
        test_phone_raw = "9670253833"
        canonical_expected = "+919670253833"

        # Check if 9670253833 exists; clean it up for fresh registration test
        await db.users.delete_many({
            "$or": [
                {"phone": canonical_expected},
                {"phone": test_phone_raw},
                {"name": "Test Farmer"}
            ]
        })
        await db.otp_verifications.delete_many({
            "$or": [
                {"phone": canonical_expected},
                {"phone": test_phone_raw}
            ]
        })

        # 1. Register with raw 10-digit number
        reg_payload = {
            "name": "Test Farmer",
            "phone": test_phone_raw,
            "password": "FarmerPassword123",
            "village": "Taraori",
            "district": "Karnal",
            "state": "Haryana",
            "preferredLanguage": "hi"
        }
        res_reg = client.post("/api/auth/register", json=reg_payload)
        assert res_reg.status_code == 200, f"Registration failed: {res_reg.text}"
        reg_data = res_reg.json()
        assert reg_data["user"]["phone"] == canonical_expected, (
            f"Registration must save canonical phone {canonical_expected}, got {reg_data['user']['phone']}"
        )
        test_user_id = reg_data["user"]["id"]
        print(f"✓ Registered 'Test Farmer' with raw: '{test_phone_raw}' -> Saved in DB as: '{canonical_expected}'")

        # Verify in DB directly
        db_user = await db.users.find_one({"phone": canonical_expected})
        assert db_user is not None, "User record must exist in DB under canonical phone"
        assert db_user["phone"] == canonical_expected
        assert str(db_user["_id"]) == test_user_id
        print(f"✓ Database verified: Document ID {test_user_id} has phone = '{canonical_expected}'")

        # 2. Simulate Logout (token discarded)
        print("✓ Simulated Logout: session token discarded")

        # 3. Login using 9670253833: Send OTP
        res_otp1 = client.post("/api/auth/send-otp", json={"phone": test_phone_raw})
        assert res_otp1.status_code == 200, f"Send OTP failed: {res_otp1.text}"
        otp1_data = res_otp1.json()
        assert otp1_data["success"] is True
        assert "not registered" not in otp1_data.get("message", "").lower()
        print(f"✓ SUCCESS: 9670253833 recognized as registered user! Response: {otp1_data['message']}")

        # Verify OTP record is linked to userId
        otp_rec = await db.otp_verifications.find_one({"phone": canonical_expected, "used": False})
        assert otp_rec is not None, "OTP record must exist in db.otp_verifications"
        assert otp_rec.get("userId") == test_user_id, f"OTP record must link to userId {test_user_id}"
        print(f"✓ OTP record linked to userId: {otp_rec['userId']} (phone: {otp_rec['phone']})")

        # =====================================================================
        # SCENARIO 2: TEST ALL PHONE FORMAT VARIATIONS IDENTIFY SAME USER
        # =====================================================================
        print("\n--- SCENARIO 2: Test Phone Format Variations (Same Account) ---")
        variations = [
            "9670253833",
            "+919670253833",
            "+91 9670253833",
            "IN +91 9670253833",
            "09670253833",
            "+91-9670-253833"
        ]
        for variant in variations:
            # Clear previous OTPs to avoid cooldown during test
            await db.otp_verifications.delete_many({"phone": canonical_expected})
            res_var = client.post("/api/auth/send-otp", json={"phone": variant})
            assert res_var.status_code == 200, f"Variant '{variant}' failed: {res_var.text}"
            var_data = res_var.json()
            assert var_data["success"] is True
            assert var_data["phone"] == canonical_expected

            # Test OTP verification for this variant
            # Set known OTP
            known_otp = "654321"
            await db.otp_verifications.update_one(
                {"phone": canonical_expected, "used": False},
                {"$set": {"otpHash": hash_otp(canonical_expected, known_otp)}}
            )
            res_ver = client.post("/api/auth/verify-otp", json={"phone": variant, "otp": known_otp})
            assert res_ver.status_code == 200, f"Verify for variant '{variant}' failed: {res_ver.text}"
            ver_data = res_ver.json()
            assert ver_data["user"]["id"] == test_user_id, "Must authenticate the exact same user ID"
            assert ver_data["user"]["name"] == "Test Farmer"
            print(f"✓ Variation: '{variant:<20}' -> Successfully authenticated {ver_data['user']['name']} (ID: {test_user_id})")

        # =====================================================================
        # SCENARIO 3: TEST AT LEAST 5 EXISTING FARMER ACCOUNTS
        # =====================================================================
        print("\n--- SCENARIO 3: Test 5+ Existing Farmer Accounts ---")
        existing_farmers = [
            ("Ramesh Chandra", "9812000001", "+919812000001"),
            ("Suresh Verma", "9812000002", "+919812000002"),
            ("Baldev Singh", "9812000003", "+919812000003"),
            ("Harpreet Kaur", "9812000004", "+919812000004"),
            ("Kuldeep Yadav", "9812000005", "+919812000005"),
            ("Surjeet Kumar", "9812000025", "+919812000025")
        ]

        for name, raw_phone, canon_phone in existing_farmers:
            # Clear previous OTPs for this phone
            await db.otp_verifications.delete_many({"$or": [{"phone": canon_phone}, {"phone": raw_phone}]})
            
            # 1. Login via raw phone
            res_send = client.post("/api/auth/send-otp", json={"phone": raw_phone})
            assert res_send.status_code == 200, f"Failed sending OTP for {name} ({raw_phone}): {res_send.text}"
            
            # 2. Inject known OTP
            test_otp = "123456"
            await db.otp_verifications.update_one(
                {"phone": canon_phone, "used": False},
                {"$set": {"otpHash": hash_otp(canon_phone, test_otp)}}
            )

            # 3. Verify OTP
            res_ver = client.post("/api/auth/verify-otp", json={"phone": raw_phone, "otp": test_otp})
            assert res_ver.status_code == 200, f"Failed verify for {name}: {res_ver.text}"
            auth_info = res_ver.json()
            assert auth_info["user"]["name"] == name
            assert auth_info["user"]["role"] == "farmer"

            # 4. Check protected profile (/api/auth/me)
            res_profile = client.get("/api/auth/me", headers={"Authorization": f"Bearer {auth_info['access_token']}"})
            assert res_profile.status_code == 200
            assert res_profile.json()["name"] == name
            print(f"✓ Existing Account: {name:<18} ({raw_phone}) -> OTP Login Verified & /me returned Profile")

        # =====================================================================
        # SCENARIO 4: TEST GENUINELY UNREGISTERED NUMBER
        # =====================================================================
        print("\n--- SCENARIO 4: Genuinely Unregistered Number Check ---")
        unreg_phone = "7890123456"
        res_unreg = client.post("/api/auth/send-otp", json={"phone": unreg_phone})
        assert res_unreg.status_code == 404, f"Expected 404 for unreg, got {res_unreg.status_code}"
        assert "not registered" in res_unreg.json()["detail"].lower()
        print(f"✓ Correctly returned 404 for unregistered number {unreg_phone}: '{res_unreg.json()['detail']}'")

        # =====================================================================
        # SCENARIO 5: TEST DIFFERENT ROLES (FARMER, ADMIN, SUPERADMIN)
        # =====================================================================
        print("\n--- SCENARIO 5: Multi-Role Preservation & Detection ---")
        roles_to_test = [
            ("Farmer", "9812000025", "+919812000025", "farmer", "Surjeet Kumar"),
            ("Mandi Admin", "9876543210", "+919876543210", "admin", "Vikram Singh (Mandi Officer)"),
            ("Director/Superadmin", "9998887770", "+919998887770", "superadmin", "Dr. Rajesh Sharma (Director)")
        ]

        for role_label, raw_p, canon_p, expected_role, expected_name in roles_to_test:
            await db.otp_verifications.delete_many({"$or": [{"phone": canon_p}, {"phone": raw_p}]})
            res_send = client.post("/api/auth/send-otp", json={"phone": raw_p})
            assert res_send.status_code == 200, f"Send OTP failed for {role_label}: {res_send.text}"

            role_otp = "987654"
            await db.otp_verifications.update_one(
                {"phone": canon_p, "used": False},
                {"$set": {"otpHash": hash_otp(canon_p, role_otp)}}
            )

            res_ver = client.post("/api/auth/verify-otp", json={"phone": raw_p, "otp": role_otp})
            assert res_ver.status_code == 200, f"Verify failed for {role_label}: {res_ver.text}"
            role_data = res_ver.json()
            assert role_data["user"]["role"] == expected_role, (
                f"Role mismatch for {role_label}: expected {expected_role}, got {role_data['user']['role']}"
            )
            assert expected_name in role_data["user"]["name"]
            print(f"✓ Role Verified: {role_label:<20} -> Authenticated with Role: '{role_data['user']['role']}' ({role_data['user']['name']})")

    await close_mongo_connection()
    print("\n" + "=" * 70)
    print("🎉 ALL 5 SCENARIOS AND VERIFICATION SUITES PASSED 100%!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_comprehensive_tests())
