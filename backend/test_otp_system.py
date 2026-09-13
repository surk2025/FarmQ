import asyncio
import re
import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import connect_to_mongo, get_database, close_mongo_connection
from backend.app.services.otp_service import hash_otp, verify_otp_hash

async def run_tests():
    print("==================================================")
    print("🧪 FARMQ SECURE OTP AUTHENTICATION TEST SUITE")
    print("==================================================")
    
    await connect_to_mongo()
    db = get_database()
    
    test_phone = "+919812000025" # Surjeet Kumar
    raw_phone = "9812000025"
    unregistered_phone = "9988776655"
    
    # Ensure test user exists
    user = await db.users.find_one({"$or": [{"phone": test_phone}, {"phone": raw_phone}]})
    assert user is not None, f"User with phone {test_phone} must exist"
    print(f"✓ Found test user: {user['name']} ({user['phone']}) - Role: {user['role']}")

    # Clear prior test OTPs for this phone
    await db.otp_verifications.delete_many({"$or": [{"phone": test_phone}, {"phone": raw_phone}]})
    await db.otp_verifications.delete_many({"phone": unregistered_phone})
    
    with TestClient(app) as client:
        # TEST 1: Invalid phone format (letters, short numbers, invalid start digit)
        print("\n--- TEST 1: Phone Validation ---")
        for bad_phone in ["123", "98120abcde", "1234567890", "+9112345"]:
            res = client.post("/api/auth/send-otp", json={"phone": bad_phone})
            assert res.status_code == 422, f"Expected 422 for invalid phone '{bad_phone}', got {res.status_code}"
        print("✓ Test 1 Passed: Invalid phone formats correctly rejected with 422")

        # TEST 2: Unregistered phone number
        print("\n--- TEST 2: Unregistered Mobile Number ---")
        res = client.post("/api/auth/send-otp", json={"phone": unregistered_phone})
        assert res.status_code == 404, f"Expected 404 for unregistered phone, got {res.status_code}"
        assert "not registered" in res.json().get("detail", "").lower()
        print(f"✓ Test 2 Passed: Unregistered phone correctly returned 404: {res.json()['detail']}")

        # TEST 3: Send OTP to valid registered phone
        print("\n--- TEST 3: Send OTP to Registered Number ---")
        res = client.post("/api/auth/send-otp", json={"phone": test_phone})
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["success"] is True
        assert "otp" not in data, "CRITICAL: OTP must NEVER be exposed in response body!"
        print(f"✓ Test 3 Passed: OTP dispatched successfully: {data['message']}")

        # TEST 4: Database Storage & Hashing Verification
        print("\n--- TEST 4: Database Security & SHA-256 Hashing ---")
        otp_record = await db.otp_verifications.find_one({"phone": test_phone, "used": False})
        assert otp_record is not None, "OTP record should be saved in db.otp_verifications"
        assert "otp" not in otp_record, "CRITICAL: Plaintext OTP must never be stored in database!"
        assert "otpHash" in otp_record, "Salted SHA-256 otpHash must be present"
        assert len(otp_record["otpHash"]) == 64, "SHA-256 hex string must be 64 characters long"
        assert otp_record["attempts"] == 0, "Initial attempts must be 0"
        print(f"✓ Test 4 Passed: OTP stored securely with SHA-256 hash: {otp_record['otpHash'][:16]}...")

        # TEST 5: Rate Limiting (30-second cooldown)
        print("\n--- TEST 5: Rate Limiting & Cooldown ---")
        res_cooldown = client.post("/api/auth/send-otp", json={"phone": test_phone})
        assert res_cooldown.status_code == 429, f"Expected 429 for cooldown violation, got {res_cooldown.status_code}"
        assert "wait" in res_cooldown.json().get("detail", "").lower()
        print(f"✓ Test 5 Passed: 30s resend cooldown enforced with 429: {res_cooldown.json()['detail']}")

        # TEST 6: Invalid OTP Code Verification
        print("\n--- TEST 6: Invalid OTP Verification ---")
        res_invalid = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": "000000"})
        assert res_invalid.status_code == 400, f"Expected 400 for wrong OTP, got {res_invalid.status_code}"
        assert "attempt" in res_invalid.json().get("detail", "").lower()
        
        # Check attempts counter in DB
        otp_after_fail = await db.otp_verifications.find_one({"_id": otp_record["_id"]})
        assert otp_after_fail["attempts"] == 1, f"Attempts should be incremented to 1, got {otp_after_fail['attempts']}"
        print(f"✓ Test 6 Passed: Wrong OTP returned 400 with remaining attempts counter: {res_invalid.json()['detail']}")

        # TEST 7: Lockout after 5 failed attempts
        print("\n--- TEST 7: Maximum Attempts Lockout (5 attempts) ---")
        for i in range(2, 6):
            res_fail = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": f"{i:06d}"})
            if i < 5:
                assert res_fail.status_code == 400
            else:
                assert res_fail.status_code == 429, f"Expected 429 on 5th failure, got {res_fail.status_code}"
                assert "maximum attempts" in res_fail.json().get("detail", "").lower()
        
        otp_locked = await db.otp_verifications.find_one({"_id": otp_record["_id"]})
        assert otp_locked["used"] is True, "Locked OTP must be marked used=True"
        assert otp_locked["attempts"] >= 5, "Attempts should be at least 5"
        print(f"✓ Test 7 Passed: Account locked after 5 failed attempts with 429: {res_fail.json()['detail']}")

        # TEST 8: Expired OTP handling
        print("\n--- TEST 8: Expired OTP Rejection ---")
        # Generate an expired OTP record directly
        expired_hash = hash_otp(test_phone, "888888")
        await db.otp_verifications.insert_one({
            "phone": test_phone,
            "otpHash": expired_hash,
            "expiresAt": datetime.utcnow() - timedelta(minutes=1),
            "attempts": 0,
            "maxAttempts": 5,
            "used": False,
            "createdAt": datetime.utcnow() - timedelta(minutes=6)
        })
        res_expired = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": "888888"})
        assert res_expired.status_code == 400, f"Expected 400 for expired OTP, got {res_expired.status_code}"
        assert "expired" in res_expired.json().get("detail", "").lower()
        print(f"✓ Test 8 Passed: Expired OTP rejected with 400: {res_expired.json()['detail']}")

        # TEST 9: Successful OTP Verification and JWT Issuance
        print("\n--- TEST 9: Successful OTP Verification & JWT Issuance ---")
        # Invalidate prior OTPs and insert a fresh known OTP record
        await db.otp_verifications.delete_many({"phone": test_phone})
        valid_otp = "753190"
        valid_hash = hash_otp(test_phone, valid_otp)
        await db.otp_verifications.insert_one({
            "phone": test_phone,
            "otpHash": valid_hash,
            "expiresAt": datetime.utcnow() + timedelta(minutes=5),
            "attempts": 0,
            "maxAttempts": 5,
            "used": False,
            "createdAt": datetime.utcnow()
        })
        
        res_success = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": valid_otp})
        assert res_success.status_code == 200, f"Expected 200, got {res_success.status_code}: {res_success.text}"
        auth_data = res_success.json()
        assert "access_token" in auth_data, "access_token must be returned"
        assert auth_data["user"]["phone"] == test_phone
        assert auth_data["user"]["name"] == user["name"]
        print(f"✓ Test 9 Passed: Valid OTP issued JWT: {auth_data['access_token'][:20]}... for {auth_data['user']['name']}")

        # TEST 10: Single-Use Guarantee (Cannot reuse verified OTP)
        print("\n--- TEST 10: Single-Use Security Guarantee ---")
        res_reuse = client.post("/api/auth/verify-otp", json={"phone": test_phone, "otp": valid_otp})
        assert res_reuse.status_code == 400, f"Expected 400 on replay, got {res_reuse.status_code}"
        print(f"✓ Test 10 Passed: Replay of used OTP blocked with 400: {res_reuse.json()['detail']}")

        # TEST 11: Authenticated Session with JWT (/api/auth/me)
        print("\n--- TEST 11: Authenticated Session Validation ---")
        token = auth_data["access_token"]
        res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200, f"Expected 200, got {res_me.status_code}"
        assert res_me.json()["phone"] == test_phone
        print(f"✓ Test 11 Passed: /api/auth/me verified user profile for {res_me.json()['name']}")

    await close_mongo_connection()
    print("\n==================================================")
    print("🎉 ALL 11 OTP AUTHENTICATION TESTS PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
