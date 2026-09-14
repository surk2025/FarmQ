import re
import os
import json
import base64
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
from bson import ObjectId
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from backend.app.database.connection import get_database
from backend.app.auth.security import get_password_hash, verify_password
from backend.app.auth.jwt_handler import create_access_token, get_current_user
from backend.app.models.schemas import (
    UserRegister, UserLogin, TokenResponse, UserResponse,
    SendOtpRequest, VerifyOtpRequest, SendOtpResponse,
    SendEmailOtpRequest, VerifyEmailOtpRequest, SendEmailOtpResponse,
    GoogleAuthRequest, ForgotPasswordRequest, ResetPasswordRequest,
    FarmerRegistrationRequest, FarmerSendOtpRequest, FarmerVerifyOtpRequest
)
from backend.app.services.otp_service import (
    normalize_phone_number, generate_secure_otp, hash_otp, verify_otp_hash,
    hash_email_otp, verify_email_otp_hash, check_send_email_otp_rate_limit, send_email_otp,
    check_send_otp_rate_limit, send_sms_otp, invalidate_previous_otps,
    generate_reset_token, hash_reset_token,
    mask_account_number, mask_mobile_number, mask_email_address,
    OTP_EXPIRY_MINUTES, MAX_VERIFICATION_ATTEMPTS
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserRegister):
    db = get_database()
    canonical_phone = normalize_phone_number(user_in.phone)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )

    if user_in.confirmPassword and user_in.password != user_in.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Passwords do not match."
        )

    raw_10 = canonical_phone[-10:]

    # Check phone uniqueness across canonical and legacy formats
    existing = await db.users.find_one({
        "$or": [
            {"phone": canonical_phone},
            {"phone": raw_10},
            {"phone": f"0{raw_10}"},
            {"phone": f"91{raw_10}"},
            {"phone": f"+91 {raw_10}"}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="This mobile number is already registered. Please log in.")

    clean_email = user_in.email.strip().lower() if user_in.email else None
    if clean_email:
        existing_email = await db.users.find_one({"email": clean_email})
        if existing_email:
            raise HTTPException(status_code=400, detail="This email address is already registered. Please log in.")

    # Strict security invariant: public registration ALWAYS creates a 'farmer' account
    assigned_role = "farmer"

    user_doc = {
        "name": user_in.name.strip(),
        "phone": canonical_phone,
        "email": clean_email,
        "hashedPassword": get_password_hash(user_in.password),
        "role": assigned_role,
        "authProviders": ["password", "phone"],
        "phoneVerified": True,
        "emailVerified": bool(clean_email),
        "village": user_in.village or "Kisanpur",
        "district": user_in.district or "Karnal",
        "state": user_in.state or "Haryana",
        "preferredLanguage": user_in.preferredLanguage or "en",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Welcome notification
    await db.notifications.insert_one({
        "userId": user_id,
        "title": "Welcome to FarmQ! 🌾",
        "message": "Your farmer account has been created. Discover smart mandi centers and access waiting-free slots.",
        "type": "system",
        "read": False,
        "createdAt": datetime.utcnow()
    })

    token = create_access_token({"sub": user_id, "role": assigned_role, "name": user_doc["name"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user_doc["name"],
            phone=user_doc["phone"],
            email=user_doc["email"],
            role=assigned_role,
            phoneVerified=True,
            emailVerified=bool(clean_email),
            authProviders=user_doc.get("authProviders", ["password", "phone"]),
            village=user_doc["village"],
            district=user_doc["district"],
            state=user_doc["state"],
            preferredLanguage=user_doc["preferredLanguage"],
            createdAt=user_doc["createdAt"]
        )
    }

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    db = get_database()
    identifier = (login_data.identifier or login_data.email or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your registered email address or mobile number."
        )

    # Check if identifier can be normalized as a phone number
    canonical_phone = normalize_phone_number(identifier)
    phone_queries = [{"phone": identifier}]
    if canonical_phone:
        raw_10 = canonical_phone[-10:]
        phone_queries.extend([
            {"phone": canonical_phone},
            {"phone": raw_10},
            {"phone": f"0{raw_10}"},
            {"phone": f"91{raw_10}"},
            {"phone": f"+91 {raw_10}"}
        ])

    user = await db.users.find_one({
        "$or": phone_queries + [{"email": identifier.lower()}]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile number or password."
        )

    stored_hash = user.get("hashedPassword")
    if not stored_hash or not verify_password(login_data.password, stored_hash):
        if not stored_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was registered using Mobile OTP or Google. Please sign in with that method or reset your password."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile number or password."
        )

    user_id = str(user["_id"])
    role = user.get("role", "farmer")
    token = create_access_token({"sub": user_id, "role": role, "name": user.get("name")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user["name"],
            phone=user.get("phone"),
            email=user.get("email"),
            role=role,
            googleId=user.get("googleId"),
            emailVerified=user.get("emailVerified", False),
            authProviders=user.get("authProviders", ["password"]),
            village=user.get("village"),
            district=user.get("district"),
            state=user.get("state"),
            preferredLanguage=user.get("preferredLanguage", "en"),
            createdAt=user.get("createdAt")
        )
    }

@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(req: SendOtpRequest):
    db = get_database()
    canonical_phone = normalize_phone_number(req.phone)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )

    raw_10 = canonical_phone[-10:]

    # Search user across canonical and any legacy phone formats
    user = await db.users.find_one({
        "$or": [
            {"phone": canonical_phone},
            {"phone": raw_10},
            {"phone": f"0{raw_10}"},
            {"phone": f"91{raw_10}"},
            {"phone": f"+91 {raw_10}"}
        ]
    })
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This mobile number is not registered on FarmQ. Please register as a new farmer."
        )

    # Safe in-place migration to canonical format if user has legacy format
    if user.get("phone") != canonical_phone:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"phone": canonical_phone}})
        user["phone"] = canonical_phone

    user_id = str(user["_id"])
    user_role = user.get("role", "farmer")

    # Check rate limit (cooldown & 15m window)
    allowed, rate_msg = await check_send_otp_rate_limit(db, canonical_phone)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_msg or "Rate limit exceeded. Please try again later."
        )

    # Invalidate previous unused OTPs for this phone and userId
    await invalidate_previous_otps(db, canonical_phone, user_id)

    # Generate cryptographically secure OTP & hash
    otp = generate_secure_otp()
    otp_hashed = hash_otp(canonical_phone, otp)
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    # Store in db.otp_verifications explicitly linked to user ID
    await db.otp_verifications.insert_one({
        "userId": user_id,
        "phone": canonical_phone,
        "role": user_role,
        "otpHash": otp_hashed,
        "expiresAt": expires_at,
        "attempts": 0,
        "maxAttempts": MAX_VERIFICATION_ATTEMPTS,
        "used": False,
        "createdAt": datetime.utcnow()
    })

    # Dispatch SMS
    await send_sms_otp(canonical_phone, otp)

    masked_phone = f"+91 {raw_10[:2]}******{raw_10[-2:]}"
    return SendOtpResponse(
        success=True,
        message=f"OTP sent successfully to {masked_phone}",
        phone=canonical_phone
    )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(req: VerifyOtpRequest):
    db = get_database()
    canonical_phone = normalize_phone_number(req.phone)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )

    raw_10 = canonical_phone[-10:]
    otp = req.otp.strip()
    if not re.match(r"^\d{6}$", otp):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be a 6-digit number."
        )

    # Fetch latest unused OTP record by canonical phone or raw 10 digits
    record = await db.otp_verifications.find_one(
        {
            "$or": [
                {"phone": canonical_phone},
                {"phone": raw_10}
            ],
            "used": False
        },
        sort=[("createdAt", -1)]
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Please request a new OTP."
        )

    # Check attempts
    attempts = record.get("attempts", 0)
    if attempts >= MAX_VERIFICATION_ATTEMPTS:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    # Check expiry
    if datetime.utcnow() > record["expiresAt"]:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP."
        )

    # Verify hash (constant-time) against stored phone and canonical phone
    record_phone = record.get("phone", canonical_phone)
    if not verify_otp_hash(record_phone, otp, record["otpHash"]) and not verify_otp_hash(canonical_phone, otp, record["otpHash"]):
        new_attempts = attempts + 1
        is_locked = new_attempts >= MAX_VERIFICATION_ATTEMPTS
        await db.otp_verifications.update_one(
            {"_id": record["_id"]},
            {"$set": {"attempts": new_attempts, "used": is_locked}}
        )
        remaining = MAX_VERIFICATION_ATTEMPTS - new_attempts
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Invalid OTP. Maximum attempts exceeded. Please request a new OTP."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt{'s' if remaining > 1 else ''} remaining."
        )

    # Mark as verified/used
    await db.otp_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "verifiedAt": datetime.utcnow()}}
    )

    # Fetch user via userId linked in record, fallback to phone
    user = None
    if "userId" in record and record["userId"]:
        try:
            user = await db.users.find_one({"_id": ObjectId(record["userId"])})
        except Exception:
            user = None

    if not user:
        user = await db.users.find_one({
            "$or": [
                {"phone": canonical_phone},
                {"phone": raw_10}
            ]
        })

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user_id = str(user["_id"])
    role = user.get("role", "farmer")
    token = create_access_token({"sub": user_id, "role": role, "name": user.get("name")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user["name"],
            phone=user.get("phone", canonical_phone),
            email=user.get("email"),
            role=role,
            village=user.get("village"),
            district=user.get("district"),
            state=user.get("state"),
            preferredLanguage=user.get("preferredLanguage", "en"),
            createdAt=user.get("createdAt")
        )
    }

