from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from typing import List, Optional
from backend.app.database.connection import get_database
from backend.app.models.schemas import CenterResponse, LocationModel
from backend.app.services.recommendation import get_center_recommendation
from backend.ml.predict import predict_waiting_time

router = APIRouter(prefix="/api/centers", tags=["centers"])

@router.get("", response_model=List[CenterResponse])
async def list_centers():
    db = get_database()
    centers = await db.procurement_centers.find().to_list(50)
    result = []
    
    for c in centers:
        c_id = str(c["_id"])
        # Real-time queue count
        queue_count = await db.queue_tokens.count_documents({
            "centerId": c_id,
            "status": {"$in": ["waiting", "processing", "arrived", "verification"]}
        })
        
        active_counters = c.get("activeCounters", 2)
        avg_processing = c.get("avgProcessingMinutes", 8)
        pred = predict_waiting_time(
            farmers_ahead=queue_count,
            avg_processing_time=avg_processing,
            crop_quantity=50.0,
            active_counters=active_counters
        )
        
        daily_cap = float(c.get("capacityPerDay", 150.0))
        booked_qty = float(c.get("bookedQuantity", 0.0))
        remaining_cap = max(0.0, daily_cap - booked_qty)
        
        loc_data = c.get("location", {})
        location = LocationModel(
            lat=loc_data.get("lat", 29.6857),
            lng=loc_data.get("lng", 76.9905),
            address=loc_data.get("address", "Mandi Yard, Karnal"),
            district=loc_data.get("district", "Karnal")
        )
        
        # Calculate dynamic queue status
        dynamic_status = c.get("status", "open")
        if dynamic_status != "closed":
            if queue_count <= 8:
                dynamic_status = "low_queue"
            elif queue_count <= 20:
                dynamic_status = "moderate_queue"
            else:
                dynamic_status = "high_queue"
        
        result.append(CenterResponse(
            id=c_id,
            name=c.get("name", "Procurement Center"),
            location=location,
            distanceKm=float(c.get("distanceKm", 4.2)),
            capacityPerDay=daily_cap,
            bookedQuantity=booked_qty,
            remainingCapacity=remaining_cap,
            activeCounters=active_counters,
            avgProcessingMinutes=avg_processing,
            status=dynamic_status,
            queueLength=queue_count,
            estimatedWaitMinutes=pred["estimated_wait_minutes"],
            operatingHours=c.get("operatingHours", "08:00 AM - 05:00 PM"),
            contactPhone=c.get("contactPhone", "1800-180-1551")
        ))
    return result

@router.get("/recommendation")
async def get_recommendation(selectedCenterId: Optional[str] = Query(None)):
    recommendation = await get_center_recommendation(selected_center_id=selectedCenterId)
    return recommendation or {"hasRecommendation": False, "message": "No recommendation available at this time."}

@router.get("/{center_id}", response_model=CenterResponse)
async def get_center(center_id: str):
    db = get_database()
    oid = ObjectId(center_id) if ObjectId.is_valid(center_id) else center_id
    c = await db.procurement_centers.find_one({"_id": oid})
    if not c:
        raise HTTPException(status_code=404, detail="Procurement center not found")
        
    c_id = str(c["_id"])
    queue_count = await db.queue_tokens.count_documents({
        "centerId": c_id,
        "status": {"$in": ["waiting", "processing", "arrived", "verification"]}
    })
    
    active_counters = c.get("activeCounters", 2)
    avg_processing = c.get("avgProcessingMinutes", 8)
    pred = predict_waiting_time(
        farmers_ahead=queue_count,
        avg_processing_time=avg_processing,
        crop_quantity=50.0,
        active_counters=active_counters
    )
    
    daily_cap = float(c.get("capacityPerDay", 150.0))
    booked_qty = float(c.get("bookedQuantity", 0.0))
    
    loc_data = c.get("location", {})
    location = LocationModel(
        lat=loc_data.get("lat", 29.6857),
        lng=loc_data.get("lng", 76.9905),
        address=loc_data.get("address", "Mandi Yard, Karnal"),
        district=loc_data.get("district", "Karnal")
    )
    
    return CenterResponse(
        id=c_id,
        name=c.get("name", "Procurement Center"),
        location=location,
        distanceKm=float(c.get("distanceKm", 4.2)),
        capacityPerDay=daily_cap,
        bookedQuantity=booked_qty,
        remainingCapacity=max(0.0, daily_cap - booked_qty),
        activeCounters=active_counters,
        avgProcessingMinutes=avg_processing,
        status=c.get("status", "open"),
        queueLength=queue_count,
        estimatedWaitMinutes=pred["estimated_wait_minutes"],
        operatingHours=c.get("operatingHours", "08:00 AM - 05:00 PM"),
        contactPhone=c.get("contactPhone", "1800-180-1551")
    )
