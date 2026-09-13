import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import requests
import json

BASE_URL = "http://127.0.0.1:8000/api/prediction"

def run_tests():
    print("Testing Prediction Center Endpoints...")

    # 1. Test POST /distance
    dist_payload = {
        "source": {
            "village": "Kisanpur",
            "district": "Karnal",
            "state": "Haryana",
            "address": "Kisanpur Village, Karnal, Haryana"
        },
        "destination": {
            "mandiName": "Karnal Grain Mandi",
            "district": "Karnal",
            "state": "Haryana"
        },
        "cropName": "Wheat",
        "quantity": 50.0,
        "vehicleType": "tractor_trolley"
    }
    r = requests.post(f"{BASE_URL}/distance", json=dist_payload, timeout=10)
    print(f"POST /distance Status: {r.status_code}")
    assert r.status_code == 200, f"Distance failed: {r.text}"
    dist_data = r.json()
    print(f"  -> Distance: {dist_data['distanceFormatted']}, Travel Time: {dist_data['travelTimeFormatted']}")
    print(f"  -> Recommended Route: {dist_data['recommendedRoute']}")
    print(f"  -> Crop Price: ₹{dist_data['cropPricePerQuintal']}, Transport Cost: ₹{dist_data['estimatedTransportCost']}")
    print(f"  -> Estimated Net Return: ₹{dist_data['estimatedNetReturn']}")

    # 2. Test POST /route
    r = requests.post(f"{BASE_URL}/route", json=dist_payload, timeout=10)
    print(f"POST /route Status: {r.status_code}")
    assert r.status_code == 200, f"Route failed: {r.text}"
    route_data = r.json()
    print(f"  -> Waypoints count: {len(route_data.get('routeWaypoints', []))}")
    print(f"  -> Navigation URL: {route_data.get('directionsUrl')[:50]}...")

    # 3. Test POST /transport-cost
    cost_payload = {
        "distanceKm": 25.5,
        "quantity": 60.0,
        "vehicleType": "pickup_bolero"
    }
    r = requests.post(f"{BASE_URL}/transport-cost", json=cost_payload, timeout=10)
    print(f"POST /transport-cost Status: {r.status_code}")
    assert r.status_code == 200, f"Transport cost failed: {r.text}"
    cost_data = r.json()
    print(f"  -> Vehicle: {cost_data['vehicleName']}, Trips: {cost_data['tripsRequired']}, Total: ₹{cost_data['estimatedCost']}")

    # 4. Test GET /nearby-mandis
    r = requests.get(f"{BASE_URL}/nearby-mandis?address=Karnal&crop=Wheat", timeout=10)
    print(f"GET /nearby-mandis Status: {r.status_code}")
    assert r.status_code == 200, f"Nearby mandis failed: {r.text}"
    mandis = r.json()
    print(f"  -> Found {len(mandis)} nearby mandis")
    if mandis:
        print(f"  -> Closest: {mandis[0]['mandiName']} ({mandis[0]['distanceKm']} km, ₹{mandis[0]['modalPrice']}/Qtl)")

    # 5. Test POST /mandi-recommendation
    r = requests.post(f"{BASE_URL}/mandi-recommendation", json=dist_payload, timeout=10)
    print(f"POST /mandi-recommendation Status: {r.status_code}")
    assert r.status_code == 200, f"Recommendation failed: {r.text}"
    rec_data = r.json()
    best = rec_data.get("recommendedMandi")
    print(f"  -> Recommended Mandi: {best['mandiName'] if best else 'None'}")
    print(f"  -> Summary: {rec_data.get('summary')}")

    # 6. Test POST /ai-explain
    ai_payload = {
        "query": "Why should I choose this mandi over others?",
        "cropName": "Wheat",
        "quantity": 50.0,
        "mandisData": rec_data.get("allMandis", [])
    }
    r = requests.post(f"{BASE_URL}/ai-explain", json=ai_payload, timeout=10)
    print(f"POST /ai-explain Status: {r.status_code}")
    assert r.status_code == 200, f"AI explain failed: {r.text}"
    ai_data = r.json()
    print(f"  -> Explanation source: {ai_data.get('source')}")
    print(f"  -> Snippet: {ai_data.get('explanation')[:120]}...")

    print("\nALL PREDICTION API ENDPOINT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