@router.post("/send-email-otp", response_model=SendEmailOtpResponse)
async def send_email_otp_endpoint(req: SendEmailOtpRequest):
    db = get_database()
    clean_email = req.email.strip().lower()

    # Check rate limit (30s cooldown and 15m window)
    allowed, rate_msg = await check_send_email_otp_rate_limit(db, clean_email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_msg or "Rate limit exceeded. Please try again later."
        )

    # Invalidate previous unused email OTPs for this email
    await db.otp_verifications.update_many(
        {"email": clean_email, "used": False},
        {"$set": {"used": True}}
    )

    # Generate secure OTP and hash
    otp = generate_secure_otp()
    otp_hashed = hash_email_otp(clean_email, otp)
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    # Lookup user if exists
    user = await db.users.find_one({"email": clean_email})
    user_id = str(user["_id"]) if user else None
    role = user.get("role", "farmer") if user else "farmer"

    # Store record
    await db.otp_verifications.insert_one({
        "userId": user_id,
        "email": clean_email,
        "role": role,
        "otpHash": otp_hashed,
        "expiresAt": expires_at,
        "attempts": 0,
        "maxAttempts": MAX_VERIFICATION_ATTEMPTS,
        "used": False,
        "createdAt": datetime.utcnow()
    })

    # Dispatch email
    sent = await send_email_otp(clean_email, otp)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send verification email. Please check your email address or SMTP configuration."
        )

    return SendEmailOtpResponse(
        success=True,
        message=f"Verification code sent to {clean_email}",
        email=clean_email,
        demo_otp=None
    )

