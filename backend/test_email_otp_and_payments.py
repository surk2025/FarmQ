import asyncio
import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import connect_to_mongo, get_database, close_mongo_connection

async def run_tests():
    print("==================================================")
    print("🧪 FARMQ EMAIL OTP & PAYMENT RECEIVE TEST SUITE")
    print("==================================================")

    await connect_to_mongo()
    db = get_database()

    test_email = "testfarmer_otp@farmq.demo"
    existing_farmer_email = "farmer@farmq.demo"

    # Clear prior test records
    await db.otp_verifications.delete_many({"email": {"$in": [test_email, existing_farmer_email]}})
    await db.users.delete_many({"email": test_email})

    with TestClient(app) as client:
        # TEST 1: Send OTP to existing farmer
        print("\n--- TEST 1: Send Email OTP to Existing Farmer ---")
        res1 = client.post("/api/auth/send-email-otp", json={"email": existing_farmer_email})
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
        data1 = res1.json()
        assert data1["success"] is True
        assert data1["email"] == existing_farmer_email
        assert "demo_otp" in data1 and len(data1["demo_otp"]) == 6
        otp_val = data1["demo_otp"]
        print(f"✓ Test 1 Passed: OTP generated and sent for {existing_farmer_email} (Demo OTP: {otp_val})")

        # TEST 2: Rate limit cooldown on immediate resend
        print("\n--- TEST 2: Rate Limit 30s Cooldown ---")
        res2 = client.post("/api/auth/send-email-otp", json={"email": existing_farmer_email})
        assert res2.status_code == 429, f"Expected 429 rate limit, got {res2.status_code}"
        assert "wait" in res2.json()["detail"].lower()
        print(f"✓ Test 2 Passed: Cooldown rate limit enforced: {res2.json()['detail']}")

        # TEST 3: Verify with wrong OTP code
        print("\n--- TEST 3: Verify With Invalid OTP Code ---")
        res3 = client.post("/api/auth/verify-email-otp", json={"email": existing_farmer_email, "otp": "000000"})
        assert res3.status_code == 400, f"Expected 400, got {res3.status_code}"
        assert "invalid otp" in res3.json()["detail"].lower()
        print(f"✓ Test 3 Passed: Invalid OTP correctly rejected: {res3.json()['detail']}")

        # TEST 4: Verify with correct OTP code & authenticate existing farmer
        print("\n--- TEST 4: Verify Correct OTP & Login Farmer ---")
        res4 = client.post("/api/auth/verify-email-otp", json={"email": existing_farmer_email, "otp": otp_val})
        assert res4.status_code == 200, f"Expected 200, got {res4.status_code}: {res4.text}"
        auth_data = res4.json()
        assert "access_token" in auth_data
        farmer_token = auth_data["access_token"]
        assert auth_data["user"]["email"] == existing_farmer_email
        assert auth_data["user"]["role"] == "farmer"
        print(f"✓ Test 4 Passed: Authenticated farmer '{auth_data['user']['name']}' (Role: {auth_data['user']['role']})")

        # TEST 5: Auto-registration for new farmer via Email OTP
        print("\n--- TEST 5: Auto-Register New Farmer via Email OTP ---")
        res_new_send = client.post("/api/auth/send-email-otp", json={"email": test_email})
        assert res_new_send.status_code == 200
        new_otp = res_new_send.json()["demo_otp"]

        res_new_verify = client.post("/api/auth/verify-email-otp", json={
            "email": test_email,
            "otp": new_otp,
            "name": "Ramesh Chandra"
        })
        assert res_new_verify.status_code == 200
        new_user = res_new_verify.json()["user"]
        assert new_user["name"] == "Ramesh Chandra"
        assert new_user["email"] == test_email
        assert new_user["role"] == "farmer"
        print(f"✓ Test 5 Passed: Successfully auto-registered and logged in new farmer '{new_user['name']}'")

        # TEST 6: Payment Receiving Account Settings
        print("\n--- TEST 6: Payment Receiving Account API ---")
        headers = {"Authorization": f"Bearer {farmer_token}"}
        res6 = client.get("/api/payments/receiving-account", headers=headers)
        assert res6.status_code == 200, f"Expected 200, got {res6.status_code}: {res6.text}"
        acc_data = res6.json()
        assert "upiId" in acc_data
        print(f"✓ Test 6 Passed: Retrieved receiving account: UPI={acc_data['upiId']}, Bank={acc_data['bankName']}")

        # TEST 7: Update Payment Receiving Account
        print("\n--- TEST 7: Update Payment Receiving Account ---")
        res7 = client.post("/api/payments/receiving-account", headers=headers, json={
            "upiId": "surjeet.kisan@upi",
            "bankName": "State Bank of India",
            "preferredMode": "upi"
        })
        assert res7.status_code == 200
        updated_acc = res7.json()
        assert updated_acc["upiId"] == "surjeet.kisan@upi"
        assert updated_acc["bankName"] == "State Bank of India"
        print(f"✓ Test 7 Passed: Successfully updated receiving account: {updated_acc['upiId']}")

        # TEST 8: Generate Dynamic Receive QR Payload
        print("\n--- TEST 8: Generate Dynamic Receive QR Payload ---")
        res8 = client.post("/api/payments/generate-receive-qr", headers=headers, json={
            "amount": 45000.0,
            "note": "Wheat Procurement Payout"
        })
        assert res8.status_code == 200
        qr_data = res8.json()
        assert "upi://pay?" in qr_data["upiUri"]
        assert "surjeet.kisan@upi" in qr_data["upiUri"]
        assert "45000" in qr_data["upiUri"]
        print(f"✓ Test 8 Passed: Generated UPI dynamic QR payload: {qr_data['upiUri']}")

        # TEST 9: Farmer Ledger & Payout Claims
        print("\n--- TEST 9: Farmer Ledger & Receivable Lots ---")
        res9 = client.get("/api/payments/farmer-ledger", headers=headers)
        assert res9.status_code == 200
        ledger_data = res9.json()
        assert "stats" in ledger_data
        assert "account" in ledger_data
        print(f"✓ Test 9 Passed: Retrieved ledger (Stats: Received=₹{ledger_data['stats']['totalReceived']})")

    print("\n==================================================")
    print("🎉 ALL BACKEND EMAIL OTP & PAYMENT TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
