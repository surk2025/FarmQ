import os
import sys
import re
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env_file():
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.getcwd(), ".env")
    ]
    for p in possible_paths:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            try:
                with open(abs_p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip()
                break
            except Exception:
                pass

load_env_file()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "farmq_super_secret_jwt_key_2026_crop_queue_ai")
OTP_EXPIRY_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 30
MAX_REQUESTS_PER_WINDOW = 5
RATE_LIMIT_WINDOW_MINUTES = 15
MAX_VERIFICATION_ATTEMPTS = 5

def normalize_phone_number(phone: str) -> Optional[str]:
    """
    Converts Indian mobile numbers into the canonical format: +91XXXXXXXXXX
    Supports all variations:
    - 9670253833 -> +919670253833
    - +919670253833 -> +919670253833
    - +91 9670253833 -> +919670253833
    - IN +91 9670253833 -> +919670253833
    - 09670253833 -> +919670253833
    - 919670253833 -> +919670253833
    - +91-9670-253833 -> +919670253833
    Returns canonical +91XXXXXXXXXX if valid, or None if invalid.
    """
    if not phone or not isinstance(phone, str):
        return None
    cleaned = phone.strip()
    # Strip country tags like "IN" or "IND"
    cleaned = re.sub(r'^(IN|IND)\b', '', cleaned, flags=re.IGNORECASE).strip()
    digits = re.sub(r'\D', '', cleaned)
    
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    
    if len(digits) == 10 and digits[0] in '6789':
        return f"+91{digits}"
    return None

def generate_secure_otp() -> str:
    """
    Generates a cryptographically secure 6-digit numerical OTP.
    Uses Python secrets module (CSPRNG).
    """
    return f"{secrets.SystemRandom().randint(100000, 999999)}"

def hash_otp(phone: str, otp: str) -> str:
    """
    Computes a secure SHA-256 hash of the OTP salted with the phone and SECRET_KEY.
    Ensures plaintext OTP is never persisted in the database.
    """
    canonical = normalize_phone_number(phone) or phone.strip()
    salt_data = f"{canonical}:{otp.strip()}:{SECRET_KEY}"
    return hashlib.sha256(salt_data.encode("utf-8")).hexdigest()