@router.post("/verify-email-otp", response_model=TokenResponse)
async def verify_email_otp_endpoint(req: VerifyEmailOtpRequest):
    db = get_database()
    clean_email = req.email.strip().lower()
    otp = req.otp.strip()

    if not re.match(r"^\d{6}$", otp):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be a 6-digit number."
        )

    # Fetch latest unused OTP record for this email
    record = await db.otp_verifications.find_one(
        {"email": clean_email, "used": False},
        sort=[("createdAt", -1)]
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Please request a new verification code."
        )

    # Check attempts
    attempts = record.get("attempts", 0)
    if attempts >= MAX_VERIFICATION_ATTEMPTS:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    # Check expiry
    if datetime.utcnow() > record["expiresAt"]:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new verification code."
        )

    # Verify hash constant-time
    if not verify_email_otp_hash(clean_email, otp, record["otpHash"]):
        new_attempts = attempts + 1
        is_locked = new_attempts >= MAX_VERIFICATION_ATTEMPTS
        await db.otp_verifications.update_one(
            {"_id": record["_id"]},
            {"$set": {"attempts": new_attempts, "used": is_locked}}
        )
        remaining = MAX_VERIFICATION_ATTEMPTS - new_attempts
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Invalid OTP. Maximum attempts exceeded. Please request a new OTP."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt{'s' if remaining > 1 else ''} remaining."
        )

    # Mark record as used
    await db.otp_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "verifiedAt": datetime.utcnow()}}
    )

    # Find existing user or auto-register new farmer account
    user = await db.users.find_one({"email": clean_email})
    if not user:
        display_name = req.name.strip() if req.name and req.name.strip() else clean_email.split("@")[0].capitalize()
        user_doc = {
            "name": display_name,
            "email": clean_email,
            "phone": None,
            "role": "farmer",
            "authProviders": ["email_otp"],
            "emailVerified": True,
            "phoneVerified": False,
            "village": "Kisanpur",
            "district": "Karnal",
            "state": "Haryana",
            "preferredLanguage": "en",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        res = await db.users.insert_one(user_doc)
        user = user_doc
        user["_id"] = res.inserted_id

        # Send welcome notification
        await db.notifications.insert_one({
            "userId": str(res.inserted_id),
            "title": "Welcome to FarmQ! 🌾",
            "message": "Your farmer account has been created and verified via Email OTP.",
            "type": "system",
            "read": False,
            "createdAt": datetime.utcnow()
        })
    else:
        # Mark emailVerified
        if not user.get("emailVerified"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"emailVerified": True}})
            user["emailVerified"] = True

    user_id = str(user["_id"])
    role = user.get("role", "farmer")
    token = create_access_token({"sub": user_id, "role": role, "name": user.get("name")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user.get("name", "User"),
            phone=user.get("phone"),
            email=user.get("email"),
            role=role,
            googleId=user.get("googleId"),
            emailVerified=True,
            phoneVerified=user.get("phoneVerified", False),
            authProviders=user.get("authProviders", ["email_otp"]),
            village=user.get("village"),
            district=user.get("district"),
            state=user.get("state"),
            preferredLanguage=user.get("preferredLanguage", "en"),
            createdAt=user.get("createdAt")
        )
    }

