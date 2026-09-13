from datetime import datetime
from bson import ObjectId
from typing import Dict, Any, List
from pymongo import ReturnDocument
from backend.app.database.connection import get_database
from backend.app.websocket.connection_manager import ws_manager
from backend.ml.predict import predict_waiting_time

async def generate_unique_token_number(db) -> int:
    """
    Generates a globally unique, sequential, permanent token number.
    Ensures that token generation is safe against duplicate creation and race conditions:
    1. Finds highest existing tokenNumber in queue_tokens.
    2. Synchronizes atomic sequence counter to at least highest_existing.
    3. Atomically increments and returns the new unique token number.
    """
    # 1. Find the highest existing tokenNumber across the entire collection
    latest_token = await db.queue_tokens.find_one({}, sort=[("tokenNumber", -1)])
    highest_existing = int(latest_token["tokenNumber"]) if (latest_token and "tokenNumber" in latest_token) else 0

    # 2. Ensure atomic counter is synchronized to at least highest_existing
    await db.counters.update_one(
        {"_id": "queue_token_number"},
        {"$max": {"seq": highest_existing}},
        upsert=True
    )

    # 3. Atomically increment and return the next sequential token number
    counter_doc = await db.counters.find_one_and_update(
        {"_id": "queue_token_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return int(counter_doc["seq"])

async def init_queue_indexes(db):
    """Initializes necessary database indexes to enforce token uniqueness."""
    try:
        await db.queue_tokens.create_index("tokenNumber", unique=True)
        print("Ensured unique index on queue_tokens.tokenNumber")
    except Exception as e:
        print(f"Index initialization notice: {e}")

async def get_center_queue_stats(center_id: str) -> Dict[str, Any]:
    db = get_database()
    active_tokens = await db.queue_tokens.find({
        "centerId": center_id,
        "status": {"$in": ["waiting", "processing", "arrived", "verification"]}
    }).sort("tokenNumber", 1).to_list(100)
    
    processing_tokens = [t for t in active_tokens if t.get("status") in ["processing", "verification"]]
    waiting_tokens = [t for t in active_tokens if t.get("status") in ["waiting", "arrived"]]
    
    center = await db.procurement_centers.find_one({"_id": ObjectId(center_id)}) if ObjectId.is_valid(center_id) else await db.procurement_centers.find_one({"_id": center_id})
    active_counters = center.get("activeCounters", 2) if center else 2
    avg_processing = center.get("avgProcessingMinutes", 8) if center else 8
    
    return {
        "total_active": len(active_tokens),
        "processing_count": len(processing_tokens),
        "waiting_count": len(waiting_tokens),
        "active_counters": active_counters,
        "avg_processing_time": avg_processing,
        "active_tokens": active_tokens
    }

async def update_token_positions(center_id: str):
    """Recalculates positions and estimated wait times for all waiting tokens in a center"""
    db = get_database()
    active_tokens = await db.queue_tokens.find({
        "centerId": center_id,
        "status": {"$in": ["waiting", "arrived"]}
    }).sort("tokenNumber", 1).to_list(100)
    
    center = await db.procurement_centers.find_one({"_id": ObjectId(center_id)}) if ObjectId.is_valid(center_id) else await db.procurement_centers.find_one({"_id": center_id})
    active_counters = center.get("activeCounters", 2) if center else 2
    avg_processing = center.get("avgProcessingMinutes", 8) if center else 8
    
    for idx, token in enumerate(active_tokens):
        farmers_ahead = idx
        prediction = predict_waiting_time(
            farmers_ahead=farmers_ahead,
            avg_processing_time=avg_processing,
            crop_quantity=token.get("quantity", 50.0),
            active_counters=active_counters
        )
        
        await db.queue_tokens.update_one(
            {"_id": token["_id"]},
            {"$set": {
                "positionInQueue": idx + 1,
                "farmersAhead": farmers_ahead,
                "estimatedWaitMinutes": prediction["estimated_wait_minutes"],
                "updatedAt": datetime.utcnow()
            }}
        )

async def simulate_queue_step(center_id: str) -> Dict[str, Any]:
    """Advances the queue for live presentation demos:
       - Completes the currently processing token
       - Sets the next waiting token to processing
       - Updates farmer procurement status
       - Pushes notifications
       - Broadcasts WebSocket update
    """
    db = get_database()
    
    # 1. Find currently processing token
    processing_token = await db.queue_tokens.find_one({
        "centerId": center_id,
        "status": {"$in": ["processing", "verification"]}
    }, sort=[("tokenNumber", 1)])
    
    completed_token_num = None
    if processing_token:
        completed_token_num = processing_token["tokenNumber"]
        await db.queue_tokens.update_one(
            {"_id": processing_token["_id"]},
            {"$set": {"status": "completed", "updatedAt": datetime.utcnow()}}
        )
        # Update associated procurement record
        await db.procurements.update_one(
            {"tokenId": str(processing_token["_id"])},
            {"$set": {
                "status": "procurement_completed",
                "updatedAt": datetime.utcnow()
            }}
        )
        # Add completion notification
        if processing_token.get("farmerId"):
            await db.notifications.insert_one({
                "userId": processing_token["farmerId"],
                "title": "Procurement Completed",
                "message": f"Your crop procurement for Token #{processing_token['tokenNumber']} has been successfully completed! Payment processing initiated.",
                "type": "procurement",
                "read": False,
                "createdAt": datetime.utcnow()
            })
    
    # 2. Find next waiting token to transition to processing
    next_token = await db.queue_tokens.find_one({
        "centerId": center_id,
        "status": {"$in": ["waiting", "arrived"]}
    }, sort=[("tokenNumber", 1)])
    
    new_processing_num = None
    if next_token:
        new_processing_num = next_token["tokenNumber"]
        await db.queue_tokens.update_one(
            {"_id": next_token["_id"]},
            {"$set": {
                "status": "processing",
                "counterNumber": 1,
                "farmersAhead": 0,
                "estimatedWaitMinutes": 0,
                "updatedAt": datetime.utcnow()
            }}
        )
        # Update procurement record to verification
        await db.procurements.update_one(
            {"tokenId": str(next_token["_id"])},
            {"$set": {
                "status": "verification",
                "updatedAt": datetime.utcnow()
            }}
        )
        # Notify farmer their turn has arrived
        if next_token.get("farmerId"):
            await db.notifications.insert_one({
                "userId": next_token["farmerId"],
                "title": "Your Turn! Please Proceed",
                "message": f"Token #{next_token['tokenNumber']} is now being called to Counter 1 for inspection and weighing.",
                "type": "queue",
                "read": False,
                "createdAt": datetime.utcnow()
            })
    
    # 3. Recalculate remaining queue positions
    await update_token_positions(center_id)
    
    # 4. Fetch updated active queue to broadcast
    active_tokens = await db.queue_tokens.find({
        "centerId": center_id,
        "status": {"$in": ["processing", "waiting", "arrived", "verification"]}
    }).sort("tokenNumber", 1).to_list(15)
    
    # Convert ObjectIds to strings
    for t in active_tokens:
        t["id"] = str(t["_id"])
        del t["_id"]
        if "createdAt" in t and isinstance(t["createdAt"], datetime):
            t["createdAt"] = t["createdAt"].isoformat()
        if "updatedAt" in t and isinstance(t["updatedAt"], datetime):
            t["updatedAt"] = t["updatedAt"].isoformat()
    
    broadcast_payload = {
        "type": "QUEUE_UPDATE",
        "centerId": center_id,
        "completedToken": completed_token_num,
        "nowProcessing": new_processing_num,
        "activeQueue": active_tokens,
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"Queue advanced! Token #{completed_token_num or 'N/A'} completed, Token #{new_processing_num or 'N/A'} now processing."
    }
    
    # Broadcast through WebSockets to all connected farmers and admins
    await ws_manager.broadcast_to_center(center_id, broadcast_payload)
    
    return broadcast_payload
