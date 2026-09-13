import secrets
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, status

from backend.app.database.connection import get_database
from backend.app.auth.jwt_handler import get_current_user, require_admin
from backend.app.models.schemas import (
    PaymentResponse,
    PaymentReceivingAccount,
    PaymentReceivingAccountUpdate,
    ClaimPayoutRequest,
    GenerateQrRequest,
    GenerateQrResponse,
    PaymentReceiptResponse
)

router = APIRouter(prefix="/api/payments", tags=["payments"])

@router.get("/receiving-account", response_model=PaymentReceivingAccount)
async def get_receiving_account(current_user: dict = Depends(get_current_user)):
    """
    Retrieves the farmer's configured payment receiving account.
    Returns default verified profile if not configured yet.
    """
    db = get_database()
    user_id = current_user["id"]
    record = await db.payment_accounts.find_one({"userId": user_id})
    
    if not record:
        user_name = current_user.get("name", "Farmer")
        user_phone = current_user.get("phone", "")
        clean_phone = user_phone[-10:] if user_phone else "9812000025"
        
        default_account = {
            "userId": user_id,
            "upiId": f"{clean_phone}@okhdfcbank",
            "accountNumber": f"50100{clean_phone[-6:]}172",
            "accountHolderName": user_name,
            "ifscCode": "HDFC0000240",
            "bankName": "HDFC Bank (Mandi Branch)",
            "preferredMode": "upi",
            "isVerified": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        await db.payment_accounts.insert_one(default_account)
        record = default_account

    return PaymentReceivingAccount(
        upiId=record.get("upiId", "farmer@okhdfcbank"),
        accountNumber=record.get("accountNumber", "501004928172"),
        accountHolderName=record.get("accountHolderName", current_user.get("name", "Farmer")),
        ifscCode=record.get("ifscCode", "HDFC0000240"),
        bankName=record.get("bankName", "HDFC Bank (Mandi Branch)"),
        preferredMode=record.get("preferredMode", "upi"),
        isVerified=record.get("isVerified", True)
    )

@router.post("/receiving-account", response_model=PaymentReceivingAccount)
async def update_receiving_account(
    update_data: PaymentReceivingAccountUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates the farmer's payment receiving preferences (UPI ID, Bank A/C, IFSC).
    """
    db = get_database()
    user_id = current_user["id"]

    existing = await db.payment_accounts.find_one({"userId": user_id})
    update_fields = {"updatedAt": datetime.utcnow()}

    if update_data.upiId is not None:
        update_fields["upiId"] = update_data.upiId.strip()
    if update_data.accountNumber is not None:
        update_fields["accountNumber"] = update_data.accountNumber.strip()
    if update_data.accountHolderName is not None:
        update_fields["accountHolderName"] = update_data.accountHolderName.strip()
    if update_data.ifscCode is not None:
        update_fields["ifscCode"] = update_data.ifscCode.strip().upper()
    if update_data.bankName is not None:
        update_fields["bankName"] = update_data.bankName.strip()
    if update_data.preferredMode is not None:
        update_fields["preferredMode"] = update_data.preferredMode.strip()

    update_fields["isVerified"] = True

    if existing:
        await db.payment_accounts.update_one({"userId": user_id}, {"$set": update_fields})
        merged = {**existing, **update_fields}
    else:
        new_doc = {
            "userId": user_id,
            "upiId": update_fields.get("upiId", "farmer@okhdfcbank"),
            "accountNumber": update_fields.get("accountNumber", "501004928172"),
            "accountHolderName": update_fields.get("accountHolderName", current_user.get("name", "Farmer")),
            "ifscCode": update_fields.get("ifscCode", "HDFC0000240"),
            "bankName": update_fields.get("bankName", "HDFC Bank (Mandi Branch)"),
            "preferredMode": update_fields.get("preferredMode", "upi"),
            "isVerified": True,
            "createdAt": datetime.utcnow(),
            **update_fields
        }
        await db.payment_accounts.insert_one(new_doc)
        merged = new_doc

    return PaymentReceivingAccount(
        upiId=merged.get("upiId"),
        accountNumber=merged.get("accountNumber"),
        accountHolderName=merged.get("accountHolderName"),
        ifscCode=merged.get("ifscCode"),
        bankName=merged.get("bankName"),
        preferredMode=merged.get("preferredMode", "upi"),
        isVerified=merged.get("isVerified", True)
    )

@router.get("/farmer-ledger")
async def get_farmer_ledger(current_user: dict = Depends(get_current_user)):
    """
    Returns the farmer's complete payment ledger, including:
    - active receiving account
    - pending receivable lots (procurements ready for payout)
    - settled transactions history
    """
    db = get_database()
    farmer_id = current_user["id"]

    # 1. Fetch receiving account
    acc = await db.payment_accounts.find_one({"userId": farmer_id})
    if not acc:
        acc = {
            "upiId": "farmer@okhdfcbank",
            "accountNumber": "501004928172",
            "accountHolderName": current_user.get("name", "Farmer"),
            "ifscCode": "HDFC0000240",
            "bankName": "HDFC Bank (Mandi Branch)",
            "preferredMode": "upi",
            "isVerified": True
        }

    # 2. Fetch payments
    payments = await db.payments.find({"farmerId": farmer_id}).sort("paymentDate", -1).to_list(50)
    payments_list = []
    total_received = 0.0
    pending_amount = 0.0

    for p in payments:
        amount = float(p.get("amount", 0.0))
        is_paid = p.get("status") == "paid"
        if is_paid:
            total_received += amount
        else:
            pending_amount += amount

        payments_list.append(PaymentResponse(
            id=str(p["_id"]),
            procurementId=str(p.get("procurementId", "")),
            farmerId=str(p.get("farmerId", farmer_id)),
            amount=amount,
            status=p.get("status", "processing"),
            expectedDate=p.get("expectedDate", "Instant via UPI/DBT"),
            transactionRef=p.get("transactionRef"),
            bankAccountMasked=p.get("bankAccountMasked", acc.get("accountNumber", "XXXX-4192")[-4:]),
            paidAt=p.get("paidAt")
        ))

    # 3. Fetch any completed procurements without a payment record yet
    procurements = await db.procurements.find({
        "farmerId": farmer_id,
        "status": {"$in": ["procurement_completed", "payment_processing"]}
    }).to_list(20)

    receivable_lots = []
    for pr in procurements:
        # Check if already in payments list
        pr_id = str(pr["_id"])
        existing_pm = next((p for p in payments_list if p.procurementId == pr_id), None)
        if not existing_pm or existing_pm.status != "paid":
            receivable_lots.append({
                "procurementId": pr_id,
                "cropName": pr.get("cropName", "Wheat"),
                "quantity": float(pr.get("quantity", 50.0)),
                "unit": pr.get("unit", "quintal"),
                "ratePerQuintal": float(pr.get("ratePerQuintal", 2275.0)),
                "totalAmount": float(pr.get("totalAmount", 113750.0)),
                "centerName": pr.get("centerName", "Procurement Center"),
                "status": pr.get("status", "procurement_completed")
            })

    return {
        "account": {
            "upiId": acc.get("upiId", "farmer@okhdfcbank"),
            "accountNumber": acc.get("accountNumber", "501004928172"),
            "accountHolderName": acc.get("accountHolderName", current_user.get("name")),
            "ifscCode": acc.get("ifscCode", "HDFC0000240"),
            "bankName": acc.get("bankName", "HDFC Bank (Mandi Branch)"),
            "preferredMode": acc.get("preferredMode", "upi"),
            "isVerified": True
        },
        "stats": {
            "totalReceived": total_received,
            "pendingReceivable": pending_amount,
            "totalTransactions": len(payments_list)
        },
        "receivableLots": receivable_lots,
        "transactions": payments_list
    }

@router.post("/claim-payout", response_model=PaymentResponse)
async def claim_payout(
    req: ClaimPayoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Farmer claims instant payment disbursement for a completed crop procurement lot.
    Simulates direct settlement to UPI / Bank with UTR generation.
    """
    db = get_database()
    farmer_id = current_user["id"]
    p_oid = ObjectId(req.procurementId) if ObjectId.is_valid(req.procurementId) else req.procurementId

    procurement = await db.procurements.find_one({
        "_id": p_oid,
        "farmerId": farmer_id
    })

    if not procurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement lot not found for this account."
        )

    amount = float(procurement.get("totalAmount", 113750.0))
    now = datetime.utcnow()
    utr_number = f"UTR-FARMQ-{now.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    # Get farmer receiving preference
    acc = await db.payment_accounts.find_one({"userId": farmer_id})
    target_account = req.targetAccount or (acc.get("upiId") if req.payoutMode == "upi" else acc.get("accountNumber", "XXXX-4192"))
    masked_target = target_account if "@" in target_account else f"XXXX-XXXX-{target_account[-4:] if len(target_account) >= 4 else '4192'}"

    # Check if payment record exists
    existing_payment = await db.payments.find_one({"procurementId": str(p_oid)})

    payment_doc = {
        "procurementId": str(p_oid),
        "farmerId": farmer_id,
        "amount": amount,
        "status": "paid",
        "expectedDate": "Instant Settlement Complete",
        "transactionRef": utr_number,
        "bankAccountMasked": masked_target,
        "payoutMode": req.payoutMode or "upi",
        "paidAt": now,
        "updatedAt": now
    }

    if existing_payment:
        await db.payments.update_one({"_id": existing_payment["_id"]}, {"$set": payment_doc})
        payment_id = str(existing_payment["_id"])
    else:
        payment_doc["createdAt"] = now
        res = await db.payments.insert_one(payment_doc)
        payment_id = str(res.inserted_id)

    # Update procurement status to 'paid'
    updated_timeline = procurement.get("timeline", [])
    for step in updated_timeline:
        if isinstance(step, dict) and step.get("status") in ["payment_processing", "paid"]:
            step["completed"] = True
            step["current"] = (step.get("status") == "paid")
            if not step.get("timestamp"):
                step["timestamp"] = now.strftime("%d %b, %I:%M %p")

    await db.procurements.update_one(
        {"_id": p_oid},
        {
            "$set": {
                "status": "paid",
                "timeline": updated_timeline,
                "paidAt": now,
                "updatedAt": now
            }
        }
    )

    # Send Notification to Farmer
    await db.notifications.insert_one({
        "userId": farmer_id,
        "title": "Payment Credited Successfully! 💰",
        "message": f"₹{amount:,.2f} for {procurement.get('cropName')} lot has been credited directly to {masked_target}. Ref: {utr_number}.",
        "type": "payment",
        "read": False,
        "createdAt": now
    })

    return PaymentResponse(
        id=payment_id,
        procurementId=str(p_oid),
        farmerId=farmer_id,
        amount=amount,
        status="paid",
        expectedDate="Instant Settlement Complete",
        transactionRef=utr_number,
        bankAccountMasked=masked_target,
        paidAt=now
    )

@router.post("/generate-receive-qr", response_model=GenerateQrResponse)
async def generate_receive_qr(
    req: GenerateQrRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generates standard dynamic UPI intent URI and payload to display on-screen QR code
    for receiving payments directly at mandi counters or from produce buyers.
    """
    db = get_database()
    farmer_id = current_user["id"]
    user_name = current_user.get("name", "Farmer")

    acc = await db.payment_accounts.find_one({"userId": farmer_id})
    upi_id = acc.get("upiId") if acc and acc.get("upiId") else f"{current_user.get('phone', '9812000025')[-10:]}@okhdfcbank"

    encoded_name = user_name.replace(" ", "%20")
    note = (req.note or "FarmQ Crop Payout").replace(" ", "%20")
    
    # Standard UPI URI Schema
    if req.amount and req.amount > 0:
        upi_uri = f"upi://pay?pa={upi_id}&pn={encoded_name}&am={req.amount:.2f}&cu=INR&tn={note}"
    else:
        upi_uri = f"upi://pay?pa={upi_id}&pn={encoded_name}&cu=INR&tn={note}"

    return GenerateQrResponse(
        upiUri=upi_uri,
        upiId=upi_id,
        payeeName=user_name,
        amount=req.amount,
        qrPayload=upi_uri
    )

@router.get("/receipt/{payment_id}", response_model=PaymentReceiptResponse)
async def get_payment_receipt(
    payment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns official Mandi Procurement & Settlement Receipt for print/download.
    """
    db = get_database()
    oid = ObjectId(payment_id) if ObjectId.is_valid(payment_id) else payment_id
    payment = await db.payments.find_one({"_id": oid})

    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    # Get associated procurement
    proc_id = payment.get("procurementId")
    p_oid = ObjectId(proc_id) if ObjectId.is_valid(proc_id) else proc_id
    procurement = await db.procurements.find_one({"_id": p_oid}) if proc_id else None

    # Get farmer details
    farmer = await db.users.find_one({"_id": ObjectId(payment["farmerId"])}) if ObjectId.is_valid(payment["farmerId"]) else None
    farmer_name = farmer.get("name", current_user.get("name", "Farmer")) if farmer else current_user.get("name", "Farmer")
    farmer_phone = farmer.get("phone") if farmer else current_user.get("phone")

    # Quantities and MSP
    crop_name = procurement.get("cropName", "Wheat") if procurement else "Wheat"
    quantity = float(procurement.get("quantity", 50.0)) if procurement else 50.0
    rate = float(procurement.get("ratePerQuintal", 2275.0)) if procurement else 2275.0
    gross = float(payment.get("amount", quantity * rate))
    center_name = procurement.get("centerName", "Karnal Central Mandi") if procurement else "Karnal Central Mandi"

    paid_at = payment.get("paidAt") or payment.get("createdAt") or datetime.utcnow()
    voucher_date = paid_at.strftime("%d %b %Y, %I:%M %p") if isinstance(paid_at, datetime) else str(paid_at)

    return PaymentReceiptResponse(
        paymentId=str(payment["_id"]),
        receiptNumber=f"RCPT-{paid_at.strftime('%Y%m')}-{str(payment['_id'])[-6:].upper()}",
        procurementId=str(proc_id or ""),
        farmerId=str(payment["farmerId"]),
        farmerName=farmer_name,
        farmerPhone=farmer_phone,
        cropName=crop_name,
        quantity=quantity,
        unit="quintal",
        ratePerQuintal=rate,
        grossAmount=gross,
        mandiCess=0.0,
        netPaidAmount=gross,
        centerName=center_name,
        centerAddress="GT Road, Sector 3, Karnal, Haryana",
        payoutMode=payment.get("payoutMode", "UPI Instant Settlement"),
        targetAccountMasked=payment.get("bankAccountMasked", "XXXX-XXXX-4192"),
        transactionRef=payment.get("transactionRef", f"UTR-FARMQ-{secrets.token_hex(4).upper()}"),
        status=payment.get("status", "paid"),
        paidAt=paid_at if isinstance(paid_at, datetime) else None,
        voucherDate=voucher_date
    )

@router.post("/admin/disburse")
async def admin_disburse_payment(
    payment_id: str,
    admin: dict = Depends(require_admin)
):
    """
    Mandi officer approves and settles pending farmer payment directly.
    """
    db = get_database()
    oid = ObjectId(payment_id) if ObjectId.is_valid(payment_id) else payment_id
    payment = await db.payments.find_one({"_id": oid})

    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    now = datetime.utcnow()
    utr = f"UTR-MANDI-{now.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    await db.payments.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "paid",
                "transactionRef": utr,
                "paidAt": now,
                "updatedAt": now
            }
        }
    )

    # Update procurement
    if payment.get("procurementId"):
        p_oid = ObjectId(payment["procurementId"]) if ObjectId.is_valid(payment["procurementId"]) else payment["procurementId"]
        await db.procurements.update_one({"_id": p_oid}, {"$set": {"status": "paid", "updatedAt": now}})

    # Notify farmer
    await db.notifications.insert_one({
        "userId": payment["farmerId"],
        "title": "Payment Disbursed by Mandi Officer 🏢",
        "message": f"₹{payment.get('amount', 0):,.2f} has been disbursed and credited to your registered account. Ref: {utr}.",
        "type": "payment",
        "read": False,
        "createdAt": now
    })

    return {"success": True, "message": "Payment disbursed successfully.", "utr": utr}
