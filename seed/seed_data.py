import os
import sys
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient

# Add root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.auth.security import get_password_hash

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "farmq")

def seed():
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f"Clearing existing collections in {DATABASE_NAME}...")
    for col in ["users", "crops", "procurement_centers", "slots", "queue_tokens", "procurements", "payments", "notifications"]:
        db[col].drop()
        
    print("Seeding Users...")
    # 1. Main Demo Farmer (Surjeet Kumar)
    farmer_demo_id = ObjectId()
    demo_farmer = {
        "_id": farmer_demo_id,
        "name": "Surjeet Kumar",
        "phone": "+919812000025",
        "email": "farmer@farmq.demo",
        "hashedPassword": get_password_hash("demo123"),
        "role": "farmer",
        "authProviders": ["password", "phone"],
        "village": "Taraori",
        "district": "Karnal",
        "state": "Haryana",
        "preferredLanguage": "en",
        "createdAt": datetime.utcnow() - timedelta(days=10)
    }
    
    # 2. Admin User
    admin_id = ObjectId()
    demo_admin = {
        "_id": admin_id,
        "name": "Vikram Singh (Mandi Officer)",
        "phone": "+919876543210",
        "email": "admin@farmq.demo",
        "hashedPassword": get_password_hash("admin123"),
        "role": "admin",
        "authProviders": ["password", "phone"],
        "village": "Sector 14",
        "district": "Karnal",
        "state": "Haryana",
        "preferredLanguage": "en",
        "createdAt": datetime.utcnow() - timedelta(days=30)
    }
    
    # 3. Super Admin
    super_admin_id = ObjectId()
    demo_superadmin = {
        "_id": super_admin_id,
        "name": "Dr. Rajesh Sharma (Director)",
        "phone": "+919998887770",
        "email": "superadmin@farmq.demo",
        "hashedPassword": get_password_hash("super123"),
        "role": "superadmin",
        "authProviders": ["password", "phone"],
        "village": "Krishi Bhawan",
        "district": "Chandigarh",
        "state": "Punjab",
        "preferredLanguage": "en",
        "createdAt": datetime.utcnow() - timedelta(days=60)
    }
    
    # 10 other farmers
    farmer_names = [
        ("Ramesh Chandra", "9812000001", "Gharaunda"),
        ("Suresh Verma", "9812000002", "Nilokheri"),
        ("Baldev Singh", "9812000003", "Indri"),
        ("Harpreet Kaur", "9812000004", "Assandh"),
        ("Kuldeep Yadav", "9812000005", "Jundla"),
        ("Manoj Kumar", "9812000006", "Kunjpura"),
        ("Jaswinder Singh", "9812000007", "Nissing"),
        ("Rajesh Devi", "9812000008", "Taraori"),
        ("Amit Sharma", "9812000009", "Pundri"),
        ("Dharam Pal", "9812000010", "Sambhal")
    ]
    
    farmer_ids = [farmer_demo_id]
    user_docs = [demo_farmer, demo_admin, demo_superadmin]
    for name, phone, village in farmer_names:
        fid = ObjectId()
        farmer_ids.append(fid)
        user_docs.append({
            "_id": fid,
            "name": name,
            "phone": phone,
            "email": f"{phone}@demo.com",
            "hashedPassword": get_password_hash("demo123"),
            "role": "farmer",
            "village": village,
            "district": "Karnal",
            "state": "Haryana",
            "preferredLanguage": "hi" if len(farmer_ids) % 2 == 0 else "en",
            "createdAt": datetime.utcnow() - timedelta(days=5)
        })
    db.users.insert_many(user_docs)
    print(f"Inserted {len(user_docs)} users.")
    
    # 4. Centers
    print("Seeding Procurement Centers...")
    center1_id = ObjectId()
    center2_id = ObjectId()
    center3_id = ObjectId()
    
    centers = [
        {
            "_id": center1_id,
            "name": "Greenfield Procurement Center",
            "location": {
                "lat": 29.6857,
                "lng": 76.9905,
                "address": "Grain Market Road, Sector 3",
                "district": "Karnal"
            },
            "distanceKm": 4.2,
            "capacityPerDay": 150.0,
            "bookedQuantity": 112.0,
            "activeCounters": 3,
            "avgProcessingMinutes": 8,
            "status": "open",
            "operatingHours": "08:00 AM - 05:00 PM",
            "contactPhone": "0184-2256789"
        },
        {
            "_id": center2_id,
            "name": "District Mandi Center",
            "location": {
                "lat": 29.6920,
                "lng": 76.9800,
                "address": "Main Anaaj Mandi, GT Road",
                "district": "Karnal"
            },
            "distanceKm": 7.8,
            "capacityPerDay": 220.0,
            "bookedQuantity": 195.0,
            "activeCounters": 2,
            "avgProcessingMinutes": 10,
            "status": "open",
            "operatingHours": "07:30 AM - 06:00 PM",
            "contactPhone": "0184-2241100"
        },
        {
            "_id": center3_id,
            "name": "North Block Procurement Center",
            "location": {
                "lat": 29.7100,
                "lng": 77.0100,
                "address": "State Highway 8, Nilokheri Road",
                "district": "Karnal"
            },
            "distanceKm": 5.1,
            "capacityPerDay": 180.0,
            "bookedQuantity": 65.0,
            "activeCounters": 4,
            "avgProcessingMinutes": 7,
            "status": "open",
            "operatingHours": "08:00 AM - 05:00 PM",
            "contactPhone": "0184-2289450"
        }
    ]
    db.procurement_centers.insert_many(centers)
    print("Inserted 3 Procurement Centers.")
    
    # 5. Slots
    print("Seeding Slots...")
    today_str = datetime.now().strftime("%Y-%m-%d")
    slots_data = [
        ("08:00", "09:00", 25, 25),
        ("09:00", "10:00", 25, 20),
        ("10:00", "11:00", 25, 14),
        ("11:00", "12:00", 25, 25),  # FULL
        ("12:00", "13:00", 20, 10),
        ("13:00", "14:00", 20, 5),
        ("14:00", "15:00", 25, 8),
        ("15:00", "16:00", 25, 3),
        ("16:00", "17:00", 20, 2)
    ]
    slot_ids = []
    for c_id in [center1_id, center2_id, center3_id]:
        for start, end, cap, booked in slots_data:
            s_res = db.slots.insert_one({
                "centerId": str(c_id),
                "date": today_str,
                "startTime": start,
                "endTime": end,
                "capacity": cap,
                "booked": booked
            })
            if c_id == center1_id:
                slot_ids.append(str(s_res.inserted_id))
    print("Slots created.")
    
    # 6. Crops
    print("Seeding Crops...")
    crop_demo_wheat = {
        "_id": ObjectId(),
        "farmerId": str(farmer_demo_id),
        "cropName": "Wheat",
        "quantity": 50.0,
        "unit": "quintal",
        "harvestDate": "2026-04-15",
        "preferredDate": today_str,
        "status": "scheduled",
        "createdAt": datetime.utcnow() - timedelta(days=2)
    }
    crop_demo_mustard = {
        "_id": ObjectId(),
        "farmerId": str(farmer_demo_id),
        "cropName": "Mustard",
        "quantity": 25.0,
        "unit": "quintal",
        "harvestDate": "2026-03-20",
        "preferredDate": None,
        "status": "registered",
        "createdAt": datetime.utcnow() - timedelta(days=1)
    }
    db.crops.insert_many([crop_demo_wheat, crop_demo_mustard])
    
    # 7. Queue Tokens (Tokens #1 to #30)
    print("Seeding 30 Queue Tokens...")
    # Tokens 1-22: Completed
    # Token 23: Processing (Counter 1)
    # Token 24: Waiting (Next)
    # Token 25: Surjeet Kumar (Demo Farmer) - Waiting (12 ahead in general queue or scheduled slot)
    # Tokens 26-35: Waiting
    
    token_docs = []
    farmer_map = {str(doc["_id"]): doc for doc in user_docs}
    
    for t_num in range(1, 31):
        if t_num < 23:
            t_status = "completed"
            pos = 0
            ahead = 0
            wait_m = 0
            cnt = 1
        elif t_num == 23:
            t_status = "processing"
            pos = 1
            ahead = 0
            wait_m = 0
            cnt = 1
        elif t_num == 24:
            t_status = "waiting"
            pos = 2
            ahead = 1
            wait_m = 8
            cnt = None
        elif t_num == 25:
            t_status = "waiting"
            pos = 3
            ahead = 12  # As requested in the specification for demo farmer display
            wait_m = 96  # 1h 36m
            cnt = None
        else:
            t_status = "waiting"
            pos = t_num - 21
            ahead = t_num - 23
            wait_m = (t_num - 23) * 8
            cnt = None
            
        if t_num == 25:
            f_id = str(farmer_demo_id)
            f_name = "Surjeet Kumar"
            f_phone = "demo-farmer"
            c_name = "Wheat"
            c_qty = 50.0
        elif t_num == 23:
            f_id = str(farmer_ids[1])
            f_name = "Ramesh Chandra"
            f_phone = "9812000001"
            c_name = "Wheat"
            c_qty = 35.0
        elif t_num == 24:
            f_id = str(farmer_ids[2])
            f_name = "Suresh Verma"
            f_phone = "9812000002"
            c_name = "Rice"
            c_qty = 40.0
        else:
            f_idx = t_num % len(farmer_ids)
            f_doc = farmer_map[str(farmer_ids[f_idx])]
            f_id = str(f_doc["_id"])
            f_name = f_doc["name"]
            f_phone = f_doc["phone"]
            crops_cycle = ["Wheat", "Rice", "Mustard", "Maize", "Sugarcane"]
            c_name = crops_cycle[t_num % len(crops_cycle)]
            c_qty = 30.0 + (t_num % 5) * 10
            
        t_id = ObjectId()
        token_docs.append({
            "_id": t_id,
            "tokenNumber": t_num,
            "farmerId": f_id,
            "farmerName": f_name,
            "farmerPhone": f_phone,
            "centerId": str(center1_id),
            "centerName": "Greenfield Procurement Center",
            "slotId": slot_ids[2] if slot_ids else "slot_10_11",
            "cropName": c_name,
            "quantity": c_qty,
            "status": t_status,
            "positionInQueue": pos,
            "farmersAhead": ahead,
            "estimatedWaitMinutes": wait_m,
            "counterNumber": cnt,
            "createdAt": datetime.utcnow() - timedelta(hours=4) + timedelta(minutes=t_num * 8),
            "updatedAt": datetime.utcnow()
        })
    db.queue_tokens.insert_many(token_docs)
    db.queue_tokens.create_index("tokenNumber", unique=True)
    db.counters.update_one({"_id": "queue_token_number"}, {"$set": {"seq": 30}}, upsert=True)
    print("Inserted 30 queue tokens and ensured unique index on tokenNumber.")
    
    # 8. Procurements
    print("Seeding Procurements & Payments...")
    token_25 = [t for t in token_docs if t["tokenNumber"] == 25][0]
    proc_25_id = ObjectId()
    proc_25 = {
        "_id": proc_25_id,
        "tokenId": str(token_25["_id"]),
        "farmerId": str(farmer_demo_id),
        "farmerName": "Surjeet Kumar",
        "cropId": str(crop_demo_wheat["_id"]),
        "cropName": "Wheat",
        "quantity": 50.0,
        "unit": "quintal",
        "centerId": str(center1_id),
        "centerName": "Greenfield Procurement Center",
        "status": "slot_confirmed",
        "ratePerQuintal": 2275.0,
        "totalAmount": 113750.0,
        "timeline": [
            {"status": "registered", "label": "Registration", "timestamp": "11 Sep, 08:30 AM", "completed": True, "current": False},
            {"status": "slot_confirmed", "label": "Slot Confirmed", "timestamp": "11 Sep, 09:15 AM", "completed": True, "current": True},
            {"status": "arrived", "label": "Farmer Arrived", "timestamp": None, "completed": False, "current": False},
            {"status": "verification", "label": "Crop Verification", "timestamp": None, "completed": False, "current": False},
            {"status": "procurement_completed", "label": "Procurement Completed", "timestamp": None, "completed": False, "current": False},
            {"status": "payment_processing", "label": "Payment Processing", "timestamp": None, "completed": False, "current": False},
            {"status": "paid", "label": "Payment Completed", "timestamp": None, "completed": False, "current": False}
        ],
        "createdAt": datetime.utcnow() - timedelta(hours=2),
        "updatedAt": datetime.utcnow()
    }
    db.procurements.insert_one(proc_25)
    
    # Payment for Token 25
    db.payments.insert_one({
        "procurementId": str(proc_25_id),
        "farmerId": str(farmer_demo_id),
        "amount": 113750.0,
        "status": "processing",
        "expectedDate": "Within 48 hours of verification",
        "transactionRef": "FARMQ-20260911-0025",
        "bankAccountMasked": "XXXX-XXXX-4192",
        "createdAt": datetime.utcnow()
    })
    
    # Previous completed payment for farmer demo
    db.payments.insert_one({
        "procurementId": str(ObjectId()),
        "farmerId": str(farmer_demo_id),
        "amount": 82500.0,
        "status": "paid",
        "expectedDate": "15 Aug 2026",
        "transactionRef": "DBT-RBI-9928172635",
        "bankAccountMasked": "XXXX-XXXX-4192",
        "paidAt": datetime.utcnow() - timedelta(days=25),
        "createdAt": datetime.utcnow() - timedelta(days=26)
    })
    
    # Notifications for demo farmer
    db.notifications.insert_many([
        {
            "userId": str(farmer_demo_id),
            "title": "Procurement Slot Confirmed ✅",
            "message": "Your slot for 50 Quintal Wheat at Greenfield Procurement Center is confirmed for today. Token #25 assigned.",
            "type": "slot",
            "read": False,
            "createdAt": datetime.utcnow() - timedelta(minutes=45)
        },
        {
            "userId": str(farmer_demo_id),
            "title": "Live Queue Alert 🌾",
            "message": "12 farmers ahead of you. AI Estimated waiting time is 1h 36m. You can track live updates in your dashboard.",
            "type": "queue",
            "read": False,
            "createdAt": datetime.utcnow() - timedelta(minutes=20)
        }
    ])
    
    print("\n=======================================================")
    print(" Seed Data Generated Successfully!")
    print("=======================================================")
    print(" DEMO CREDENTIALS:")
    print(" Farmer Login:")
    print("   Phone:    demo-farmer")
    print("   Password: demo123")
    print("   Token:    #25 (12 ahead, 1h 36m wait, Wheat 50Q)")
    print("\n Admin Login:")
    print("   Email:    admin@farmq.demo")
    print("   Password: admin123")
    print("\n Super Admin Login:")
    print("   Email:    superadmin@farmq.demo")
    print("   Password: super123")
    print("=======================================================\n")

if __name__ == "__main__":
    seed()