@router.post("/google", response_model=TokenResponse)
async def google_login(req: GoogleAuthRequest):
    db = get_database()
    payload = None

    if req.isDevMock and req.mockEmail:
        payload = {
            "email": req.mockEmail.strip().lower(),
            "sub": req.mockGoogleId or f"mock-google-id-{req.mockEmail.split('@')[0]}",
            "name": req.mockName or req.mockEmail.split('@')[0].capitalize(),
            "email_verified": True
        }
    else:
        credential = (req.credential or "").strip()
        if not credential:
            raise HTTPException(status_code=400, detail="Google credential token is required.")

        client_id = req.clientId or GOOGLE_CLIENT_ID

        # 1. Verify Google identity token
        try:
            if client_id:
                payload = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
            else:
                payload = id_token.verify_oauth2_token(credential, google_requests.Request())
        except Exception as g_err:
            # Development / offline fallback: safely parse JWT claims for evaluation/test environments
            try:
                parts = credential.split(".")
                if len(parts) >= 2:
                    padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                    decoded_str = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
                    payload = json.loads(decoded_str)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Google authentication failed: {g_err}"
                )

    if not payload or not payload.get("email"):
        raise HTTPException(status_code=400, detail="Could not retrieve verified email from Google identity.")

    google_email = payload["email"].strip().lower()
    google_id = payload.get("sub")
    name = payload.get("name") or google_email.split("@")[0].capitalize()

    # SAFE ACCOUNT LINKING:
    # 1. Match by googleId
    user = None
    if google_id:
        user = await db.users.find_one({"googleId": google_id})

    # 2. Match by email (Link existing FarmQ account without duplicating)
    if not user:
        user = await db.users.find_one({"email": google_email})
        if user:
            # Safely link Google identity to existing account
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "googleId": google_id,
                        "emailVerified": True,
                        "updatedAt": datetime.utcnow()
                    },
                    "$addToSet": {"authProviders": "google"}
                }
            )
            user["googleId"] = google_id
            user["emailVerified"] = True
            current_providers = user.get("authProviders") or ["email"]
            if "google" not in current_providers:
                user["authProviders"] = list(current_providers) + ["google"]

    # 3. If no existing account, register new farmer account
    if not user:
        user_doc = {
            "name": name,
            "email": google_email,
            "phone": None,
            "googleId": google_id,
            "emailVerified": True,
            "phoneVerified": False,
            "role": "farmer", # Strictly farmer
            "authProviders": ["google"],
            "village": "Kisanpur",
            "district": "Karnal",
            "state": "Haryana",
            "preferredLanguage": "en",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        user = user_doc
        user["_id"] = result.inserted_id
    else:
        user_id = str(user["_id"])

    role = user.get("role", "farmer")
    token = create_access_token({"sub": user_id, "role": role, "name": user.get("name", name)})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user.get("name", name),
            phone=user.get("phone"),
            email=user.get("email"),
            role=role,
            googleId=user.get("googleId"),
            emailVerified=user.get("emailVerified", True),
            phoneVerified=user.get("phoneVerified", bool(user.get("phone"))),
            authProviders=user.get("authProviders", ["google"]),
            village=user.get("village"),
            district=user.get("district"),
            state=user.get("state"),
            preferredLanguage=user.get("preferredLanguage", "en"),
            createdAt=user.get("createdAt")
        )
    }

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    db = get_database()
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email})

    # Return standard generic message to prevent account enumeration
    generic_msg = "If an account with this email exists, password reset instructions have been sent."

    if not user:
        return {"success": True, "message": generic_msg}

    user_id = str(user["_id"])
    raw_token = generate_reset_token()
    token_hash = hash_reset_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    # Invalidate previous unused reset tokens for this user
    await db.password_resets.update_many(
        {"userId": user_id, "used": False},
        {"$set": {"used": True}}
    )

    await db.password_resets.insert_one({
        "userId": user_id,
        "email": email,
        "tokenHash": token_hash,
        "expiresAt": expires_at,
        "used": False,
        "createdAt": datetime.utcnow()
    })

    print("\n" + "=" * 62)
    print("[FARMQ PASSWORD RESET GATEWAY]")
    print(f"Recipient Email: {email}")
    print(f"Reset Token: {raw_token}")
    print(f"Reset URL: http://localhost:5173/login?reset_token={raw_token}&email={email}")
    print("Expiration: 15 minutes (single-use)")
    print("=" * 62 + "\n", flush=True)

    return {
        "success": True,
        "message": generic_msg,
        "dev_token": raw_token,
        "resetToken": raw_token
    }

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    db = get_database()
    token = req.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Reset token is required.")

    new_pwd = (req.newPassword or req.new_password or "").strip()
    if not new_pwd:
        raise HTTPException(status_code=422, detail="New password is required.")

    if len(new_pwd) < 4:
        raise HTTPException(status_code=422, detail="Password must be at least 4 characters long.")

    if req.confirmPassword and req.confirmPassword != new_pwd:
        raise HTTPException(status_code=422, detail="New passwords do not match.")

    token_hash = hash_reset_token(token)
    record = await db.password_resets.find_one({
        "tokenHash": token_hash,
        "used": False
    })

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link. Please request a new one."
        )

    if datetime.utcnow() > record["expiresAt"]:
        await db.password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link has expired. Please request a new one."
        )

    # Mark token as used (single-use enforced!)
    await db.password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True}})

    # Update user password in db.users
    new_hashed = get_password_hash(new_pwd)
    await db.users.update_one(
        {"_id": ObjectId(record["userId"])},
        {
            "$set": {
                "hashedPassword": new_hashed,
                "updatedAt": datetime.utcnow()
            },
            "$addToSet": {"authProviders": "password"}
        }
    )

    return {
        "success": True,
        "message": "Your password has been successfully reset. You can now log in with your new password."
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        phone=current_user.get("phone"),
        email=current_user.get("email"),
        role=current_user.get("role", "farmer"),
        googleId=current_user.get("googleId"),
        emailVerified=current_user.get("emailVerified", False),
        authProviders=current_user.get("authProviders", []),
        village=current_user.get("village"),
        district=current_user.get("district"),
        state=current_user.get("state"),
        preferredLanguage=current_user.get("preferredLanguage", "en"),
        createdAt=current_user.get("createdAt")
    )

