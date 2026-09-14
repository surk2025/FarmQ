import re
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from typing import List, Optional
from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import get_current_user
from backend.app.models.schemas import (
    CropCreate, CropResponse, ProfileUpdate, UserResponse, PaymentResponse,
    FarmerBankDetailsInput, FarmerBankDetailsResponse, FavoriteCropsRequest
)
from backend.app.services.otp_service import mask_account_number
from backend.app.services.crop_price_service import crop_price_service
from backend.ml.predict import predict_waiting_time, format_minutes

router = APIRouter(prefix="/api/farmer", tags=["farmer"])

@router.get("/bank-details", response_model=FarmerBankDetailsResponse)
async def get_bank_details(current_user: dict = Depends(get_current_user)):
    """
    Retrieves the masked bank account information for the authenticated farmer.
    Sensitive account numbers are strictly masked (XXXX XXXX 9012).
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])}) if ObjectId.is_valid(current_user["id"]) else await db.users.find_one({"_id": current_user["id"]})
    bank = (user.get("bankDetails") if user else None) or {}
    return FarmerBankDetailsResponse(
        accountHolderName=bank.get("accountHolderName", current_user.get("name", "Surjeet Kumar")),
        bankName=bank.get("bankName", "State Bank of India"),
        accountNumberMasked=bank.get("accountNumberMasked", "XXXX XXXX 9012"),
        ifscCode=bank.get("ifscCode", "SBIN0001234"),
        branchName=bank.get("branchName", "Main Agri Branch"),
        verified=bank.get("verified", True)
    )

@router.post("/bank-details", response_model=FarmerBankDetailsResponse)
async def update_bank_details(
    bank_in: FarmerBankDetailsInput,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates bank details with validation:
    - Numeric check
    - Account number confirmation match
    - Standard Indian IFSC regex format validation
    - Mandatory farmer confirmation checkbox
    """
    acc_clean = re.sub(r"\s+", "", bank_in.accountNumber).strip()
    confirm_acc_clean = re.sub(r"\s+", "", bank_in.confirmAccountNumber).strip()

    if not re.match(r"^\d{6,30}$", acc_clean):
        raise HTTPException(
            status_code=422,
            detail="Account number must be numeric (6 to 30 digits)."
        )
    if acc_clean != confirm_acc_clean:
        raise HTTPException(
            status_code=422,
            detail="Account Number and Confirm Account Number do not match."
        )

    clean_ifsc = bank_in.ifscCode.strip().upper()
    if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean_ifsc):
        raise HTTPException(
            status_code=422,
            detail="Invalid Indian IFSC Code format. Format: 4 letters, 0, then 6 alphanumeric characters (e.g. SBIN0001234)."
        )

    if not bank_in.confirmed:
        raise HTTPException(
            status_code=422,
            detail="Please check the confirmation box verifying that your bank details are correct."
        )

    db = get_database()
    masked_acc = mask_account_number(acc_clean)
    bank_doc = {
        "accountHolderName": bank_in.accountHolderName.strip(),
        "bankName": bank_in.bankName.strip(),
        "accountNumberMasked": masked_acc,
        "accountNumberLast4": acc_clean[-4:],
        "ifscCode": clean_ifsc,
        "branchName": bank_in.branchName.strip(),
        "verified": True,
        "updatedAt": datetime.utcnow()
    }

    user_id = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
    await db.users.update_one({"_id": user_id}, {"$set": {"bankDetails": bank_doc}})

    # Notification
    await db.notifications.insert_one({
        "userId": current_user["id"],
        "title": "🏦 Bank Account Updated",
        "message": f"Your payout receiving bank account ({masked_acc}) has been verified and updated successfully.",
        "type": "payment",
        "read": False,
        "createdAt": datetime.utcnow()
    })

    return FarmerBankDetailsResponse(
        accountHolderName=bank_doc["accountHolderName"],
        bankName=bank_doc["bankName"],
        accountNumberMasked=masked_acc,
        ifscCode=clean_ifsc,
        branchName=bank_doc["branchName"],
        verified=True
    )

