from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- User & Auth ---
class UserRole:
    FARMER = "farmer"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[str] = None
    password: str = Field(..., min_length=4)
    confirmPassword: Optional[str] = None
    village: Optional[str] = "Kisanpur"
    district: Optional[str] = "Karnal"
    state: Optional[str] = "Haryana"
    preferredLanguage: Optional[str] = "en"  # "en" or "hi"
    role: Optional[str] = UserRole.FARMER

class UserLogin(BaseModel):
    identifier: Optional[str] = None  # phone or email
    email: Optional[str] = None
    password: str

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = Field(None, description="Google ID Token / Credential JWT")
    clientId: Optional[str] = None
    isDevMock: Optional[bool] = False
    mockEmail: Optional[str] = None
    mockName: Optional[str] = None
    mockGoogleId: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="Registered account email address")

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset verification token")
    new_password: Optional[str] = None
    newPassword: Optional[str] = None
    confirmPassword: Optional[str] = None

class SendOtpRequest(BaseModel):
    phone: str = Field(..., description="10-digit Indian mobile number")

class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., description="10-digit Indian mobile number")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")

class SendOtpResponse(BaseModel):
    success: bool
    message: str
    phone: str

class SendEmailOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120, description="Registered or new email address")

class VerifyEmailOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120, description="Email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")
    name: Optional[str] = None

class SendEmailOtpResponse(BaseModel):
    success: bool
    message: str
    email: str
    demo_otp: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    googleId: Optional[str] = None
    emailVerified: Optional[bool] = False
    phoneVerified: Optional[bool] = False
    authProviders: Optional[List[str]] = []
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    preferredLanguage: Optional[str] = "en"
    createdAt: Optional[datetime] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    preferredLanguage: Optional[str] = None

# --- Crop ---
class CropCreate(BaseModel):
    cropName: str  # Wheat, Rice, Maize, Mustard, Sugarcane, Potato
    quantity: float = Field(..., gt=0)
    unit: str = "quintal"
    harvestDate: str
    preferredDate: Optional[str] = None

class CropResponse(BaseModel):
    id: str
    farmerId: str
    cropName: str
    quantity: float
    unit: str
    harvestDate: str
    preferredDate: Optional[str] = None
    status: str = "registered"  # registered, scheduled, procured
    createdAt: Optional[datetime] = None

# --- Center ---
class LocationModel(BaseModel):
    lat: float
    lng: float
    address: str
    district: str

class CenterResponse(BaseModel):
    id: str
    name: str
    location: LocationModel
    distanceKm: Optional[float] = 0.0
    capacityPerDay: float
    bookedQuantity: float
    remainingCapacity: Optional[float] = 0.0
    activeCounters: int
    avgProcessingMinutes: int = 8
    status: str = "open"  # open, crowded, closed
    queueLength: int = 0
    estimatedWaitMinutes: int = 0
    operatingHours: str = "08:00 AM - 05:00 PM"
    contactPhone: str = "1800-180-1551"

class CenterCapacityUpdate(BaseModel):
    capacityPerDay: Optional[float] = None
    activeCounters: Optional[int] = None
    operatingHours: Optional[str] = None
    status: Optional[str] = None

# --- Slot ---
class SlotResponse(BaseModel):
    id: str
    centerId: str
    date: str
    startTime: str
    endTime: str
    capacity: int
    booked: int
    isFull: bool = False

class SlotBookingRequest(BaseModel):
    cropId: str
    centerId: str
    slotId: str
    quantity: float

class BookingConfirmationResponse(BaseModel):
    tokenNumber: int
    tokenId: str
    centerName: str
    centerAddress: str
    cropName: str
    quantity: float
    slotDate: str
    slotTime: str
    estimatedWaitMinutes: int
    qrData: str

# --- Queue & Tokens ---
class QueueTokenResponse(BaseModel):
    id: str
    tokenNumber: int
    farmerId: str
    farmerName: str
    farmerPhone: str
    centerId: str
    centerName: str
    cropName: str
    quantity: float
    status: str  # waiting, arrived, processing, completed, absent, rejected
    positionInQueue: int
    farmersAhead: int
    estimatedWaitMinutes: int
    counterNumber: Optional[int] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class QueuePredictionResponse(BaseModel):
    tokenNumber: int
    farmersAhead: int
    estimatedWaitMinutes: int
    formattedWaitTime: str
    confidence: str
    activeCounters: int
    modelUsed: str
    factors: Dict[str, Any]
    advice: str

# --- Procurement ---
class TimelineStep(BaseModel):
    status: str
    label: str
    timestamp: Optional[str] = None
    completed: bool
    current: bool