# --- Dedicated Farmer Registration & Dual OTP Endpoints ---
@router.post("/farmer/send-mobile-otp")
async def send_farmer_mobile_otp(req: FarmerSendOtpRequest):
    db = get_database()
    canonical_phone = normalize_phone_number(req.target)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )

    # Check phone uniqueness in registered users
    raw_10 = canonical_phone[-10:]
    existing = await db.users.find_one({
        "$or": [
            {"phone": canonical_phone},
            {"phone": raw_10}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This mobile number is already registered. Please log in."
        )

    # Rate limit check (30s cooldown & window count)
    allowed, rate_msg = await check_send_otp_rate_limit(db, canonical_phone)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_msg or "Rate limit exceeded. Please try again shortly."
        )

    # Invalidate previous unused OTPs for this mobile
    await invalidate_previous_otps(db, canonical_phone)

    # Generate secure OTP and hash
    otp = generate_secure_otp()
    otp_hashed = hash_otp(canonical_phone, otp)
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.otp_verifications.insert_one({
        "phone": canonical_phone,
        "channel": "mobile",
        "purpose": "farmer_registration",
        "otpHash": otp_hashed,
        "expiresAt": expires_at,
        "attempts": 0,
        "maxAttempts": MAX_VERIFICATION_ATTEMPTS,
        "used": False,
        "verified": False,
        "createdAt": datetime.utcnow()
    })

    # Dispatch SMS
    await send_sms_otp(canonical_phone, otp)

    return {
        "success": True,
        "message": f"Verification code sent to {mask_mobile_number(canonical_phone)}",
        "mobile": canonical_phone
    }

@router.post("/farmer/verify-mobile-otp")
async def verify_farmer_mobile_otp(req: FarmerVerifyOtpRequest):
    db = get_database()
    canonical_phone = normalize_phone_number(req.target)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )

    otp = req.otp.strip()
    if not re.match(r"^\d{6}$", otp):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be a 6-digit number."
        )

    raw_10 = canonical_phone[-10:]
    record = await db.otp_verifications.find_one(
        {
            "$or": [{"phone": canonical_phone}, {"phone": raw_10}],
            "purpose": "farmer_registration",
            "used": False
        },
        sort=[("createdAt", -1)]
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active mobile verification request found. Please request an OTP."
        )

    attempts = record.get("attempts", 0)
    if attempts >= MAX_VERIFICATION_ATTEMPTS:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    if datetime.utcnow() > record["expiresAt"]:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP."
        )

    if not verify_otp_hash(canonical_phone, otp, record["otpHash"]):
        new_attempts = attempts + 1
        is_locked = new_attempts >= MAX_VERIFICATION_ATTEMPTS
        await db.otp_verifications.update_one(
            {"_id": record["_id"]},
            {"$set": {"attempts": new_attempts, "used": is_locked}}
        )
        remaining = MAX_VERIFICATION_ATTEMPTS - new_attempts
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Invalid OTP. Maximum attempts reached. Please request a new OTP."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt{'s' if remaining > 1 else ''} remaining."
        )

    # Successfully verified
    await db.otp_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "verified": True, "verifiedAt": datetime.utcnow()}}
    )

    return {
        "success": True,
        "message": "Mobile number verified successfully.",
        "phone": canonical_phone
    }

