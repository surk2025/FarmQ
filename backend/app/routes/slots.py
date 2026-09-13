from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, date
from bson import ObjectId
from typing import List, Optional
import json
from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import get_current_user
from backend.app.models.schemas import SlotResponse, SlotBookingRequest, BookingConfirmationResponse
from backend.app.services.queue_service import update_token_positions, generate_unique_token_number
from backend.app.websocket.connection_manager import ws_manager
from backend.ml.predict import predict_waiting_time

router = APIRouter(prefix="/api/slots", tags=["slots"])

@router.get("", response_model=List[SlotResponse])
async def get_slots(centerId: str = Query(...), slotDate: Optional[str] = Query(None)):
    db = get_database()
    today_str = slotDate or datetime.now().strftime("%Y-%m-%d")
    slots = await db.slots.find({"centerId": centerId, "date": today_str}).to_list(50)
    
    # If no slots in DB for this date, dynamically generate realistic time slots
    if not slots:
        standard_times = [
            ("08:00", "09:00", 25, 18),
            ("09:00", "10:00", 25, 12),
            ("10:00", "11:00", 25, 22),
            ("11:00", "12:00", 25, 25),  # Full
            ("12:00", "13:00", 20, 14),
            ("13:00", "14:00", 20, 8),
            ("14:00", "15:00", 25, 19),
            ("15:00", "16:00", 25, 11),
            ("16:00", "17:00", 20, 5),
        ]
        slots = []
        for start, end, cap, booked in standard_times:
            slot_doc = {
                "centerId": centerId,
                "date": today_str,
                "startTime": start,
                "endTime": end,
                "capacity": cap,
                "booked": booked
            }
            res = await db.slots.insert_one(slot_doc)
            slot_doc["_id"] = res.inserted_id
            slots.append(slot_doc)
            
    result = []
    for s in slots:
        cap = s.get("capacity", 20)
        booked = s.get("booked", 0)
        result.append(SlotResponse(
            id=str(s["_id"]),
            centerId=s["centerId"],
            date=s["date"],
            startTime=s["startTime"],
            endTime=s["endTime"],
            capacity=cap,
            booked=booked,
            isFull=(booked >= cap)
        ))
    return result

