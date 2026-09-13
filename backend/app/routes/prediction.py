import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status

from backend.app.auth.jwt_handler import get_current_user, get_optional_current_user
from backend.app.models.schemas import (
    LocationInput,
    DistancePredictionRequest,
    DistancePredictionResponse,
    TransportCostRequest,
    TransportCostResponse,
    MandiRecommendationResponse,
    PredictionHistoryItem,
    AiPredictionExplainRequest
)
from backend.app.services.prediction_service import prediction_service
from backend.app.services.google_maps_service import google_maps_service
from backend.app.services.crop_price_service import crop_price_service

router = APIRouter(prefix="/api/prediction", tags=["prediction-center"])

@router.post("/distance", response_model=DistancePredictionResponse)
async def predict_distance(
    req: DistancePredictionRequest,
    current_user: Optional[dict] = Depends(get_optional_current_user)
):
    """
    Calculate Google Maps road distance, travel time, route, crop value,
    transport cost, and estimated net return between source farm and destination mandi.
    Automatically saves to farmer history if authenticated.
    """
    try:
        farmer_id = current_user.get("id") if current_user else None
        res = await prediction_service.predict_distance_and_transit(req, farmer_id=farmer_id)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Distance calculation failed: {str(e)}"
        )

@router.post("/route")
async def get_route_details(req: DistancePredictionRequest):
    """
    Returns high-resolution route waypoints, highway corridor summary,
    and 1-click Google Maps Navigation URL.
    """
    try:
        # Geocode if necessary
        src_coords = {"lat": 29.6520, "lng": 77.0210}
        if req.source.lat and req.source.lng:
            src_coords = {"lat": req.source.lat, "lng": req.source.lng}
        else:
            geo = await google_maps_service.geocode(req.source.address or req.source.village or "Kisanpur")
            src_coords = {"lat": geo["lat"], "lng": geo["lng"]}

        dest_coords = {"lat": 29.6857, "lng": 76.9905}
        if req.destination.lat and req.destination.lng:
            dest_coords = {"lat": req.destination.lat, "lng": req.destination.lng}
        else:
            geo = await google_maps_service.geocode(req.destination.mandiName or req.destination.address or "Karnal Mandi")
            dest_coords = {"lat": geo["lat"], "lng": geo["lng"]}

        route_info = await google_maps_service.get_distance_and_route(
            source_coords=src_coords,
            dest_coords=dest_coords
        )
        return {
            "sourceCoords": src_coords,
            "destinationCoords": dest_coords,
            "routeWaypoints": route_info.get("routeWaypoints", []),
            "distanceKm": route_info["distanceKm"],
            "travelTime": route_info["travelTimeFormatted"],
            "recommendedRoute": route_info["recommendedRoute"],
            "directionsUrl": route_info["googleMapsDirectionsUrl"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/nearby-mandis")
async def get_nearby_mandis(
    lat: Optional[float] = Query(None, description="Farmer source latitude"),
    lng: Optional[float] = Query(None, description="Farmer source longitude"),
    address: Optional[str] = Query("Kisanpur, Karnal", description="Farmer source location"),
    crop: Optional[str] = Query("Wheat", description="Crop filter")
):
    """
    Returns nearby agricultural markets/mandis with road distance, travel time,
    and verified Agmarknet commodity price rates.
    """
    try:
        src_coords = {"lat": 29.6520, "lng": 77.0210}
        if lat is not None and lng is not None and lat != 0:
            src_coords = {"lat": lat, "lng": lng}
        elif address:
            geo = await google_maps_service.geocode(address)
            src_coords = {"lat": geo["lat"], "lng": geo["lng"]}

        prices = await crop_price_service.get_crop_prices(crop=crop)
        if not prices:
            prices = await crop_price_service.get_crop_prices()
            prices = prices[:6]

        nearby = []
        for p in prices[:8]:
            m_name = p.get("marketName", "")
            geo_m = await google_maps_service.geocode(f"{m_name}, {p.get('district', '')}, {p.get('state', '')}")
            r_info = await google_maps_service.get_distance_and_route(
                source_coords=src_coords,
                dest_coords={"lat": geo_m["lat"], "lng": geo_m["lng"]}
            )
            nearby.append({
                "mandiId": p.get("id"),
                "mandiName": m_name,
                "district": p.get("district"),
                "state": p.get("state"),
                "cropName": p.get("cropName"),
                "modalPrice": p.get("modalPrice"),
                "minPrice": p.get("minPrice"),
                "maxPrice": p.get("maxPrice"),
                "distanceKm": r_info["distanceKm"],
                "travelTime": r_info["travelTimeFormatted"],
                "recommendedRoute": r_info["recommendedRoute"],
                "directionsUrl": r_info["googleMapsDirectionsUrl"]
            })

        # Sort by distance
        nearby.sort(key=lambda x: x["distanceKm"])
        return nearby
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transport-cost", response_model=TransportCostResponse)
async def predict_transport_cost(req: TransportCostRequest):
    """
    Calculate vehicle transport expenses based on road distance, crop quantity,
    and vehicle type (Tractor Trolley, Bolero, Small Truck, Medium Truck, Heavy 10-Wheeler).
    """
    try:
        return prediction_service.calculate_transport_cost(
            distance_km=req.distanceKm,
            quantity_quintals=req.quantity,
            vehicle_type=req.vehicleType or "tractor_trolley"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/mandi-recommendation", response_model=MandiRecommendationResponse)
async def get_mandi_recommendation(
    req: DistancePredictionRequest,
    current_user: Optional[dict] = Depends(get_optional_current_user)
):
    """
    Multi-mandi decision matrix: evaluates price, distance, transit duration,
    and transport cost to recommend the mandi with the highest Estimated Net Return.
    """
    try:
        farmer_id = current_user.get("id") if current_user else None
        res = await prediction_service.get_mandi_recommendations(
            source=req.source,
            crop_name=req.cropName or "Wheat",
            quantity=req.quantity or 50.0,
            vehicle_type=req.vehicleType or "tractor_trolley",
            farmer_id=farmer_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=List[PredictionHistoryItem])
async def get_prediction_history(current_user: dict = Depends(get_current_user)):
    """
    Retrieve past distance & economic predictions generated by the authenticated farmer.
    """
    try:
        farmer_id = current_user.get("id")
        return await prediction_service.get_history(farmer_id=farmer_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{history_id}")
async def delete_prediction_history_item(
    history_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a specific prediction history record.
    """
    try:
        farmer_id = current_user.get("id")
        deleted = await prediction_service.delete_history_item(farmer_id, history_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Prediction history record not found")
        return {"success": True, "message": "Prediction record successfully removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai-explain")
async def explain_prediction(req: AiPredictionExplainRequest):
    """
    AI Agricultural Decision Assistant:
    Explains the economic justification for the recommended mandi
    using verified prices and calculated transit costs.
    """
    try:
        mandis_data = req.mandisData or []
        res = await prediction_service.ai_explain(
            query=req.query,
            crop_name=req.cropName or "Wheat",
            quantity=req.quantity or 50.0,
            mandis_data=mandis_data
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