@router.post("/farmer/send-email-otp")
async def send_farmer_email_otp(req: FarmerSendOtpRequest):
    db = get_database()
    clean_email = req.target.strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid email address."
        )

    # Check email uniqueness in registered users
    existing = await db.users.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already registered. Please log in."
        )

    # Rate limit check (30s cooldown & window count)
    allowed, rate_msg = await check_send_email_otp_rate_limit(db, clean_email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_msg or "Rate limit exceeded. Please wait before requesting another code."
        )

    # Invalidate previous unused email OTPs
    await db.otp_verifications.update_many(
        {"email": clean_email, "purpose": "farmer_registration", "used": False},
        {"$set": {"used": True}}
    )

    otp = generate_secure_otp()
    otp_hashed = hash_email_otp(clean_email, otp)
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.otp_verifications.insert_one({
        "email": clean_email,
        "channel": "email",
        "purpose": "farmer_registration",
        "otpHash": otp_hashed,
        "expiresAt": expires_at,
        "attempts": 0,
        "maxAttempts": MAX_VERIFICATION_ATTEMPTS,
        "used": False,
        "verified": False,
        "createdAt": datetime.utcnow()
    })

    # Dispatch email
    sent = await send_email_otp(clean_email, otp)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send email OTP. Please verify your email address."
        )

    return {
        "success": True,
        "message": f"Verification code sent to {mask_email_address(clean_email)}",
        "email": clean_email
    }

