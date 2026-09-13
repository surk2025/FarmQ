import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import connect_to_mongo, get_database, close_mongo_connection
from backend.app.services.otp_service import init_otp_indexes, hash_otp

async def run_multi_auth_tests():
    print("==================================================")
    print("🌾 STARTING FARMQ MULTI-AUTH COMPREHENSIVE TEST SUITE")
    print("==================================================")
    
    await connect_to_mongo()
    db = get_database()
    await init_otp_indexes(db)
    
    test_phone = "9998887776"
    canonical_test_phone = f"+91{test_phone}"
    test_email = "arjun.patel@testfarm.in"

    # Reset any previous test artifacts for clean test run
    await db.users.delete_many({
        "$or": [
            {"phone": canonical_test_phone},
            {"phone": test_phone},
            {"email": test_email}
        ]
    })
    await db.otp_verifications.delete_many({
        "$or": [
            {"phone": canonical_test_phone},
            {"phone": test_phone}
        ]
    })
    await db.password_resets.delete_many({"email": test_email})

    with TestClient(app) as client:
        # -------------------------------------------------------------
        # TEST 1: Register as New Farmer (Strict role: farmer)
        # -------------------------------------------------------------
        print("\n[TEST 1] Register as New Farmer (Role Escalation Protection)...")
        reg_payload = {
            "name": "Arjun Patel",
            "phone": test_phone, # Raw 10 digits
            "email": test_email,
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "role": "admin" # Attacker attempts privilege escalation!
        }
        res = client.post("/api/auth/register", json=reg_payload)
        assert res.status_code in (200, 201), f"Register failed: {res.status_code} {res.text}"
        data = res.json()
        user = data.get("user", {})
        assert user.get("role") == "farmer", f"SECURITY FAILED: Role escalation not prevented! Got {user.get('role')}"
        assert user.get("phone") == canonical_test_phone, f"Phone not canonicalized! Got {user.get('phone')}"
        assert "password" in user.get("authProviders", []), "Provider 'password' not in authProviders"
        print(f"  ✓ PASS: Farmer registered successfully with enforced role 'farmer' and canonical phone {canonical_test_phone}")

        # -------------------------------------------------------------
        # TEST 2: Duplicate Email & Duplicate Phone Rejection
        # -------------------------------------------------------------
        print("\n[TEST 2] Duplicate Email / Phone Rejection...")
        dup_res_phone = client.post("/api/auth/register", json={
            "name": "Another Person",
            "phone": test_phone,
            "email": "different.email@testfarm.in",
            "password": "Password123!",
            "confirmPassword": "Password123!"
        })
        assert dup_res_phone.status_code == 400, f"Expected 400 for duplicate phone, got {dup_res_phone.status_code}"
        assert "already registered" in dup_res_phone.json().get("detail", "").lower()
        print(f"  ✓ PASS: Duplicate phone correctly rejected: {dup_res_phone.json().get('detail')}")

        dup_res_email = client.post("/api/auth/register", json={
            "name": "Another Person",
            "phone": "9991112233",
            "email": test_email,
            "password": "Password123!",
            "confirmPassword": "Password123!"
        })
        assert dup_res_email.status_code == 400, f"Expected 400 for duplicate email, got {dup_res_email.status_code}"
        assert "already registered" in dup_res_email.json().get("detail", "").lower()
        print(f"  ✓ PASS: Duplicate email correctly rejected: {dup_res_email.json().get('detail')}")

        # -------------------------------------------------------------
        # TEST 3: Email + Password Login
        # -------------------------------------------------------------
        print("\n[TEST 3] Email + Password Login...")
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "Password123!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
        login_data = login_res.json()
        assert login_data.get("access_token") is not None, "Missing access_token"
        assert login_data["user"]["email"] == test_email
        print(f"  ✓ PASS: Logged in via Email+Password. Token issued.")

        # Also test logging in using Mobile number as identifier in login form
        phone_login_res = client.post("/api/auth/login", json={
            "identifier": test_phone,
            "password": "Password123!"
        })
        assert phone_login_res.status_code == 200, f"Phone login failed: {phone_login_res.status_code}"
        print(f"  ✓ PASS: Logged in via Mobile+Password using raw 10 digits as identifier.")

        # -------------------------------------------------------------
        # TEST 4: Mobile OTP Login for Existing User
        # -------------------------------------------------------------
        print(f"\n[TEST 4] Mobile + OTP Login for Existing User ({canonical_test_phone})...")
        send_otp_res = client.post("/api/auth/send-otp", json={"phone": canonical_test_phone})
        assert send_otp_res.status_code == 200, f"Send OTP failed: {send_otp_res.status_code} {send_otp_res.text}"
        
        # Verify OTP record in DB and retrieve code for testing
        otp_rec = await db.otp_verifications.find_one({"phone": canonical_test_phone, "used": False})
        assert otp_rec is not None, "OTP record must exist in db"
        
        # Generate test OTP and update record hash so we can verify deterministic code
        test_otp = "849201"
        test_hash = hash_otp(canonical_test_phone, test_otp)
        await db.otp_verifications.update_one({"_id": otp_rec["_id"]}, {"$set": {"otpHash": test_hash}})

        verify_res = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": test_otp})
        assert verify_res.status_code == 200, f"Verify OTP failed: {verify_res.status_code} {verify_res.text}"
        otp_user = verify_res.json()["user"]
        assert otp_user["phone"] == canonical_test_phone
        print(f"  ✓ PASS: Mobile OTP verified and authenticated successfully.")

        # -------------------------------------------------------------
        # TEST 5: Google OAuth & Safe Account Linking (ONE USER ACCOUNT)
        # -------------------------------------------------------------
        print("\n[TEST 5] Google OAuth & Safe Account Linking (Single User Guarantee)...")
        google_payload = {
            "isDevMock": True,
            "mockEmail": test_email, # Matches existing user's email!
            "mockName": "Arjun Patel (Google Verified)",
            "mockGoogleId": "goog-sub-123456789"
        }
        google_res = client.post("/api/auth/google", json=google_payload)
        assert google_res.status_code == 200, f"Google auth failed: {google_res.status_code} {google_res.text}"
        g_data = google_res.json()
        g_user = g_data["user"]
        
        # Ensure it LINKED to the SAME user document rather than creating a duplicate
        assert g_user["email"] == test_email
        assert g_user.get("googleId") == "goog-sub-123456789"
        assert "google" in g_user.get("authProviders", []), "Provider 'google' not appended to authProviders"
        
        # Verify count of users with this email is exactly 1
        user_count = await db.users.count_documents({"email": test_email})
        assert user_count == 1, f"Expected exactly 1 user account for {test_email}, found {user_count}!"
        print(f"  ✓ PASS: Google login safely linked to existing user! Total accounts for email: {user_count}")

        # -------------------------------------------------------------
        # TEST 6: Forgot Password & Single-Use Reset Token Flow
        # -------------------------------------------------------------
        print("\n[TEST 6] Forgot Password & Single-Use Reset Token Flow...")
        forgot_res = client.post("/api/auth/forgot-password", json={"email": test_email})
        assert forgot_res.status_code == 200, f"Forgot password failed: {forgot_res.status_code}"
        reset_token = forgot_res.json().get("resetToken") or forgot_res.json().get("dev_token")
        assert reset_token is not None, "Reset token not generated"
        print(f"  ✓ Reset token generated: {reset_token[:12]}...")

        # Reset password with token
        new_pwd = "BrandNewPassword789!"
        reset_res = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "newPassword": new_pwd,
            "confirmPassword": new_pwd
        })
        assert reset_res.status_code == 200, f"Reset password failed: {reset_res.status_code} {reset_res.text}"
        print("  ✓ PASS: Password reset confirmed.")

        # Verify old password is now rejected
        old_login = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "Password123!"
        })
        assert old_login.status_code == 401, f"Old password should be rejected, got {old_login.status_code}"
        print("  ✓ PASS: Old password rejected with 401.")

        # Verify new password works
        new_login = client.post("/api/auth/login", json={
            "email": test_email,
            "password": new_pwd
        })
        assert new_login.status_code == 200, f"New password login failed: {new_login.status_code}"
        print("  ✓ PASS: New password accepted with 200.")

        # Verify reset token cannot be reused (Single-Use Enforced)
        reuse_res = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "newPassword": "AnotherPassword!",
            "confirmPassword": "AnotherPassword!"
        })
        assert reuse_res.status_code == 400, f"Expected 400 for reused token, got {reuse_res.status_code}"
        print("  ✓ PASS: Reused reset token rejected (Single-use security enforced).")

        # -------------------------------------------------------------
        # TEST 7: Phone Format Variations (All Identify Same User)
        # -------------------------------------------------------------
        print("\n[TEST 7] Phone Format Variations (Canonical Normalization)...")
        variations = [
            "9670253833",
            "+91 9670253833",
            "+919670253833",
            "09670253833",
            "919670253833"
        ]
        
        # Ensure user with 9670253833 exists
        p_canon = "+919670253833"
        user_p = await db.users.find_one({"phone": p_canon})
        if not user_p:
            await db.users.insert_one({
                "name": "Surjeet Kushwaha",
                "phone": p_canon,
                "role": "farmer",
                "authProviders": ["phone"],
                "createdAt": datetime.utcnow()
            })
            print("  Created user for phone format test: Surjeet Kushwaha (+919670253833)")

        for var_phone in variations:
            # Clear cooldown for test phone
            await db.otp_verifications.delete_many({"$or": [{"phone": p_canon}, {"phone": "9670253833"}]})
            var_res = client.post("/api/auth/send-otp", json={"phone": var_phone})
            assert var_res.status_code == 200, f"Failed for phone format '{var_phone}': {var_res.text}"
            print(f"  ✓ PASS: Format '{var_phone}' successfully recognized and dispatched OTP.")

        # -------------------------------------------------------------
        # TEST 8: Demo Accounts Verification
        # -------------------------------------------------------------
        print("\n[TEST 8] Checking 1-Click Demo Accounts...")
        # Farmer: Surjeet Kumar
        farmer_check = await db.users.find_one({"email": "farmer@farmq.demo"})
        assert farmer_check is not None, "Demo farmer must exist"
        assert farmer_check.get("role") == "farmer"
        print(f"  ✓ PASS: Demo Farmer preserved: {farmer_check['name']} ({farmer_check.get('phone')})")

        # Admin: Vikram Singh
        admin_check = await db.users.find_one({"email": "admin@farmq.demo"})
        assert admin_check is not None, "Demo admin must exist"
        assert admin_check.get("role") == "admin"
        print(f"  ✓ PASS: Demo Mandi Admin preserved: {admin_check['name']} ({admin_check.get('phone')})")

        # Director / Super Admin: Dr. Rajesh Sharma
        super_check = await db.users.find_one({"email": "superadmin@farmq.demo"})
        assert super_check is not None, "Demo director must exist"
        assert super_check.get("role") == "superadmin"
        print(f"  ✓ PASS: Demo Director preserved: {super_check['name']} ({super_check.get('phone')})")

    await close_mongo_connection()
    print("\n==================================================")
    print("🏆 ALL 8 MULTI-AUTH TESTS COMPLETED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(run_multi_auth_tests())