class ProcurementResponse(BaseModel):
    id: str
    tokenId: str
    farmerId: str
    farmerName: str
    cropName: str
    quantity: float
    unit: str = "quintal"
    centerId: str
    centerName: str
    status: str
    ratePerQuintal: float
    totalAmount: float
    timeline: List[TimelineStep]
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class ProcurementStatusUpdate(BaseModel):
    status: str  # arrived, verification, accepted, rejected, procurement_completed, payment_processing, paid
    notes: Optional[str] = None

# --- Payment ---
class PaymentResponse(BaseModel):
    id: str
    procurementId: str
    farmerId: str
    amount: float
    status: str  # processing, paid
    expectedDate: str
    transactionRef: Optional[str] = None
    bankAccountMasked: str = "XXXX-XXXX-4192"
    paidAt: Optional[datetime] = None

class PaymentReceivingAccount(BaseModel):
    upiId: Optional[str] = "farmer@okhdfcbank"
    accountNumber: Optional[str] = "501004928172"
    accountHolderName: Optional[str] = "Surjeet Kumar"
    ifscCode: Optional[str] = "HDFC0000240"
    bankName: Optional[str] = "HDFC Bank (Karnal Branch)"
    preferredMode: Optional[str] = "upi"  # "upi" | "bank" | "dbt"
    isVerified: Optional[bool] = True

class PaymentReceivingAccountUpdate(BaseModel):
    upiId: Optional[str] = None
    accountNumber: Optional[str] = None
    accountHolderName: Optional[str] = None
    ifscCode: Optional[str] = None
    bankName: Optional[str] = None
    preferredMode: Optional[str] = None

class ClaimPayoutRequest(BaseModel):
    procurementId: str
    payoutMode: Optional[str] = "upi"
    targetAccount: Optional[str] = None

class GenerateQrRequest(BaseModel):
    amount: Optional[float] = None
    note: Optional[str] = None

class GenerateQrResponse(BaseModel):
    upiUri: str
    upiId: str
    payeeName: str
    amount: Optional[float] = None
    qrPayload: str

class PaymentReceiptResponse(BaseModel):
    paymentId: str
    receiptNumber: str
    procurementId: str
    farmerId: str
    farmerName: str
    farmerPhone: Optional[str] = None
    cropName: str
    quantity: float
    unit: str = "quintal"
    ratePerQuintal: float
    grossAmount: float
    mandiCess: float = 0.0
    netPaidAmount: float
    centerName: str
    centerAddress: Optional[str] = None
    payoutMode: str
    targetAccountMasked: str
    transactionRef: str
    status: str
    paidAt: Optional[datetime] = None
    voucherDate: str

# --- Notification ---
class NotificationResponse(BaseModel):
    id: str
    userId: str
    title: str
    message: str
    type: str  # queue, slot, procurement, payment, system
    read: bool
    createdAt: datetime

# --- Analytics ---
class DailyMetric(BaseModel):
    day: str
    farmers: int
    quantity: float
    avgWait: int

class CenterUtilizationMetric(BaseModel):
    centerName: str
    capacity: float
    booked: float
    utilizationPercent: float

class CropDistributionMetric(BaseModel):
    cropName: str
    quantity: float
    percentage: float

class AdminOverviewStats(BaseModel):
    todayFarmers: int
    waiting: int
    processing: int
    completed: int
    avgWaitingTimeMinutes: int
    avgProcessingTimeMinutes: int
    todayProcurementQuintal: float

# --- Farmer Platform Upgrade: Registration, Bank Details, Crop Prices, AI ---
class FarmerBankDetailsInput(BaseModel):
    accountHolderName: str = Field(..., min_length=2, max_length=100)
    bankName: str = Field(..., min_length=2, max_length=100)
    accountNumber: str = Field(..., min_length=6, max_length=30)
    confirmAccountNumber: str = Field(..., min_length=6, max_length=30)
    ifscCode: str = Field(..., min_length=11, max_length=11)
    branchName: str = Field(..., min_length=2, max_length=100)
    confirmed: bool = False

class FarmerBankDetailsResponse(BaseModel):
    accountHolderName: str
    bankName: str
    accountNumberMasked: str
    ifscCode: str
    branchName: str
    verified: bool = True

class FarmerRegistrationRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    mobile: str = Field(..., min_length=10, max_length=20)
    email: str = Field(..., min_length=5, max_length=120)
    password: str = Field(..., min_length=4)
    confirmPassword: str = Field(..., min_length=4)
    state: str = Field(..., min_length=2, max_length=50)
    district: str = Field(..., min_length=2, max_length=50)
    village: str = Field(..., min_length=2, max_length=100)
    preferredLanguage: Optional[str] = "en"
    farmerType: Optional[str] = "Small"
    mainCrops: Optional[List[str]] = []
    landArea: Optional[float] = 1.0
    landAreaUnit: Optional[str] = "acre"
    farmingExperience: Optional[float] = 5.0
    farmLocation: Optional[str] = None
    bankDetails: Optional[FarmerBankDetailsInput] = None