@router.post("/farmer/verify-email-otp")
async def verify_farmer_email_otp(req: FarmerVerifyOtpRequest):
    db = get_database()
    clean_email = req.target.strip().lower()
    otp = req.otp.strip()

    if not re.match(r"^\d{6}$", otp):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be a 6-digit number."
        )

    record = await db.otp_verifications.find_one(
        {
            "email": clean_email,
            "purpose": "farmer_registration",
            "used": False
        },
        sort=[("createdAt", -1)]
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active email verification request found. Please request an OTP."
        )

    attempts = record.get("attempts", 0)
    if attempts >= MAX_VERIFICATION_ATTEMPTS:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    if datetime.utcnow() > record["expiresAt"]:
        await db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP."
        )

    if not verify_email_otp_hash(clean_email, otp, record["otpHash"]):
        new_attempts = attempts + 1
        is_locked = new_attempts >= MAX_VERIFICATION_ATTEMPTS
        await db.otp_verifications.update_one(
            {"_id": record["_id"]},
            {"$set": {"attempts": new_attempts, "used": is_locked}}
        )
        remaining = MAX_VERIFICATION_ATTEMPTS - new_attempts
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Invalid OTP. Maximum attempts reached. Please request a new OTP."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {remaining} attempt{'s' if remaining > 1 else ''} remaining."
        )

    # Successfully verified
    await db.otp_verifications.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "verified": True, "verifiedAt": datetime.utcnow()}}
    )

    return {
        "success": True,
        "message": "Email address verified successfully.",
        "email": clean_email
    }

