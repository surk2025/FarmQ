from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from typing import List
from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import get_current_user
from backend.app.models.schemas import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["id"]
    notes = await db.notifications.find({"userId": user_id}).sort("createdAt", -1).to_list(30)
    
    result = []
    for n in notes:
        result.append(NotificationResponse(
            id=str(n["_id"]),
            userId=user_id,
            title=n.get("title", "Notification"),
            message=n.get("message", ""),
            type=n.get("type", "system"),
            read=n.get("read", False),
            createdAt=n.get("createdAt")
        ))
    return result

@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    oid = ObjectId(notification_id) if ObjectId.is_valid(notification_id) else notification_id
    await db.notifications.update_one(
        {"_id": oid, "userId": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@router.put("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_database()
    await db.notifications.update_many(
        {"userId": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}
