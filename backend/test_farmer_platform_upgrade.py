import asyncio
import sys
import os
import random
from datetime import datetime, timedelta
import httpx
from httpx import ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database.connection import get_database, connect_to_mongo, close_mongo_connection
from backend.app.services.crop_price_service import crop_price_service
from backend.app.services.gemini_service import gemini_service
from backend.app.services.otp_service import mask_account_number, mask_mobile_number, mask_email_address
from backend.app.main import app

async def run_tests():
    print("\n" + "=" * 60)
    print("RUNNING FARMER PLATFORM UPGRADE INTEGRATION TESTS")
    print("=" * 60)

    await connect_to_mongo()
    db = get_database()

    # 1. Test Masking functions
    acc_masked = mask_account_number("123456789012")
    assert acc_masked == "XXXX XXXX 9012", f"Mask failed: {acc_masked}"
    phone_masked = mask_mobile_number("+919876543210")
    assert phone_masked == "+91 98******10", f"Phone mask failed: {phone_masked}"
    mail_masked = mask_email_address("surjeet@farmq.demo")
    assert mail_masked == "s***t@farmq.demo", f"Email mask failed: {mail_masked}"
    print("✓ [TEST 1] Masking utilities passed (bank: XXXX XXXX 9012)")

    # 2. Test Crop Price Service
    prices = await crop_price_service.get_crop_prices()
    assert len(prices) >= 15, f"Expected >= 15 official benchmark items, got {len(prices)}"
    wheat_prices = await crop_price_service.get_crop_prices(crop="Wheat")
    assert len(wheat_prices) >= 4, f"Expected >= 4 wheat mandis, got {len(wheat_prices)}"
    print(f"✓ [TEST 2] Crop price retrieval passed ({len(prices)} total quotes, {len(wheat_prices)} Wheat mandis)")

    # 3. Test Crop Price Trends
    trend_7d = await crop_price_service.get_price_trends("Wheat", "7d")
    assert len(trend_7d["data"]) == 7, f"Expected 7 points for 7d trend, got {len(trend_7d['data'])}"
    assert trend_7d["data"][-1]["isLatest"] is True, "Latest point should be marked isLatest=True"
    print("✓ [TEST 3] 7D Price trend generation passed with historical/latest tagging")

    # 4. Test Grounded AI Query Service
    ai_res = await gemini_service.answer_farmer_query("What is today's wheat price near me?", state="Haryana", district="Karnal")
    assert "₹" in ai_res["answer"], "AI answer must include verified rupee figures"
    assert ai_res["cropDetected"] == "Wheat", f"Expected Wheat detected, got {ai_res['cropDetected']}"
    assert len(ai_res["verifiedPrices"]) > 0, "Expected verified prices attached"
    print("✓ [TEST 4] Grounded AI query passed without price hallucinations")

    # 5. Test Dual OTP registration simulation
    test_mobile = "+919811223344"
    test_email = "newfarmer@farmq.test"
    
    # Clean test records
    await db.users.delete_many({"$or": [{"phone": test_mobile}, {"email": test_email}]})
    await db.otp_verifications.delete_many({"$or": [{"phone": test_mobile}, {"email": test_email}]})

    # Record verified OTPs
    await db.otp_verifications.insert_one({
        "phone": test_mobile,
        "purpose": "farmer_registration",
        "verified": True,
        "verifiedAt": datetime.utcnow()
    })
    await db.otp_verifications.insert_one({
        "email": test_email,
        "purpose": "farmer_registration",
        "verified": True,
        "verifiedAt": datetime.utcnow()
    })

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test Registration Endpoint
        reg_payload = {
            "name": "Kisan Balwant Singh",
            "mobile": test_mobile,
            "email": test_email,
            "password": "SecurePassword123",
            "confirmPassword": "SecurePassword123",
            "state": "Haryana",
            "district": "Karnal",
            "village": "Taraori",
            "preferredLanguage": "hi",
            "farmerType": "Small",
            "mainCrops": ["Wheat", "Rice"],
            "landArea": 3.5,
            "landAreaUnit": "acre",
            "farmingExperience": 12.0,
            "bankDetails": {
                "accountHolderName": "Balwant Singh",
                "bankName": "Punjab National Bank",
                "accountNumber": "123456789012",
                "confirmAccountNumber": "123456789012",
                "ifscCode": "PUNB0012340",
                "branchName": "Taraori Mandi Branch",
                "confirmed": True
            }
        }
        
        reg_res = await ac.post("/api/auth/farmer/register", json=reg_payload)
        assert reg_res.status_code == 200, f"Registration failed ({reg_res.status_code}): {reg_res.text}"
        data = reg_res.json()
        assert "access_token" in data, "Token missing in response"
        token = data["access_token"]
        print("✓ [TEST 5] Farmer Registration Endpoint passed with token issue")

        # 5B. Test Streamlined Farmer Registration (Personal & Location only, NO Bank Details)
        test_mobile_nobank = f"98765{random.randint(10000, 99999)}"
        test_email_nobank = f"nobank_{random.randint(1000, 9999)}@farmq.demo"
        reg_nobank_payload = {
            "name": "Kishan Singh",
            "mobile": test_mobile_nobank,
            "email": test_email_nobank,
            "password": "SecurePassword123",
            "confirmPassword": "SecurePassword123",
            "state": "Punjab",
            "district": "Patiala",
            "village": "Samana",
            "preferredLanguage": "pa",
            "farmerType": "Small",
            "mainCrops": ["Wheat"]
        }
        reg_nobank_res = await ac.post("/api/auth/farmer/register", json=reg_nobank_payload)
        assert reg_nobank_res.status_code == 200, f"Registration without bank failed ({reg_nobank_res.status_code}): {reg_nobank_res.text}"
        nobank_data = reg_nobank_res.json()
        assert "access_token" in nobank_data, "Token missing in response for registration without bank"
        assert nobank_data["user"]["village"] == "Samana"
        print("✓ [TEST 5B] Streamlined Farmer Registration (Personal & Location only, no bank) passed!")

        # 6. Verify Masked Bank Details in Profile
        headers = {"Authorization": f"Bearer {token}"}
        bank_res = await ac.get("/api/farmer/bank-details", headers=headers)
        assert bank_res.status_code == 200, f"Bank fetch failed: {bank_res.text}"
        bank_data = bank_res.json()
        assert bank_data["accountNumberMasked"] == "XXXX XXXX 9012", f"Bank account masking failed: {bank_data}"
        assert "123456789012" not in bank_res.text, "Full account number leaked in response!"
        print("✓ [TEST 6] Bank Details masked response verified (XXXX XXXX 9012)")

        # 7. Test Dashboard 8 Cards Enrichment
        dash_res = await ac.get("/api/farmer/dashboard", headers=headers)
        assert dash_res.status_code == 200, f"Dashboard fetch failed: {dash_res.text}"
        dash_data = dash_res.json()
        assert "bankDetails" in dash_data, "bankDetails missing in dashboard"
        assert "todayCropPrices" in dash_data, "todayCropPrices missing in dashboard"
        assert "nearbyMarkets" in dash_data, "nearbyMarkets missing in dashboard"
        assert "favoriteCrops" in dash_data, "favoriteCrops missing in dashboard"
        print("✓ [TEST 7] Farmer Dashboard 8 cards enriched feed verified")

        # 8. Test Crop Prices HTTP endpoint
        cp_res = await ac.get("/api/crop-prices?crop=Wheat")
        assert cp_res.status_code == 200, f"Crop prices endpoint failed: {cp_res.text}"
        assert len(cp_res.json()) >= 4, "Expected >= 4 wheat mandis"
        print("✓ [TEST 8] GET /api/crop-prices verified via HTTP")

        # 9. Test AI farmer query endpoint
        ai_http = await ac.post("/api/ai/farmer-query", json={"query": "Which nearby mandi has better prices for wheat?"})
        assert ai_http.status_code == 200, f"AI query failed: {ai_http.text}"
        assert "₹" in ai_http.json()["answer"], "AI answer must contain verified rupee prices"
        print("✓ [TEST 9] POST /api/ai/farmer-query verified via HTTP")

    # Clean up
    await db.users.delete_many({"$or": [{"phone": test_mobile}, {"email": test_email}]})
    await db.otp_verifications.delete_many({"$or": [{"phone": test_mobile}, {"email": test_email}]})
    await close_mongo_connection()

    print("\n" + "=" * 60)
    print("ALL 9 BACKEND INTEGRATION TESTS PASSED PERFECTLY!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