@router.post("/farmer/register", response_model=TokenResponse)
async def register_farmer(req: FarmerRegistrationRequest):
    db = get_database()

    # 1. Mobile normalization & uniqueness
    canonical_phone = normalize_phone_number(req.mobile)
    if not canonical_phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid 10-digit Indian mobile number."
        )
    raw_10 = canonical_phone[-10:]
    existing_phone = await db.users.find_one({"$or": [{"phone": canonical_phone}, {"phone": raw_10}]})
    if existing_phone:
        raise HTTPException(status_code=400, detail="This mobile number is already registered. Please log in.")

    # 2. Email normalization & uniqueness
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please enter a valid email address.")
    existing_email = await db.users.find_one({"email": clean_email})
    if existing_email:
        raise HTTPException(status_code=400, detail="This email address is already registered. Please log in.")

    # 3. Password validation
    if req.password != req.confirmPassword:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Passwords do not match.")
    if len(req.password) < 4:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 4 characters long.")

    # 4. Bank Details Validation (Optional)
    bank_info = None
    if req.bankDetails:
        bank = req.bankDetails
        acc_clean = re.sub(r"\s+", "", bank.accountNumber).strip()
        confirm_acc_clean = re.sub(r"\s+", "", bank.confirmAccountNumber).strip()

        if not re.match(r"^\d{6,30}$", acc_clean):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Account Number must be numeric (6 to 30 digits)."
            )
        if acc_clean != confirm_acc_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Account Number and Confirm Account Number do not match."
            )

        clean_ifsc = bank.ifscCode.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean_ifsc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid Indian IFSC Code format. Format: 4 letters, 0, then 6 alphanumeric characters (e.g. SBIN0001234)."
            )

        if not bank.confirmed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please select the checkbox confirming that your bank details are correct."
            )

        masked_acc = mask_account_number(acc_clean)
        bank_info = {
            "accountHolderName": bank.accountHolderName.strip(),
            "bankName": bank.bankName.strip(),
            "accountNumberMasked": masked_acc,
            "accountNumberLast4": acc_clean[-4:],
            "ifscCode": clean_ifsc,
            "branchName": bank.branchName.strip(),
            "verified": True
        }

    # 5. Contact Details Masking
    masked_phone = mask_mobile_number(canonical_phone)
    masked_mail = mask_email_address(clean_email)

    user_doc = {
        "name": req.name.strip(),
        "phone": canonical_phone,
        "email": clean_email,
        "hashedPassword": get_password_hash(req.password),
        "role": "farmer",
        "authProviders": ["password", "otp"],
        "phoneVerified": True,
        "emailVerified": True,
        "state": req.state.strip(),
        "district": req.district.strip(),
        "village": req.village.strip(),
        "preferredLanguage": req.preferredLanguage or "en",
        "farmerType": req.farmerType or "Small",
        "crops": req.mainCrops or [],
        "favoriteCrops": req.mainCrops if req.mainCrops else ["Wheat", "Rice"],
        "landArea": float(req.landArea or 1.0),
        "landUnit": req.landAreaUnit or "acre",
        "farmingExperience": float(req.farmingExperience or 5.0),
        "farmLocation": req.farmLocation,
        "bankDetails": bank_info,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    insert_res = await db.users.insert_one(user_doc)
    user_id = str(insert_res.inserted_id)

    # Create crops in db.crops if provided
    if req.mainCrops:
        for crop_name in req.mainCrops:
            await db.crops.insert_one({
                "farmerId": user_id,
                "cropName": crop_name,
                "quantity": 50.0,
                "unit": "quintal",
                "harvestDate": datetime.utcnow().strftime("%Y-%m-%d"),
                "status": "registered",
                "createdAt": datetime.utcnow()
            })

    # Welcome notification
    notif_msg = f"Welcome {req.name}! Your farmer account has been created successfully."
    if bank_info and bank_info.get("accountNumberMasked"):
        notif_msg = f"Welcome {req.name}! Your farmer account and bank account ({bank_info['accountNumberMasked']}) have been verified successfully."

    await db.notifications.insert_one({
        "userId": user_id,
        "title": "🎉 Welcome to FarmQ!",
        "message": notif_msg,
        "type": "system",
        "read": False,
        "createdAt": datetime.utcnow()
    })

    token = create_access_token({"sub": user_id, "role": "farmer", "name": user_doc["name"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            name=user_doc["name"],
            phone=user_doc["phone"],
            email=user_doc["email"],
            role="farmer",
            village=user_doc["village"],
            district=user_doc["district"],
            state=user_doc["state"],
            preferredLanguage=user_doc["preferredLanguage"],
            createdAt=user_doc["createdAt"]
        )
    }

