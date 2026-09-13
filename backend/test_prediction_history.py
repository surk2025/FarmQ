import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import requests
import requests
from pymongo import MongoClient
from backend.app.auth.jwt_handler import create_access_token

BASE_URL = "http://127.0.0.1:8000/api/prediction"

def test_history_flow():
    client = MongoClient("mongodb://127.0.0.1:27017")
    db = client.farmq
    user = db.users.find_one({"role": "farmer"})
    if not user:
        user_id = str(db.users.insert_one({"name": "Test Farmer", "phone": "9999900000", "role": "farmer"}).inserted_id)
    else:
        user_id = str(user["_id"])

    token = create_access_token({"sub": user_id, "role": "farmer"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post distance prediction with token
    payload = {
        "source": {"village": "Kisanpur", "district": "Karnal", "state": "Haryana"},
        "destination": {"mandiName": "Karnal Grain Mandi", "district": "Karnal", "state": "Haryana"},
        "cropName": "Wheat",
        "quantity": 50.0,
        "vehicleType": "tractor_trolley"
    }
    r = requests.post(f"{BASE_URL}/distance", json=payload, headers=headers, timeout=10)
    assert r.status_code == 200, f"Distance error: {r.text}"
    print("✓ Distance calculation saved to history")

    # 2. Get history
    r = requests.get(f"{BASE_URL}/history", headers=headers, timeout=10)
    assert r.status_code == 200, f"History fetch error: {r.text}"
    items = r.json()
    assert len(items) >= 1, "Expected at least 1 history item"
    history_id = items[0]["id"]
    print(f"✓ Retrieved {len(items)} history items. Top ID: {history_id}")

    # 3. Delete history item
    r = requests.delete(f"{BASE_URL}/history/{history_id}", headers=headers, timeout=10)
    assert r.status_code == 200, f"Delete history error: {r.text}"
    print(f"✓ Deleted history item {history_id} successfully")

    print("ALL AUTHENTICATED HISTORY TESTS PASSED!")

if __name__ == "__main__":
    test_history_flow()