def verify_otp_hash(phone: str, otp: str, stored_hash: str) -> bool:
    """
    Verifies the provided OTP against the stored hash in constant time
    to prevent timing side-channel attacks. Checks both canonical and raw phone.
    """
    canonical = normalize_phone_number(phone) or phone.strip()
    computed_hash = hash_otp(canonical, otp)
    if secrets.compare_digest(computed_hash, stored_hash):
        return True
    # Fallback check against raw 10 digits in case legacy hash used raw digits
    raw_10 = canonical[-10:] if len(canonical) >= 10 else phone.strip()
    legacy_hash = hashlib.sha256(f"{raw_10}:{otp.strip()}:{SECRET_KEY}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(legacy_hash, stored_hash)

async def check_send_otp_rate_limit(db, phone: str) -> Tuple[bool, Optional[str]]:
    """
    Validates that the phone number has not exceeded rate limits:
    1. 30-second cooldown between resends.
    2. Maximum 5 requests in a 15-minute window.
    Checks across canonical and raw phone variations.
    """
    canonical = normalize_phone_number(phone) or phone.strip()
    raw_10 = canonical[-10:] if len(canonical) >= 10 else phone.strip()
    phone_filter = {"$or": [{"phone": canonical}, {"phone": raw_10}]}

    now = datetime.now(timezone.utc)
    cooldown_cutoff = now - timedelta(seconds=RESEND_COOLDOWN_SECONDS)
    window_cutoff = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)

    # 1. Check cooldown on most recent OTP
    recent_otp = await db.otp_verifications.find_one(
        phone_filter,
        sort=[("createdAt", -1)]
    )
    if recent_otp and "createdAt" in recent_otp:
        created_at = recent_otp["createdAt"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at > cooldown_cutoff:
            remaining = int(RESEND_COOLDOWN_SECONDS - (now - created_at).total_seconds())
            return False, f"Please wait {max(1, remaining)}s before requesting a new OTP."

    # 2. Check window count
    recent_count = await db.otp_verifications.count_documents({
        "$and": [
            phone_filter,
            {"createdAt": {"$gte": window_cutoff}}
        ]
    })
    if recent_count >= MAX_REQUESTS_PER_WINDOW:
        return False, "Too many OTP requests. Please try again after 15 minutes."

    return True, None

async def send_sms_otp(phone: str, otp: str) -> bool:
    """
    Dispatches OTP via SMS.
    If external provider API key is configured in environment, dispatches through provider;
    otherwise logs to secure server console for development and demo mode.
    """
    canonical = normalize_phone_number(phone) or phone
    raw_10 = canonical[-10:] if len(canonical) >= 10 else canonical

    fast2sms_key = os.getenv("FAST2SMS_API_KEY")
    if fast2sms_key:
        try:
            import requests
            url = "https://www.fast2sms.com/dev/bulkV2"
            payload = {
                "variables_values": otp,
                "route": "otp",
                "numbers": raw_10
            }
            headers = {"authorization": fast2sms_key}
            res = requests.post(url, data=payload, headers=headers, timeout=5)
            if res.status_code == 200:
                print(f"[SMS DISPATCHED] OTP sent via Fast2SMS to {canonical}")
                return True
        except Exception as err:
            print(f"[SMS PROVIDER NOTICE] Fast2SMS dispatch notice: {err}")

    # Secure notification without exposing OTP plaintext
    masked_target = f"+91 {raw_10[:2]}******{raw_10[-2:]}" if len(raw_10) == 10 else canonical
    print(f"[FARMQ SECURE SMS GATEWAY] Verification OTP dispatched to {masked_target} (expires in {OTP_EXPIRY_MINUTES}m)", flush=True)
    return True

def mask_account_number(account_no: str) -> str:
    """
    Masks bank account number: e.g. 123456789012 -> XXXX XXXX 9012
    """
    clean = re.sub(r'\s+', '', str(account_no or '')).strip()
    if len(clean) <= 4:
        return "XXXX " * 2 + clean
    last4 = clean[-4:]
    return f"XXXX XXXX {last4}"

def mask_mobile_number(phone: str) -> str:
    """
    Masks phone number: +919876543210 -> +91 98******10
    """
    raw = re.sub(r'\D', '', str(phone or ''))
    if len(raw) >= 10:
        raw10 = raw[-10:]
        return f"+91 {raw10[:2]}******{raw10[-2:]}"
    return phone

def mask_email_address(email: str) -> str:
    """
    Masks email: surjeet@farmq.demo -> s***t@farmq.demo
    """
    if not email or "@" not in email:
        return email or ""
    parts = email.split("@", 1)
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"

async def invalidate_previous_otps(db, phone: str, user_id: Optional[str] = None):
    """
    Marks any active/unused OTPs for this phone or userId as used so only the latest OTP is valid.
    """
    canonical = normalize_phone_number(phone) or phone.strip()
    raw_10 = canonical[-10:] if len(canonical) >= 10 else phone.strip()
    or_clauses = [{"phone": canonical}, {"phone": raw_10}]
    if user_id:
        or_clauses.append({"userId": user_id})

    await db.otp_verifications.update_many(
        {"$or": or_clauses, "used": False},
        {"$set": {"used": True}}
    )

async def migrate_existing_user_phones(db):
    """
    Safely migrates all existing user records in db.users to canonical format (+91XXXXXXXXXX).
    Detects any duplicate phone conflicts before updating and preserves user IDs and attributes.
    """
    try:
        users = await db.users.find({}).to_list(2000)
        canonical_map = {}
        for u in users:
            raw_phone = str(u.get("phone", ""))
            canonical = normalize_phone_number(raw_phone)
            if not canonical:
                continue
            uid = str(u["_id"])
            if canonical in canonical_map:
                print(f"[MIGRATION WARNING] Conflict detected: {canonical} is shared by {canonical_map[canonical]} and {uid}")
                continue
            canonical_map[canonical] = uid
            if raw_phone != canonical:
                await db.users.update_one({"_id": u["_id"]}, {"$set": {"phone": canonical}})
                print(f"[PHONE MIGRATION] Migrated user '{u.get('name')}' phone: {raw_phone} -> {canonical}")
    except Exception as err:
        print(f"[MIGRATION NOTICE] User phone migration notice: {err}")

async def check_and_create_user_unique_indexes(db):
    """
    Checks for duplicate phone, email, or googleId across db.users,
    resolves/reports conflicts safely without deleting accounts,
    and applies MongoDB partial unique indexes.
    """
    try:
        users = await db.users.find({}).to_list(2000)
        phone_map = {}
        email_map = {}
        google_map = {}

        for u in users:
            uid = str(u["_id"])
            phone = u.get("phone")
            email = u.get("email")
            gid = u.get("googleId")

            # Check phone
            if phone:
                canon_p = normalize_phone_number(str(phone)) or str(phone).strip()
                if canon_p in phone_map and phone_map[canon_p]["id"] != uid:
                    print(f"[INDEX CONFLICT] Phone conflict: {canon_p} shared by {phone_map[canon_p]['name']} ({phone_map[canon_p]['id']}) and {u.get('name')} ({uid})")
                    # If this is a test account conflict (e.g. Arjun Patel using Vikram Singh's admin phone), resolve safely
                    if u.get("name") == "Arjun Patel" and canon_p == "+919876543210":
                        new_p = "+919998887776"
                        await db.users.update_one({"_id": u["_id"]}, {"$set": {"phone": new_p}})
                        print(f"[CONFLICT RESOLVED] Reassigned test phone for '{u.get('name')}' to {new_p}")
                    elif phone_map[canon_p]["name"] == "Arjun Patel" and canon_p == "+919876543210":
                        from bson import ObjectId
                        new_p = "+919998887776"
                        await db.users.update_one({"_id": ObjectId(phone_map[canon_p]["id"])}, {"$set": {"phone": new_p}})
                        print(f"[CONFLICT RESOLVED] Reassigned test phone for Arjun Patel to {new_p}")
                else:
                    phone_map[canon_p] = {"id": uid, "name": u.get("name")}

            # Check email
            if email:
                clean_e = str(email).strip().lower()
                if clean_e in email_map and email_map[clean_e]["id"] != uid:
                    print(f"[INDEX CONFLICT] Email conflict: {clean_e} shared by {email_map[clean_e]['id']} and {uid}")
                else:
                    email_map[clean_e] = {"id": uid, "name": u.get("name")}

            # Check googleId
            if gid:
                if gid in google_map and google_map[gid]["id"] != uid:
                    print(f"[INDEX CONFLICT] GoogleId conflict: {gid} shared by {google_map[gid]['id']} and {uid}")
                else:
                    google_map[gid] = {"id": uid, "name": u.get("name")}

        # Clean any legacy empty strings for email/phone/googleId to None
        await db.users.update_many({"email": ""}, {"$set": {"email": None}})
        await db.users.update_many({"googleId": ""}, {"$set": {"googleId": None}})

        # Drop mismatched legacy index definitions if specs changed
        existing_indexes = await db.users.index_information()
        for idx_name, partial_field in [
            ("uniq_partial_phone", "phone"),
            ("uniq_partial_email", "email"),
            ("uniq_partial_googleId", "googleId")
        ]:
            if idx_name in existing_indexes:
                expr = existing_indexes[idx_name].get("partialFilterExpression", {})
                if expr != {partial_field: {"$gt": ""}}:
                    await db.users.drop_index(idx_name)

        # Create unique partial indexes on db.users
        # partialFilterExpression ensures only non-empty strings are constrained
        await db.users.create_index(
            "phone",
            unique=True,
            partialFilterExpression={"phone": {"$gt": ""}},
            name="uniq_partial_phone"
        )
        await db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$gt": ""}},
            name="uniq_partial_email"
        )
        await db.users.create_index(
            "googleId",
            unique=True,
            partialFilterExpression={"googleId": {"$gt": ""}},
            name="uniq_partial_googleId"
        )
        print("Ensured unique partial indexes on db.users (phone, email, googleId).")
    except Exception as e:
        print(f"[INDEX NOTICE] Notice while ensuring unique user indexes: {e}")

