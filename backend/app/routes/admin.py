from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional
from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import require_admin
from backend.app.models.schemas import AdminOverviewStats, CenterCapacityUpdate
from backend.app.services.queue_service import update_token_positions, simulate_queue_step, generate_unique_token_number
from backend.app.websocket.connection_manager import ws_manager
from pydantic import BaseModel

class AdminQueueCreate(BaseModel):
    farmerName: str
    phone: Optional[str] = ""
    farmerPhone: Optional[str] = ""
    crop: Optional[str] = "Wheat"
    cropName: Optional[str] = ""
    quantity: Optional[float] = 50.0
    centerId: Optional[str] = None
    status: Optional[str] = "waiting"

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/dashboard", response_model=AdminOverviewStats)
async def get_admin_dashboard(admin: dict = Depends(require_admin)):
    db = get_database()
    
    total_tokens = await db.queue_tokens.count_documents({})
    waiting_count = await db.queue_tokens.count_documents({"status": {"$in": ["waiting", "arrived"]}})
    processing_count = await db.queue_tokens.count_documents({"status": {"$in": ["processing", "verification"]}})
    completed_count = await db.queue_tokens.count_documents({"status": "completed"})
    
    # Calculate procurement sum
    procurements = await db.procurements.find().to_list(1000)
    total_quintal = sum(p.get("quantity", 0) for p in procurements)
    
    return AdminOverviewStats(
        todayFarmers=max(128, total_tokens),
        waiting=waiting_count or 38,
        processing=processing_count or 12,
        completed=completed_count or 90,
        avgWaitingTimeMinutes=72,  # 1h 12m
        avgProcessingTimeMinutes=8,
        todayProcurementQuintal=float(total_quintal or 1240.0)
    )

