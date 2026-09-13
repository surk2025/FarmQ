from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from backend.app.services.crop_price_service import crop_price_service
from backend.app.auth.jwt_handler import get_current_user
from backend.app.models.schemas import (
    CropPriceItem, PriceTrendResponse, PriceAlertCreate, PriceAlertResponse
)

router = APIRouter(prefix="/api/crop-prices", tags=["crop-prices"])

@router.get("", response_model=List[CropPriceItem])
async def list_crop_prices(
    crop: Optional[str] = Query(None, description="Filter by crop name"),
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    market: Optional[str] = Query(None, description="Filter by mandi market"),
    search: Optional[str] = Query(None, description="Free text search"),
    minPrice: Optional[float] = Query(None, description="Minimum price filter"),
    maxPrice: Optional[float] = Query(None, description="Maximum price filter")
):
    """
    Search and filter latest available agricultural commodity prices from Agmarknet / official mandis.
    """
    items = await crop_price_service.get_crop_prices(
        crop=crop,
        state=state,
        district=district,
        market=market,
        search=search,
        min_price=minPrice,
        max_price=maxPrice
    )
    return [
        CropPriceItem(
            id=i["id"],
            cropName=i["cropName"],
            variety=i["variety"],
            marketName=i["marketName"],
            state=i["state"],
            district=i["district"],
            minPrice=i["minPrice"],
            maxPrice=i["maxPrice"],
            modalPrice=i["modalPrice"],
            unit=i.get("unit", "quintal"),
            date=i["date"],
            lastUpdated=i.get("lastUpdated", "Today"),
            source=i.get("source", "Agmarknet / DMI, Govt. of India")
        )
        for i in items
    ]

@router.get("/trends", response_model=PriceTrendResponse)
async def get_price_trends(
    crop: str = Query("Wheat", description="Crop commodity name"),
    period: str = Query("7d", description="Period: 7d, 30d, 3m")
):
    """
    Retrieves historical price trend data (7 days, 30 days, or 3 months)
    with clear labeling between historical records and the latest available data.
    """
    if period not in ["7d", "30d", "3m"]:
        period = "7d"
    trend_data = await crop_price_service.get_price_trends(crop=crop, period=period)
    return PriceTrendResponse(**trend_data)

@router.get("/alerts", response_model=List[PriceAlertResponse])
async def get_alerts(current_user: dict = Depends(get_current_user)):
    """
    Fetches active price alerts for the authenticated farmer.
    """
    farmer_id = current_user["id"]
    alerts = await crop_price_service.get_farmer_alerts(farmer_id)
    return [PriceAlertResponse(**a) for a in alerts]

@router.post("/alerts", response_model=PriceAlertResponse)
async def create_alert(
    alert_in: PriceAlertCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Creates a new target price alert for a crop.
    """
    farmer_id = current_user["id"]
    alert = await crop_price_service.create_price_alert(
        farmer_id=farmer_id,
        crop_name=alert_in.cropName,
        target_price=alert_in.targetPrice,
        condition=alert_in.condition or "above"
    )
    return PriceAlertResponse(**alert)

@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Deletes an existing price alert.
    """
    farmer_id = current_user["id"]
    deleted = await crop_price_service.delete_price_alert(farmer_id, alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Price alert not found")
    return {"message": "Price alert deleted successfully"}

@router.get("/{crop}", response_model=List[CropPriceItem])
async def get_crop_prices_by_name(crop: str):
    """
    Get latest prices for a specific crop across all available mandis.
    """
    items = await crop_price_service.get_price_by_crop(crop)
    return [
        CropPriceItem(
            id=i["id"],
            cropName=i["cropName"],
            variety=i["variety"],
            marketName=i["marketName"],
            state=i["state"],
            district=i["district"],
            minPrice=i["minPrice"],
            maxPrice=i["maxPrice"],
            modalPrice=i["modalPrice"],
            unit=i.get("unit", "quintal"),
            date=i["date"],
            lastUpdated=i.get("lastUpdated", "Today"),
            source=i.get("source", "Agmarknet / DMI, Govt. of India")
        )
        for i in items
    ]