@router.post("/book", response_model=BookingConfirmationResponse)
async def book_slot(req: SlotBookingRequest, current_user: dict = Depends(get_current_user)):
    db = get_database()
    farmer_id = current_user["id"]
    
    # 1. Fetch crop
    crop_oid = ObjectId(req.cropId) if ObjectId.is_valid(req.cropId) else req.cropId
    crop = await db.crops.find_one({"_id": crop_oid, "farmerId": farmer_id})
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found for this farmer")
        
    # 2. Fetch center
    center_oid = ObjectId(req.centerId) if ObjectId.is_valid(req.centerId) else req.centerId
    center = await db.procurement_centers.find_one({"_id": center_oid})
    if not center:
        raise HTTPException(status_code=404, detail="Procurement center not found")
        
    # 3. Fetch slot
    slot_oid = ObjectId(req.slotId) if ObjectId.is_valid(req.slotId) else req.slotId
    slot = await db.slots.find_one({"_id": slot_oid})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("booked", 0) >= slot.get("capacity", 20):
        raise HTTPException(status_code=400, detail="This time slot is full. Please select another slot.")
        
    # 4. Generate next incremental Token Number (globally unique sequential atomic)
    next_token_num = await generate_unique_token_number(db)
    
    # Calculate queue position & wait time
    active_ahead = await db.queue_tokens.count_documents({
        "centerId": req.centerId,
        "status": {"$in": ["waiting", "arrived", "processing", "verification"]}
    })
    
    pred = predict_waiting_time(
        farmers_ahead=active_ahead,
        avg_processing_time=center.get("avgProcessingMinutes", 8),
        crop_quantity=req.quantity,
        active_counters=center.get("activeCounters", 2)
    )
    
    # 5. Insert QueueToken with atomic tokenNumber and retry safety
    token_doc = {
        "tokenNumber": next_token_num,
        "farmerId": farmer_id,
        "farmerName": current_user["name"],
        "farmerPhone": current_user["phone"],
        "centerId": req.centerId,
        "centerName": center.get("name", "Procurement Center"),
        "slotId": req.slotId,
        "cropId": req.cropId,
        "cropName": crop["cropName"],
        "quantity": req.quantity,
        "status": "waiting",
        "positionInQueue": active_ahead + 1,
        "farmersAhead": active_ahead,
        "estimatedWaitMinutes": pred["estimated_wait_minutes"],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    for attempt in range(3):
        try:
            token_res = await db.queue_tokens.insert_one(token_doc)
            break
        except Exception as e:
            if "duplicate" in str(e).lower() and attempt < 2:
                next_token_num = await generate_unique_token_number(db)
                token_doc["tokenNumber"] = next_token_num
            else:
                raise
    token_id = str(token_res.inserted_id)
    
    # 6. Insert Procurement record with timeline
    msp_rates = {"Wheat": 2275, "Rice": 2203, "Maize": 2090, "Mustard": 5650, "Sugarcane": 315, "Potato": 1450}
    rate = msp_rates.get(crop["cropName"], 2200)
    total_amount = rate * req.quantity
    
    procurement_doc = {
        "tokenId": token_id,
        "farmerId": farmer_id,
        "farmerName": current_user["name"],
        "cropId": req.cropId,
        "cropName": crop["cropName"],
        "quantity": req.quantity,
        "unit": crop.get("unit", "quintal"),
        "centerId": req.centerId,
        "centerName": center.get("name", "Procurement Center"),
        "status": "slot_confirmed",
        "ratePerQuintal": rate,
        "totalAmount": total_amount,
        "timeline": [
            {"status": "registered", "label": "Registration", "timestamp": datetime.utcnow().strftime("%d %b, %I:%M %p"), "completed": True, "current": False},
            {"status": "slot_confirmed", "label": "Slot Confirmed", "timestamp": datetime.utcnow().strftime("%d %b, %I:%M %p"), "completed": True, "current": True},
            {"status": "arrived", "label": "Farmer Arrived", "timestamp": None, "completed": False, "current": False},
            {"status": "verification", "label": "Crop Verification", "timestamp": None, "completed": False, "current": False},
            {"status": "procurement_completed", "label": "Procurement Completed", "timestamp": None, "completed": False, "current": False},
            {"status": "payment_processing", "label": "Payment Processing", "timestamp": None, "completed": False, "current": False},
            {"status": "paid", "label": "Payment Completed", "timestamp": None, "completed": False, "current": False}
        ],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    proc_res = await db.procurements.insert_one(procurement_doc)
    
    # 7. Create Payment record (mock)
    await db.payments.insert_one({
        "procurementId": str(proc_res.inserted_id),
        "farmerId": farmer_id,
        "amount": total_amount,
        "status": "processing",
        "expectedDate": "After crop verification",
        "transactionRef": f"FARMQ-{datetime.now().strftime('%Y%m%d')}-{next_token_num:04d}",
        "bankAccountMasked": "XXXX-XXXX-4192",
        "createdAt": datetime.utcnow()
    })
    
    # 8. Update Slot & Center booked quantities
    await db.slots.update_one({"_id": slot_oid}, {"$inc": {"booked": 1}})
    await db.procurement_centers.update_one({"_id": center_oid}, {"$inc": {"bookedQuantity": req.quantity}})
    await db.crops.update_one({"_id": crop_oid}, {"$set": {"status": "scheduled"}})
    
    # 9. Send Notification
    await db.notifications.insert_one({
        "userId": farmer_id,
        "title": "Slot Booking Confirmed ✅",
        "message": f"Token #{next_token_num} booked at {center.get('name')} for {slot['startTime']} - {slot['endTime']} on {slot['date']}.",
        "type": "slot",
        "read": False,
        "createdAt": datetime.utcnow()
    })
    
    # Broadcast queue update
    await update_token_positions(req.centerId)
    await ws_manager.broadcast_to_center(req.centerId, {
        "type": "NEW_TOKEN",
        "tokenNumber": next_token_num,
        "centerId": req.centerId,
        "cropName": crop["cropName"]
    })
    
    qr_payload = {
        "farmq_token": next_token_num,
        "farmer_name": current_user["name"],
        "farmer_phone": current_user["phone"],
        "crop": crop["cropName"],
        "quantity": req.quantity,
        "center": center.get("name"),
        "date": slot["date"],
        "time": f"{slot['startTime']} - {slot['endTime']}"
    }
    
    loc_address = center.get("location", {}).get("address", "Mandi Road, Karnal")
    return BookingConfirmationResponse(
        tokenNumber=next_token_num,
        tokenId=token_id,
        centerName=center.get("name", "Procurement Center"),
        centerAddress=loc_address,
        cropName=crop["cropName"],
        quantity=req.quantity,
        slotDate=slot["date"],
        slotTime=f"{slot['startTime']} - {slot['endTime']}",
        estimatedWaitMinutes=pred["estimated_wait_minutes"],
        qrData=json.dumps(qr_payload)
    )
