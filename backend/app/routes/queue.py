from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_database
from backend.app.models.schemas import QueuePredictionResponse
from backend.ml.predict import predict_waiting_time, format_minutes

router = APIRouter(prefix="/api/queue", tags=["queue"])

@router.get("/center/{center_id}")
async def get_center_queue(center_id: str):
    db = get_database()
    active_tokens = await db.queue_tokens.find({
        "centerId": center_id,
        "status": {"$in": ["processing", "waiting", "arrived", "verification"]}
    }).sort("tokenNumber", 1).to_list(100)
    
    # Format tokens
    formatted = []
    for idx, t in enumerate(active_tokens):
        formatted.append({
            "id": str(t["_id"]),
            "tokenNumber": t["tokenNumber"],
            "farmerName": t.get("farmerName", "Farmer"),
            "cropName": t.get("cropName", "Wheat"),
            "quantity": t.get("quantity", 50.0),
            "status": t.get("status", "waiting"),
            "position": idx + 1,
            "farmersAhead": idx if t.get("status") != "processing" else 0,
            "counterNumber": t.get("counterNumber", 1) if t.get("status") == "processing" else None,
            "updatedAt": t.get("updatedAt", datetime.utcnow()).isoformat() if isinstance(t.get("updatedAt"), datetime) else str(t.get("updatedAt"))
        })
    return formatted

@router.get("/{token_number}")
async def get_queue_token(token_number: int, centerId: Optional[str] = Query(None)):
    db = get_database()
    query = {"tokenNumber": token_number}
    if centerId:
        query["centerId"] = centerId
        
    token = await db.queue_tokens.find_one(query)
    if not token:
        raise HTTPException(status_code=404, detail=f"Queue token #{token_number} not found")
        
    actual_center_id = token["centerId"]
    center = await db.procurement_centers.find_one({"_id": ObjectId(actual_center_id)}) if ObjectId.is_valid(actual_center_id) else await db.procurement_centers.find_one({"_id": actual_center_id})
    center_name = center.get("name", "Procurement Center") if center else "Procurement Center"
    
    # Calculate real-time position ahead of this token
    farmers_ahead = 0
    if token.get("status") in ["waiting", "arrived"]:
        farmers_ahead = await db.queue_tokens.count_documents({
            "centerId": actual_center_id,
            "tokenNumber": {"$lt": token_number},
            "status": {"$in": ["waiting", "arrived", "processing", "verification"]}
        })
    
    active_counters = center.get("activeCounters", 2) if center else 2
    avg_processing = center.get("avgProcessingMinutes", 8) if center else 8
    
    pred = predict_waiting_time(
        farmers_ahead=farmers_ahead,
        avg_processing_time=avg_processing,
        crop_quantity=token.get("quantity", 50.0),
        active_counters=active_counters
    )
    
    # Fetch nearby tokens in queue (e.g. 2 ahead, this one, 2 behind)
    all_active = await db.queue_tokens.find({
        "centerId": actual_center_id,
        "status": {"$in": ["processing", "waiting", "arrived", "verification"]}
    }).sort("tokenNumber", 1).to_list(100)
    
    queue_list = []
    for idx, t in enumerate(all_active):
        is_current = (t["tokenNumber"] == token_number)
        queue_list.append({
            "tokenNumber": t["tokenNumber"],
            "status": t.get("status", "waiting"),
            "isYou": is_current,
            "farmerName": t.get("farmerName", "Farmer") if not is_current else "YOU",
            "position": idx + 1
        })
        
    return {
        "tokenId": str(token["_id"]),
        "tokenNumber": token_number,
        "farmerId": token.get("farmerId"),
        "farmerName": token.get("farmerName"),
        "centerId": actual_center_id,
        "centerName": center_name,
        "cropName": token.get("cropName", "Wheat"),
        "quantity": token.get("quantity", 50.0),
        "status": token.get("status", "waiting"),
        "farmersAhead": farmers_ahead,
        "estimatedWaitMinutes": pred["estimated_wait_minutes"] if token.get("status") != "completed" else 0,
        "formattedWaitTime": pred["formatted_wait_time"] if token.get("status") != "completed" else "Completed",
        "activeCounters": active_counters,
        "advice": pred["advice"],
        "nearbyQueue": queue_list[:10],
        "lastUpdated": datetime.utcnow().isoformat()
    }

@router.get("/{token_number}/prediction", response_model=QueuePredictionResponse)
async def get_queue_prediction(token_number: int, centerId: Optional[str] = Query(None)):
    db = get_database()
    query = {"tokenNumber": token_number}
    if centerId:
        query["centerId"] = centerId
        
    token = await db.queue_tokens.find_one(query)
    if not token:
        # Fallback prediction if token not found
        pred = predict_waiting_time(farmers_ahead=12, avg_processing_time=8.0, crop_quantity=50.0, active_counters=2)
        return QueuePredictionResponse(
            tokenNumber=token_number,
            farmersAhead=12,
            estimatedWaitMinutes=pred["estimated_wait_minutes"],
            formattedWaitTime=pred["formatted_wait_time"],
            confidence=pred["confidence"],
            activeCounters=pred["active_counters"],
            modelUsed=pred["model_used"],
            factors=pred["factors"],
            advice=pred["advice"]
        )
        
    actual_center_id = token["centerId"]
    center = await db.procurement_centers.find_one({"_id": ObjectId(actual_center_id)}) if ObjectId.is_valid(actual_center_id) else await db.procurement_centers.find_one({"_id": actual_center_id})
    
    farmers_ahead = await db.queue_tokens.count_documents({
        "centerId": actual_center_id,
        "tokenNumber": {"$lt": token_number},
        "status": {"$in": ["waiting", "arrived", "processing", "verification"]}
    })
    
    active_counters = center.get("activeCounters", 2) if center else 2
    avg_processing = center.get("avgProcessingMinutes", 8) if center else 8
    
    pred = predict_waiting_time(
        farmers_ahead=farmers_ahead,
        avg_processing_time=avg_processing,
        crop_quantity=token.get("quantity", 50.0),
        active_counters=active_counters
    )
    
    return QueuePredictionResponse(
        tokenNumber=token_number,
        farmersAhead=farmers_ahead,
        estimatedWaitMinutes=pred["estimated_wait_minutes"],
        formattedWaitTime=pred["formatted_wait_time"],
        confidence=pred["confidence"],
        activeCounters=pred["active_counters"],
        modelUsed=pred["model_used"],
        factors=pred["factors"],
        advice=pred["advice"]
    )
