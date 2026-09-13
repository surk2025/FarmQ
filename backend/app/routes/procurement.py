from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import List
from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import get_current_user, require_admin
from backend.app.models.schemas import ProcurementResponse, ProcurementStatusUpdate, TimelineStep

router = APIRouter(prefix="/api/procurement", tags=["procurement"])

STATUS_ORDER = [
    ("registered", "Registration"),
    ("slot_confirmed", "Slot Confirmed"),
    ("arrived", "Farmer Arrived"),
    ("verification", "Crop Verification"),
    ("procurement_completed", "Procurement Completed"),
    ("payment_processing", "Payment Processing"),
    ("paid", "Payment Completed")
]

def build_timeline(current_status: str, existing_timeline: list = None) -> List[TimelineStep]:
    status_keys = [s[0] for s in STATUS_ORDER]
    curr_idx = status_keys.index(current_status) if current_status in status_keys else 1
    
    timestamp_map = {}
    if existing_timeline:
        for item in existing_timeline:
            if isinstance(item, dict) and item.get("timestamp"):
                timestamp_map[item["status"]] = item["timestamp"]
                
    timeline = []
    for idx, (s_key, label) in enumerate(STATUS_ORDER):
        completed = (idx < curr_idx)
        current = (idx == curr_idx)
        ts = timestamp_map.get(s_key)
        if (completed or current) and not ts:
            ts = datetime.utcnow().strftime("%d %b, %I:%M %p")
            
        timeline.append(TimelineStep(
            status=s_key,
            label=label,
            timestamp=ts if (completed or current) else None,
            completed=completed,
            current=current
        ))
    return timeline

@router.get("/farmer", response_model=List[ProcurementResponse])
async def get_farmer_procurements(current_user: dict = Depends(get_current_user)):
    db = get_database()
    farmer_id = current_user["id"]
    procurements = await db.procurements.find({"farmerId": farmer_id}).sort("createdAt", -1).to_list(50)
    
    result = []
    for p in procurements:
        curr_status = p.get("status", "slot_confirmed")
        timeline = build_timeline(curr_status, p.get("timeline"))
        result.append(ProcurementResponse(
            id=str(p["_id"]),
            tokenId=str(p.get("tokenId", "")),
            farmerId=p.get("farmerId", farmer_id),
            farmerName=p.get("farmerName", current_user["name"]),
            cropName=p.get("cropName", "Wheat"),
            quantity=float(p.get("quantity", 50.0)),
            unit=p.get("unit", "quintal"),
            centerId=str(p.get("centerId", "")),
            centerName=p.get("centerName", "Procurement Center"),
            status=curr_status,
            ratePerQuintal=float(p.get("ratePerQuintal", 2275.0)),
            totalAmount=float(p.get("totalAmount", 113750.0)),
            timeline=timeline,
            createdAt=p.get("createdAt"),
            updatedAt=p.get("updatedAt")
        ))
    return result

@router.get("/{procurement_id}", response_model=ProcurementResponse)
async def get_procurement(procurement_id: str):
    db = get_database()
    oid = ObjectId(procurement_id) if ObjectId.is_valid(procurement_id) else procurement_id
    p = await db.procurements.find_one({"_id": oid})
    if not p:
        raise HTTPException(status_code=404, detail="Procurement record not found")
        
    curr_status = p.get("status", "slot_confirmed")
    timeline = build_timeline(curr_status, p.get("timeline"))
    return ProcurementResponse(
        id=str(p["_id"]),
        tokenId=str(p.get("tokenId", "")),
        farmerId=p.get("farmerId", ""),
        farmerName=p.get("farmerName", "Farmer"),
        cropName=p.get("cropName", "Wheat"),
        quantity=float(p.get("quantity", 50.0)),
        unit=p.get("unit", "quintal"),
        centerId=str(p.get("centerId", "")),
        centerName=p.get("centerName", "Procurement Center"),
        status=curr_status,
        ratePerQuintal=float(p.get("ratePerQuintal", 2275.0)),
        totalAmount=float(p.get("totalAmount", 113750.0)),
        timeline=timeline,
        createdAt=p.get("createdAt"),
        updatedAt=p.get("updatedAt")
    )

@router.put("/{procurement_id}/status", response_model=ProcurementResponse)
async def update_procurement_status(
    procurement_id: str,
    update: ProcurementStatusUpdate,
    admin: dict = Depends(require_admin)
):
    db = get_database()
    oid = ObjectId(procurement_id) if ObjectId.is_valid(procurement_id) else procurement_id
    p = await db.procurements.find_one({"_id": oid})
    if not p:
        raise HTTPException(status_code=404, detail="Procurement record not found")
        
    new_timeline = build_timeline(update.status, p.get("timeline"))
    timeline_dicts = [t.dict() for t in new_timeline]
    
    await db.procurements.update_one(
        {"_id": oid},
        {"$set": {
            "status": update.status,
            "timeline": timeline_dicts,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    # Notify farmer of status progression
    status_label_map = dict(STATUS_ORDER)
    label = status_label_map.get(update.status, update.status)
    await db.notifications.insert_one({
        "userId": p["farmerId"],
        "title": f"Procurement Status: {label}",
        "message": f"Your {p.get('cropName')} lot of {p.get('quantity')} Quintals is now at stage: '{label}'.",
        "type": "procurement",
        "read": False,
        "createdAt": datetime.utcnow()
    })
    
    # If completed, update payment to paid or processing
    if update.status == "paid":
        await db.payments.update_one(
            {"procurementId": str(p["_id"])},
            {"$set": {
                "status": "paid",
                "paidAt": datetime.utcnow(),
                "transactionRef": f"DBT-{datetime.now().strftime('%Y%m%d%H%M')}-{p.get('quantity', 0):.0f}"
            }}
        )
        
    p["status"] = update.status
    p["timeline"] = timeline_dicts
    return ProcurementResponse(
        id=str(p["_id"]),
        tokenId=str(p.get("tokenId", "")),
        farmerId=p.get("farmerId", ""),
        farmerName=p.get("farmerName", "Farmer"),
        cropName=p.get("cropName", "Wheat"),
        quantity=float(p.get("quantity", 50.0)),
        unit=p.get("unit", "quintal"),
        centerId=str(p.get("centerId", "")),
        centerName=p.get("centerName", "Procurement Center"),
        status=update.status,
        ratePerQuintal=float(p.get("ratePerQuintal", 2275.0)),
        totalAmount=float(p.get("totalAmount", 113750.0)),
        timeline=new_timeline,
        createdAt=p.get("createdAt"),
        updatedAt=datetime.utcnow()
    )