class FarmerSendOtpRequest(BaseModel):
    channel: str = Field(..., description="'mobile' or 'email'")
    target: str = Field(..., description="Phone number or email address")

class FarmerVerifyOtpRequest(BaseModel):
    channel: str = Field(..., description="'mobile' or 'email'")
    target: str = Field(..., description="Phone number or email address")
    otp: str = Field(..., min_length=6, max_length=6)

class CropPriceItem(BaseModel):
    id: str
    cropName: str
    variety: str
    marketName: str
    state: str
    district: str
    minPrice: float
    maxPrice: float
    modalPrice: float
    unit: str = "quintal"
    date: str
    lastUpdated: str
    source: str = "Agmarknet / DMI, Govt. of India"

class PriceTrendPoint(BaseModel):
    date: str
    modalPrice: float
    minPrice: float
    maxPrice: float
    isLatest: bool = False

class PriceTrendResponse(BaseModel):
    cropName: str
    period: str
    data: List[PriceTrendPoint]

class PriceAlertCreate(BaseModel):
    cropName: str
    targetPrice: float
    condition: Optional[str] = "above"

class PriceAlertResponse(BaseModel):
    id: str
    farmerId: str
    cropName: str
    targetPrice: float
    condition: str
    currentPrice: float
    status: str = "active"
    createdAt: Optional[datetime] = None

class AiFarmerQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    state: Optional[str] = None
    district: Optional[str] = None
    crop: Optional[str] = None

class AiFarmerQueryResponse(BaseModel):
    answer: str
    cropDetected: Optional[str] = None
    verifiedPrices: Optional[List[CropPriceItem]] = []
    confidence: str = "high"

class FavoriteCropsRequest(BaseModel):
    crops: List[str]

# --- Prediction Center Schemas ---
class LocationInput(BaseModel):
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    mandiName: Optional[str] = None
    centerId: Optional[str] = None

class DistancePredictionRequest(BaseModel):
    source: LocationInput
    destination: LocationInput
    cropName: Optional[str] = "Wheat"
    quantity: Optional[float] = 50.0
    vehicleType: Optional[str] = "tractor_trolley"

class DistancePredictionResponse(BaseModel):
    distanceKm: float
    distanceFormatted: str
    travelTimeMinutes: int
    travelTimeFormatted: str
    recommendedRoute: str
    routeStatus: str = "Normal road traffic"
    sourceFormatted: str
    destinationFormatted: str
    sourceCoords: Dict[str, float]
    destinationCoords: Dict[str, float]
    routeWaypoints: List[Dict[str, float]] = []
    cropPricePerQuintal: Optional[float] = None
    grossCropValue: Optional[float] = None
    estimatedTransportCost: Optional[float] = None
    estimatedNetReturn: Optional[float] = None
    calculatedAt: Optional[str] = None
    sourceProvider: str = "Google Maps Platform"
    googleMapsDirectionsUrl: str = ""

class TransportCostRequest(BaseModel):
    distanceKm: float
    quantity: float
    vehicleType: Optional[str] = "tractor_trolley"

class TransportCostResponse(BaseModel):
    vehicleType: str
    vehicleName: str
    capacityQuintals: float
    tripsRequired: int
    baseRate: float
    ratePerKm: float
    estimatedCost: float
    costPerQuintal: float

class MandiComparisonItem(BaseModel):
    mandiId: str
    mandiName: str
    district: str
    state: str
    distanceKm: float
    travelTimeFormatted: str
    cropPrice: float
    grossCropValue: float
    transportCost: float
    estimatedNetReturn: float
    isRecommended: bool = False
    recommendationReason: str = ""
    directionsUrl: str = ""

class MandiRecommendationResponse(BaseModel):
    cropName: str
    quantity: float
    recommendedMandi: Optional[MandiComparisonItem] = None
    allMandis: List[MandiComparisonItem] = []
    summary: str = ""

class PredictionHistoryItem(BaseModel):
    id: str
    farmerId: str
    date: str
    cropName: str
    sourceName: str
    destinationName: str
    distanceKm: float
    travelTime: str
    cropPrice: float
    transportCost: float
    estimatedNetReturn: float
    createdAt: Optional[datetime] = None

class AiPredictionExplainRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    cropName: Optional[str] = "Wheat"
    quantity: Optional[float] = 50.0
    source: Optional[LocationInput] = None
    mandisData: Optional[List[Dict[str, Any]]] = None