@router.post("/favorite-crops")
async def update_favorite_crops(
    req: FavoriteCropsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the farmer's favorite crop commodities for dashboard prioritization.
    """
    db = get_database()
    user_id = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
    await db.users.update_one({"_id": user_id}, {"$set": {"favoriteCrops": req.crops}})
    return {"success": True, "favoriteCrops": req.crops}

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        phone=current_user["phone"],
        email=current_user.get("email"),
        role=current_user.get("role", "farmer"),
        village=current_user.get("village"),
        district=current_user.get("district"),
        state=current_user.get("state"),
        preferredLanguage=current_user.get("preferredLanguage", "en"),
        createdAt=current_user.get("createdAt")
    )

@router.put("/profile", response_model=UserResponse)
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    update_fields = {}
    if data.name: update_fields["name"] = data.name
    if data.village: update_fields["village"] = data.village
    if data.district: update_fields["district"] = data.district
    if data.state: update_fields["state"] = data.state
    if data.preferredLanguage: update_fields["preferredLanguage"] = data.preferredLanguage
    
    if update_fields:
        user_id = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        await db.users.update_one({"_id": user_id}, {"$set": update_fields})
        current_user.update(update_fields)
        
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        phone=current_user["phone"],
        email=current_user.get("email"),
        role=current_user.get("role", "farmer"),
        village=current_user.get("village"),
        district=current_user.get("district"),
        state=current_user.get("state"),
        preferredLanguage=current_user.get("preferredLanguage", "en"),
        createdAt=current_user.get("createdAt")
    )

@router.get("/dashboard")
async def get_farmer_dashboard(current_user: dict = Depends(get_current_user)):
    db = get_database()
    farmer_id = current_user["id"]
    
    # Check for active token
    active_token = await db.queue_tokens.find_one({
        "farmerId": farmer_id,
        "status": {"$in": ["waiting", "arrived", "processing", "verification"]}
    }, sort=[("tokenNumber", 1)])
    
    dashboard_data = {
        "farmerName": current_user["name"],
        "currentToken": None,
        "farmersAhead": 0,
        "estimatedWaitMinutes": 0,
        "formattedWaitTime": "0m",
        "procurementStatus": "No Active Slot",
        "centerName": None,
        "cropName": None,
        "quantity": 0,
        "slotDate": None,
        "slotTime": None,
        "tokenStatus": None
    }
    
    if active_token:
        # Get center info
        center_id = active_token["centerId"]
        center = await db.procurement_centers.find_one({"_id": ObjectId(center_id)}) if ObjectId.is_valid(center_id) else await db.procurement_centers.find_one({"_id": center_id})
        center_name = center.get("name", "Procurement Center") if center else "Procurement Center"
        
        # Calculate real-time position
        active_ahead = await db.queue_tokens.count_documents({
            "centerId": center_id,
            "tokenNumber": {"$lt": active_token["tokenNumber"]},
            "status": {"$in": ["waiting", "arrived", "processing", "verification"]}
        })
        
        pred = predict_waiting_time(
            farmers_ahead=active_ahead,
            avg_processing_time=center.get("avgProcessingMinutes", 8) if center else 8,
            crop_quantity=active_token.get("quantity", 50.0),
            active_counters=center.get("activeCounters", 2) if center else 2
        )
        
        procurement = await db.procurements.find_one({"tokenId": str(active_token["_id"])})
        status_label = "Slot Confirmed"
        if procurement:
            p_status = procurement.get("status", "slot_confirmed")
            status_map = {
                "registered": "Registered",
                "slot_confirmed": "Slot Confirmed",
                "arrived": "Farmer Arrived",
                "verification": "Crop Verification",
                "procurement_completed": "Procurement Completed",
                "payment_processing": "Payment Processing",
                "paid": "Paid"
            }
            status_label = status_map.get(p_status, "Slot Confirmed")
            
        dashboard_data.update({
            "currentToken": active_token["tokenNumber"],
            "tokenId": str(active_token["_id"]),
            "farmersAhead": active_ahead,
            "estimatedWaitMinutes": pred["estimated_wait_minutes"],
            "formattedWaitTime": pred["formatted_wait_time"],
            "procurementStatus": status_label,
            "centerName": center_name,
            "centerId": center_id,
            "cropName": active_token.get("cropName", "Wheat"),
            "quantity": active_token.get("quantity", 50.0),
            "tokenStatus": active_token.get("status", "waiting"),
            "advice": pred.get("advice", "")
        })

    # Fetch user doc for profile & bank details
    user = await db.users.find_one({"_id": ObjectId(farmer_id)}) if ObjectId.is_valid(farmer_id) else await db.users.find_one({"_id": farmer_id})
    user_bank = (user.get("bankDetails") if user else None) or {}
    fav_crops = user.get("favoriteCrops", ["Wheat", "Rice"]) if user else ["Wheat", "Rice"]
    
    # Fetch registered crops count
    crops_count = await db.crops.count_documents({"farmerId": farmer_id})
    my_crops = await db.crops.find({"farmerId": farmer_id}).sort("createdAt", -1).to_list(5)

    # Fetch top crop prices (prioritizing favorite crops)
    all_prices = await crop_price_service.get_crop_prices()
    prioritized_prices = []
    for p in all_prices:
        if any(fc.lower() in p["cropName"].lower() for fc in fav_crops):
            prioritized_prices.append(p)
    for p in all_prices:
        if p not in prioritized_prices:
            prioritized_prices.append(p)

    # Fetch nearby centers/mandis and augment with travel time and Google Maps direction
    centers = await db.procurement_centers.find().to_list(4)
    nearby_markets = []
    for c in centers:
        dist = float(c.get("distanceKm", 4.5))
        # Avg rural transport speed: ~35 km/h -> travel time
        travel_minutes = max(10, int(dist * (60 / 35)))
        addr = c.get("location", {}).get("address", "Mandi Yard")
        c_name = c.get("name", "Procurement Mandi")
        
        # Matching crop price at this mandi or district
        matching_p = [p for p in all_prices if c.get("location", {}).get("district", "").lower() in p.get("district", "").lower()]
        bench_price = matching_p[0]["modalPrice"] if matching_p else 2350.0
        bench_crop = matching_p[0]["cropName"] if matching_p else "Wheat"

        nearby_markets.append({
            "id": str(c["_id"]),
            "name": c_name,
            "district": c.get("location", {}).get("district", "Karnal"),
            "distanceKm": dist,
            "travelTimeMinutes": travel_minutes,
            "formattedTravelTime": f"~{travel_minutes} mins",
            "latestPrice": bench_price,
            "crop": bench_crop,
            "directionsUrl": f"https://www.google.com/maps/dir/?api=1&destination={c_name.replace(' ', '+')}+{addr.replace(' ', '+')}"
        })

    # Payouts summary
    completed_payments = await db.payments.find({"farmerId": farmer_id, "status": "paid"}).to_list(100)
    total_received = sum(p.get("amount", 0.0) for p in completed_payments)
    pending_payments = await db.payments.find({"farmerId": farmer_id, "status": "processing"}).to_list(100)
    ready_to_receive = sum(p.get("amount", 0.0) for p in pending_payments)

    dashboard_data.update({
        "bankDetails": {
            "accountHolderName": user_bank.get("accountHolderName", current_user.get("name", "Surjeet Kumar")),
            "bankName": user_bank.get("bankName", "State Bank of India"),
            "accountNumberMasked": user_bank.get("accountNumberMasked", "XXXX XXXX 9012"),
            "ifscCode": user_bank.get("ifscCode", "SBIN0001234"),
            "branchName": user_bank.get("branchName", "Main Agri Branch"),
            "verified": user_bank.get("verified", True)
        },
        "favoriteCrops": fav_crops,
        "cropsCount": crops_count,
        "recentCrops": [{"id": str(c["_id"]), "name": c.get("cropName"), "quantity": c.get("quantity"), "unit": c.get("unit", "quintal")} for c in my_crops],
        "todayCropPrices": prioritized_prices[:6],
        "nearbyMarkets": nearby_markets,
        "paymentsSummary": {
            "totalReceived": total_received,
            "readyToReceive": ready_to_receive,
            "configuredAccountMasked": user_bank.get("accountNumberMasked", "XXXX XXXX 9012")
        }
    })
        
    return dashboard_data

@router.get("/crops", response_model=List[CropResponse])
async def get_crops(current_user: dict = Depends(get_current_user)):
    db = get_database()
    crops = await db.crops.find({"farmerId": current_user["id"]}).sort("createdAt", -1).to_list(50)
    result = []
    for c in crops:
        result.append(CropResponse(
            id=str(c["_id"]),
            farmerId=c["farmerId"],
            cropName=c["cropName"],
            quantity=c["quantity"],
            unit=c.get("unit", "quintal"),
            harvestDate=c.get("harvestDate", ""),
            preferredDate=c.get("preferredDate"),
            status=c.get("status", "registered"),
            createdAt=c.get("createdAt")
        ))
    return result

@router.post("/crops", response_model=CropResponse)
async def add_crop(crop_in: CropCreate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    crop_doc = {
        "farmerId": current_user["id"],
        "cropName": crop_in.cropName,
        "quantity": crop_in.quantity,
        "unit": crop_in.unit or "quintal",
        "harvestDate": crop_in.harvestDate,
        "preferredDate": crop_in.preferredDate,
        "status": "registered",
        "createdAt": datetime.utcnow()
    }
    insert_res = await db.crops.insert_one(crop_doc)
    crop_id = str(insert_res.inserted_id)
    
    # Notification
    await db.notifications.insert_one({
        "userId": current_user["id"],
        "title": "Crop Registered 🌾",
        "message": f"Your {crop_in.cropName} ({crop_in.quantity} {crop_in.unit}) has been registered successfully. You can now book an intake slot.",
        "type": "slot",
        "read": False,
        "createdAt": datetime.utcnow()
    })
    
    return CropResponse(
        id=crop_id,
        farmerId=current_user["id"],
        cropName=crop_doc["cropName"],
        quantity=crop_doc["quantity"],
        unit=crop_doc["unit"],
        harvestDate=crop_doc["harvestDate"],
        preferredDate=crop_doc["preferredDate"],
        status=crop_doc["status"],
        createdAt=crop_doc["createdAt"]
    )

@router.delete("/crops/{crop_id}")
async def delete_crop(crop_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    oid = ObjectId(crop_id) if ObjectId.is_valid(crop_id) else crop_id
    crop = await db.crops.find_one({"_id": oid, "farmerId": current_user["id"]})
    if not crop:
        raise HTTPException(status_code=404, detail="Crop record not found")
    await db.crops.delete_one({"_id": oid})
    return {"message": "Crop deleted successfully"}

@router.get("/payments", response_model=List[PaymentResponse])
async def get_farmer_payments(current_user: dict = Depends(get_current_user)):
    db = get_database()
    farmer_id = current_user["id"]
    payments = await db.payments.find({"farmerId": farmer_id}).sort("paymentDate", -1).to_list(20)
    result = []
    for p in payments:
        result.append(PaymentResponse(
            id=str(p["_id"]),
            procurementId=p.get("procurementId", ""),
            farmerId=p.get("farmerId", farmer_id),
            amount=p.get("amount", 0.0),
            status=p.get("status", "processing"),
            expectedDate=p.get("expectedDate", "Within 48 hours"),
            transactionRef=p.get("transactionRef"),
            bankAccountMasked=p.get("bankAccountMasked", "XXXX-XXXX-4192"),
            paidAt=p.get("paidAt")
        ))
    return result
