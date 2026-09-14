import asyncio
import httpx
import random

async def main():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # Test 1: Register Farmer
        rand_id = random.randint(10000, 99999)
        payload = {
            "name": "Suresh Patel",
            "mobile": f"98111{rand_id}",
            "email": f"suresh_{rand_id}@testfarmq.in",
            "password": "Password123",
            "confirmPassword": "Password123",
            "state": "Haryana",
            "district": "Karnal",
            "village": "Taraori",
            "farmerType": "Small",
            "mainCrops": ["Wheat", "Mustard"]
        }
        res = await client.post("/api/auth/farmer/register", json=payload)
        print("Registration status:", res.status_code)
        assert res.status_code == 200, f"Registration failed: {res.text}"
        data = res.json()
        token = data["access_token"]
        user = data["user"]
        print("User registered:", user["name"], user["role"])

        # Test 2: Authenticated /auth/me
        headers = {"Authorization": f"Bearer {token}"}
        me_res = await client.get("/api/auth/me", headers=headers)
        print("/auth/me status:", me_res.status_code)
        assert me_res.status_code == 200, f"/auth/me failed: {me_res.text}"
        print("User profile verified:", me_res.json()["email"])

        # Test 3: Authenticated /farmer/dashboard
        dash_res = await client.get("/api/farmer/dashboard", headers=headers)
        print("/farmer/dashboard status:", dash_res.status_code)
        assert dash_res.status_code == 200, f"Dashboard failed: {dash_res.text}"
        dash_data = dash_res.json()
        print("Dashboard retrieved successfully! Keys:", list(dash_data.keys()))
        print("All API endpoints verified for newly registered farmer!")

if __name__ == "__main__":
    asyncio.run(main())