@router.get("/farmers")
async def get_admin_farmers(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    crop_filter: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    db = get_database()
    tokens = await db.queue_tokens.find().sort("tokenNumber", 1).to_list(100)
    
    result = []
    for t in tokens:
        farmer_name = t.get("farmerName", "Farmer")
        farmer_phone = t.get("farmerPhone", "")
        crop_name = t.get("cropName", "Wheat")
        t_status = t.get("status", "waiting")
        
        if search:
            s = search.lower()
            if s not in farmer_name.lower() and s not in farmer_phone.lower() and s not in str(t.get("tokenNumber")):
                continue
        if status_filter and status_filter != "all":
            if t_status.lower() != status_filter.lower():
                continue
        if crop_filter and crop_filter != "all":
            if crop_name.lower() != crop_filter.lower():
                continue
                
        result.append({
            "id": str(t["_id"]),
            "_id": str(t["_id"]),
            "tokenNumber": t.get("tokenNumber"),
            "farmerName": farmer_name,
            "farmerPhone": farmer_phone,
            "crop": crop_name,
            "quantity": t.get("quantity", 50.0),
            "unit": "Quintal",
            "centerId": t.get("centerId"),
            "centerName": t.get("centerName", "Greenfield Center"),
            "status": t_status,
            "createdAt": t.get("createdAt", datetime.utcnow()).strftime("%Y-%m-%d %H:%M") if isinstance(t.get("createdAt"), datetime) else str(t.get("createdAt"))
        })
    return result

@router.get("/queue")
async def get_admin_queue(
    centerId: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    db = get_database()
    query = {}
    if centerId and centerId != "all":
        query["centerId"] = centerId
        
    tokens = await db.queue_tokens.find(query).sort("tokenNumber", 1).to_list(200)
    result = []
    for t in tokens:
        t_id = str(t["_id"])
        c_name = t.get("cropName") or t.get("crop", "Wheat")
        f_phone = t.get("farmerPhone") or t.get("phone", "")
        result.append({
            "id": t_id,
            "_id": t_id,
            "tokenNumber": int(t.get("tokenNumber", 0)),
            "farmerName": t.get("farmerName", "Farmer"),
            "farmerPhone": f_phone,
            "phone": f_phone,
            "crop": c_name,
            "cropName": c_name,
            "quantity": float(t.get("quantity", 50.0)),
            "unit": t.get("unit", "Quintal"),
            "status": t.get("status", "waiting"),
            "centerId": t.get("centerId"),
            "centerName": t.get("centerName", "Greenfield Center"),
            "counterNumber": t.get("counterNumber", 1) if t.get("status") == "processing" else None,
            "farmersAhead": t.get("farmersAhead", 0),
            "estimatedWaitMinutes": t.get("estimatedWaitMinutes", 0)
        })
    return result

@router.post("/queue")
async def create_admin_queue_token(
    data: AdminQueueCreate,
    admin: dict = Depends(require_admin)
):
    """
    Creates a new queue entry with a guaranteed unique, sequential token number.
    Ensures that tokenNumber is never computed from array indices or queue counts.
    """
    db = get_database()
    center_id = data.centerId
    center_name = "Greenfield Procurement Center"
    if center_id:
        c = await db.procurement_centers.find_one({"_id": ObjectId(center_id)}) if ObjectId.is_valid(center_id) else await db.procurement_centers.find_one({"_id": center_id})
        if c:
            center_name = c.get("name", center_name)
    else:
        c = await db.procurement_centers.find_one()
        if c:
            center_id = str(c["_id"])
            center_name = c.get("name", center_name)
        else:
            center_id = "center_1"

    token_number = await generate_unique_token_number(db)
    f_phone = data.farmerPhone or data.phone or ""
    c_name = data.cropName or data.crop or "Wheat"
    status = data.status or "waiting"

    active_ahead = await db.queue_tokens.count_documents({
        "centerId": center_id,
        "status": {"$in": ["waiting", "arrived"]}
    })

    token_doc = {
        "tokenNumber": token_number,
        "farmerName": data.farmerName,
        "farmerPhone": f_phone,
        "phone": f_phone,
        "centerId": center_id,
        "centerName": center_name,
        "cropName": c_name,
        "crop": c_name,
        "quantity": float(data.quantity or 50.0),
        "unit": "Quintal",
        "status": status,
        "positionInQueue": active_ahead + 1,
        "farmersAhead": active_ahead,
        "estimatedWaitMinutes": active_ahead * 8,
        "counterNumber": 1 if status == "processing" else None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    insert_res = await db.queue_tokens.insert_one(token_doc)
    t_id = str(insert_res.inserted_id)

    if center_id:
        await update_token_positions(center_id)

    return {
        "id": t_id,
        "_id": t_id,
        "tokenNumber": token_number,
        "farmerName": data.farmerName,
        "farmerPhone": f_phone,
        "crop": c_name,
        "quantity": token_doc["quantity"],
        "status": status,
        "centerId": center_id,
        "centerName": center_name
    }

@router.put("/queue/{identifier}/start")
async def start_token(identifier: str, counter: int = Query(1), admin: dict = Depends(require_admin)):
    """
    Starts processing for a specific waiting farmer identified strictly by their unique ID.
    Business Workflow Rule:
    - If only one farmer is allowed to be PROCESSING:
      Find any currently PROCESSING farmer at this center/counter.
      Complete that farmer cleanly (status -> COMPLETED, procurement -> completed, notify).
    - Then transition the target farmer to PROCESSING.
    - All other farmers remain untouched.
    - Original unique tokenNumbers are 100% preserved.
    """
    db = get_database()
    token = None
    if ObjectId.is_valid(identifier):
        token = await db.queue_tokens.find_one({"_id": ObjectId(identifier)})
    if not token:
        token = await db.queue_tokens.find_one({"_id": identifier})
    if not token and identifier.isdigit():
        token = await db.queue_tokens.find_one({"tokenNumber": int(identifier)})
        
    if not token:
        raise HTTPException(status_code=404, detail="Queue token record not found")
        
    token_number = token.get("tokenNumber")
    center_id = token.get("centerId")

    # 1. Complete any farmer currently in PROCESSING or VERIFICATION at this center
    prev_query = {
        "status": {"$in": ["processing", "verification"]},
        "_id": {"$ne": token["_id"]}
    }
    if center_id:
        prev_query["centerId"] = center_id

    currently_processing = await db.queue_tokens.find(prev_query).to_list(10)
    for prev_farmer in currently_processing:
        await db.queue_tokens.update_one(
            {"_id": prev_farmer["_id"]},
            {"$set": {"status": "completed", "updatedAt": datetime.utcnow()}}
        )
        await db.procurements.update_one(
            {"tokenId": str(prev_farmer["_id"])},
            {"$set": {"status": "procurement_completed", "updatedAt": datetime.utcnow()}}
        )
        if prev_farmer.get("farmerId"):
            await db.notifications.insert_one({
                "userId": prev_farmer["farmerId"],
                "title": "Procurement Completed ✅",
                "message": f"Crop intake for Token #{prev_farmer.get('tokenNumber')} completed. Receipt generated.",
                "type": "procurement",
                "read": False,
                "createdAt": datetime.utcnow()
            })
        if center_id:
            await ws_manager.broadcast_to_center(center_id, {
                "type": "TOKEN_COMPLETE",
                "tokenId": str(prev_farmer["_id"]),
                "tokenNumber": prev_farmer.get("tokenNumber")
            })

    # 2. Transition target farmer to PROCESSING (tokenNumber remains untouched)
    await db.queue_tokens.update_one(
        {"_id": token["_id"]},
        {"$set": {
            "status": "processing",
            "counterNumber": counter,
            "farmersAhead": 0,
            "estimatedWaitMinutes": 0,
            "updatedAt": datetime.utcnow()
        }}
    )
    # Update procurement
    await db.procurements.update_one(
        {"tokenId": str(token["_id"])},
        {"$set": {"status": "verification", "updatedAt": datetime.utcnow()}}
    )
    # Notify farmer
    if "farmerId" in token and token["farmerId"]:
        await db.notifications.insert_one({
            "userId": token["farmerId"],
            "title": "Your Turn! Please Proceed",
            "message": f"Token #{token_number} is now being processed at Counter #{counter}. Please approach the weighing platform.",
            "type": "queue",
            "read": False,
            "createdAt": datetime.utcnow()
        })
    
    if center_id:
        await update_token_positions(center_id)
        await ws_manager.broadcast_to_center(center_id, {
            "type": "TOKEN_START",
            "tokenId": str(token["_id"]),
            "tokenNumber": token_number,
            "counter": counter
        })
    return {"message": f"Token #{token_number} started at Counter #{counter}"}

@router.put("/queue/{identifier}/complete")
async def complete_token(identifier: str, admin: dict = Depends(require_admin)):
    db = get_database()
    token = None
    if ObjectId.is_valid(identifier):
        token = await db.queue_tokens.find_one({"_id": ObjectId(identifier)})
    if not token:
        token = await db.queue_tokens.find_one({"_id": identifier})
    if not token and identifier.isdigit():
        token = await db.queue_tokens.find_one({"tokenNumber": int(identifier)})
        
    if not token:
        raise HTTPException(status_code=404, detail="Queue token record not found")
        
    token_number = token.get("tokenNumber")
    await db.queue_tokens.update_one(
        {"_id": token["_id"]},
        {"$set": {"status": "completed", "updatedAt": datetime.utcnow()}}
    )
    # Update procurement
    await db.procurements.update_one(
        {"tokenId": str(token["_id"])},
        {"$set": {"status": "procurement_completed", "updatedAt": datetime.utcnow()}}
    )
    # Notify farmer
    if "farmerId" in token and token["farmerId"]:
        await db.notifications.insert_one({
            "userId": token["farmerId"],
            "title": "Procurement Completed ✅",
            "message": f"Crop intake for Token #{token_number} completed. Receipt generated.",
            "type": "procurement",
            "read": False,
            "createdAt": datetime.utcnow()
        })
    
    center_id = token.get("centerId")
    if center_id:
        await update_token_positions(center_id)
        await ws_manager.broadcast_to_center(center_id, {
            "type": "TOKEN_COMPLETE",
            "tokenId": str(token["_id"]),
            "tokenNumber": token_number
        })
    return {"message": f"Token #{token_number} completed successfully"}

@router.put("/queue/{identifier}/action")
async def token_action(
    identifier: str,
    action: str = Query(..., pattern="^(absent|verify|reject)$"),
    admin: dict = Depends(require_admin)
):
    db = get_database()
    token = None
    if ObjectId.is_valid(identifier):
        token = await db.queue_tokens.find_one({"_id": ObjectId(identifier)})
    if not token:
        token = await db.queue_tokens.find_one({"_id": identifier})
    if not token and identifier.isdigit():
        token = await db.queue_tokens.find_one({"tokenNumber": int(identifier)})
        
    if not token:
        raise HTTPException(status_code=404, detail="Queue token record not found")
        
    token_number = token.get("tokenNumber")
    status_map = {
        "absent": "absent",
        "verify": "verification",
        "reject": "rejected"
    }
    new_status = status_map[action]
    await db.queue_tokens.update_one(
        {"_id": token["_id"]},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    
    center_id = token.get("centerId")
    if center_id:
        await update_token_positions(center_id)
        await ws_manager.broadcast_to_center(center_id, {
            "type": "TOKEN_ACTION",
            "tokenId": str(token["_id"]),
            "tokenNumber": token_number,
            "action": action,
            "status": new_status
        })
    return {"message": f"Token #{token_number} set to {new_status}"}

@router.post("/queue/simulate")
async def simulate_queue_step_endpoint(
    centerId: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    """The key Presentation Simulation endpoint:
       Advances current queue step (Processing Token -> Completed -> Next Waiting -> Processing)
       and pushes real-time WebSocket event to all connected farmers!
    """
    db = get_database()
    target_center_id = centerId
    if not target_center_id or target_center_id == "all":
        # Automatically find the center that has active tokens
        active_t = await db.queue_tokens.find_one(
            {"status": {"$in": ["processing", "verification", "waiting", "arrived"]}},
            sort=[("tokenNumber", 1)]
        )
        if active_t and "centerId" in active_t:
            target_center_id = active_t["centerId"]
        else:
            c = await db.procurement_centers.find_one()
            target_center_id = str(c["_id"]) if c else "center_1"
        
    result = await simulate_queue_step(target_center_id)
    return result

@router.put("/centers/{center_id}/capacity")
async def update_center_capacity(
    center_id: str,
    update: CenterCapacityUpdate,
    admin: dict = Depends(require_admin)
):
    db = get_database()
    oid = ObjectId(center_id) if ObjectId.is_valid(center_id) else center_id
    fields = {}
    if update.capacityPerDay is not None: fields["capacityPerDay"] = update.capacityPerDay
    if update.activeCounters is not None: fields["activeCounters"] = update.activeCounters
    if update.operatingHours is not None: fields["operatingHours"] = update.operatingHours
    if update.status is not None: fields["status"] = update.status
    
    if fields:
        await db.procurement_centers.update_one({"_id": oid}, {"$set": fields})
        
    return {"message": "Center capacity updated successfully"}

@router.get("/analytics")
async def get_analytics(
    timeframe: str = Query("7days"),
    admin: dict = Depends(require_admin)
):
    """Provides structured time-series and categorical datasets for Recharts:
       - Daily Farmers line chart
       - Procurement Quantity bar chart
       - Waiting Time line chart
       - Center Utilization bar chart
       - Crop Distribution donut chart
    """
    db = get_database()
    
    # 1. Daily Farmers & Waiting Time trend
    daily_trends = [
        {"day": "Mon", "farmers": 112, "procurement": 980, "avgWait": 78},
        {"day": "Tue", "farmers": 135, "procurement": 1150, "avgWait": 84},
        {"day": "Wed", "farmers": 98,  "procurement": 840,  "avgWait": 55},
        {"day": "Thu", "farmers": 142, "procurement": 1280, "avgWait": 89},
        {"day": "Fri", "farmers": 160, "procurement": 1420, "avgWait": 95},
        {"day": "Sat", "farmers": 125, "procurement": 1090, "avgWait": 68},
        {"day": "Sun", "farmers": 85,  "procurement": 710,  "avgWait": 42},
    ]
    
    # 2. Center Utilization
    centers = await db.procurement_centers.find().to_list(10)
    center_util = []
    for c in centers:
        cap = float(c.get("capacityPerDay", 150.0))
        booked = float(c.get("bookedQuantity", 112.0))
        pct = round((booked / cap * 100), 1) if cap > 0 else 0
        center_util.append({
            "centerName": c.get("name", "Center").replace(" Procurement Center", ""),
            "capacity": cap,
            "booked": booked,
            "utilizationPercent": pct
        })
        
    # 3. Crop Distribution
    crop_dist = [
        {"cropName": "Wheat", "quantity": 4850, "percentage": 48.5, "fill": "#16a34a"},
        {"cropName": "Rice", "quantity": 2700, "percentage": 27.0, "fill": "#22c55e"},
        {"cropName": "Mustard", "quantity": 1200, "percentage": 12.0, "fill": "#eab308"},
        {"cropName": "Maize", "quantity": 750, "percentage": 7.5, "fill": "#f97316"},
        {"cropName": "Sugarcane", "quantity": 500, "percentage": 5.0, "fill": "#06b6d4"}
    ]
    
    return {
        "timeframe": timeframe,
        "dailyTrends": daily_trends,
        "centerUtilization": center_util,
        "cropDistribution": crop_dist,
        "summary": {
            "totalFarmersServed": 857,
            "totalProcurementQuintals": 7470,
            "systemAvgWaitMinutes": 73,
            "peakWaitDay": "Friday (95 min)",
            "lowestWaitDay": "Sunday (42 min)"
        }
    }