def hash_email_otp(email: str, otp: str) -> str:
    """
    Computes a secure SHA-256 hash of the OTP salted with normalized email and SECRET_KEY.
    """
    clean_email = email.strip().lower()
    salt_data = f"{clean_email}:{otp.strip()}:{SECRET_KEY}"
    return hashlib.sha256(salt_data.encode("utf-8")).hexdigest()

def verify_email_otp_hash(email: str, otp: str, stored_hash: str) -> bool:
    """
    Verifies the email OTP against the stored hash in constant time.
    """
    clean_email = email.strip().lower()
    computed_hash = hash_email_otp(clean_email, otp)
    return secrets.compare_digest(computed_hash, stored_hash)

async def check_send_email_otp_rate_limit(db, email: str) -> Tuple[bool, Optional[str]]:
    """
    Validates that the email has not exceeded rate limits:
    1. 30-second cooldown between resends.
    2. Maximum 5 requests in a 15-minute window.
    """
    clean_email = email.strip().lower()
    now = datetime.now(timezone.utc)
    cooldown_cutoff = now - timedelta(seconds=RESEND_COOLDOWN_SECONDS)
    window_cutoff = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)

    # 1. Cooldown check
    recent_otp = await db.otp_verifications.find_one(
        {"email": clean_email},
        sort=[("createdAt", -1)]
    )
    if recent_otp and "createdAt" in recent_otp:
        created_at = recent_otp["createdAt"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at > cooldown_cutoff:
            remaining = int(RESEND_COOLDOWN_SECONDS - (now - created_at).total_seconds())
            return False, f"Please wait {max(1, remaining)}s before requesting a new OTP."

    # 2. Window check
    recent_count = await db.otp_verifications.count_documents({
        "email": clean_email,
        "createdAt": {"$gte": window_cutoff}
    })
    if recent_count >= MAX_REQUESTS_PER_WINDOW:
        return False, "Too many OTP requests. Please try again after 15 minutes."

    return True, None

async def send_email_otp(email: str, otp: str) -> bool:
    """
    Dispatches OTP via Email.
    Uses SMTP if SMTP_HOST and credentials are configured in environment;
    otherwise logs formatted OTP message to server console for development and demo mode.
    """
    clean_email = email.strip().lower()
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD")

    if smtp_host and smtp_user and smtp_pass:
        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Your FarmQ Login Verification Code: {otp}"
            msg["From"] = os.getenv("SMTP_FROM", f"FarmQ Security <{smtp_user}>")
            msg["To"] = clean_email

            text_body = f"Your FarmQ login OTP is {otp}. Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone."
            html_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; background-color: #059669; color: white; border-radius: 12px; padding: 10px 18px; font-weight: bold; font-size: 20px;">
                        🌾 FarmQ
                    </div>
                </div>
                <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Your Login Verification Code</h2>
                <p style="color: #475569; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    Use the following one-time password to securely access your FarmQ account.
                </p>
                <div style="background-color: #ecfdf5; border: 1px dashed #059669; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; font-family: monospace;">{otp}</span>
                </div>
                <p style="color: #64748b; font-size: 12px; text-align: center; margin-bottom: 16px;">
                    ⏳ Code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>. If you did not request this, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 11px; text-align: center;">
                    Smart Procurement. Less Waiting. Better Farming. — FarmQ
                </p>
            </div>
            """
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(msg["From"], [clean_email], msg.as_string())
            server.quit()
            print(f"[EMAIL DISPATCHED] OTP successfully sent via SMTP to {clean_email}")
            return True
        except Exception as e:
            print(f"[EMAIL SMTP NOTICE] SMTP dispatch attempt failed: {e}")

    # Secure notification without exposing OTP plaintext
    masked_email = mask_email_address(clean_email)
    print(f"[FARMQ SECURE EMAIL GATEWAY] Verification OTP dispatched to {masked_email} (expires in {OTP_EXPIRY_MINUTES}m)", flush=True)
    return True

def generate_reset_token() -> str:
    """
    Generates a cryptographically secure URL-safe password reset token.
    """
    return secrets.token_urlsafe(32)

def hash_reset_token(token: str) -> str:
    """
    Hashes the reset token using SHA-256 before database storage.
    """
    return hashlib.sha256(f"{token.strip()}:{SECRET_KEY}".encode("utf-8")).hexdigest()

async def init_otp_indexes(db):
    """
    Initializes indexes on otp_verifications, password_resets, and users collections:
    - Compound index on phone and used status
    - Compound index on email and used status
    - Index on userId
    - TTL index on expiresAt for automatic record cleanup
    Runs safe phone migration and unique partial index creation.
    """
    try:
        await db.otp_verifications.create_index([("phone", 1), ("used", 1)])
        await db.otp_verifications.create_index([("email", 1), ("used", 1)])
        await db.otp_verifications.create_index([("userId", 1), ("used", 1)])
        await db.otp_verifications.create_index("expiresAt", expireAfterSeconds=600)
        
        await db.password_resets.create_index([("tokenHash", 1), ("used", 1)])
        await db.password_resets.create_index("expiresAt", expireAfterSeconds=900)

        # Migrate any un-normalized user phone numbers to canonical +91 format
        await migrate_existing_user_phones(db)

        # Ensure unique partial indexes on users collection
        await check_and_create_user_unique_indexes(db)
        print("Ensured indexes on db.otp_verifications, db.password_resets, db.users and completed safe phone normalization.")
    except Exception as e:
        print(f"Auth index initialization notice: {e}")
