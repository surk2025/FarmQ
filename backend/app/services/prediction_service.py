import os
import math
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
from bson import ObjectId

from backend.app.database.connection import get_database
from backend.app.services.google_maps_service import google_maps_service
from backend.app.services.crop_price_service import crop_price_service
from backend.app.models.schemas import (
    LocationInput,
    DistancePredictionRequest,
    DistancePredictionResponse,
    TransportCostRequest,
    TransportCostResponse,
    MandiComparisonItem,
    MandiRecommendationResponse,
    PredictionHistoryItem
)

# Realistic Vehicle Transport Rate Card for Agricultural Goods in India
VEHICLE_RATES: Dict[str, Dict[str, Any]] = {
    "tractor_trolley": {
        "name": "Tractor Trolley",
        "capacity": 50.0,      # Quintals
        "base_rate": 400.0,    # Base loading & hookup fee (INR)
        "rate_per_km": 18.0    # Per km road rate (INR/km)
    },
    "pickup_bolero": {
        "name": "Mahindra Bolero Maxi Truck / Pickup",
        "capacity": 30.0,
        "base_rate": 500.0,
        "rate_per_km": 22.0
    },
    "small_truck": {
        "name": "Small Commercial Truck (Tata Ace)",
        "capacity": 25.0,
        "base_rate": 450.0,
        "rate_per_km": 20.0
    },
    "medium_truck": {
        "name": "Medium Truck (Eicher 6-Wheeler)",
        "capacity": 90.0,
        "base_rate": 900.0,
        "rate_per_km": 32.0
    },
    "heavy_truck": {
        "name": "Heavy Truck (10-Wheeler Multi-Axle)",
        "capacity": 200.0,
        "base_rate": 1600.0,
        "rate_per_km": 48.0
    }
}

class PredictionService:
    def calculate_transport_cost(self, distance_km: float, quantity_quintals: float, vehicle_type: str = "tractor_trolley") -> TransportCostResponse:
        v_key = vehicle_type.lower() if vehicle_type in VEHICLE_RATES else "tractor_trolley"
        rate_info = VEHICLE_RATES.get(v_key, VEHICLE_RATES["tractor_trolley"])
        capacity = rate_info["capacity"]

        qty = max(0.1, quantity_quintals)
        trips = max(1, math.ceil(qty / capacity))
        base = rate_info["base_rate"]
        per_km = rate_info["rate_per_km"]

        # Cost per trip = base + (distance * per_km)
        cost_per_trip = base + (distance_km * per_km)
        total_cost = round(cost_per_trip * trips, 2)
        cost_per_qtl = round(total_cost / qty, 2)

        return TransportCostResponse(
            vehicleType=v_key,
            vehicleName=rate_info["name"],
            capacityQuintals=capacity,
            tripsRequired=trips,
            baseRate=base,
            ratePerKm=per_km,
            estimatedCost=total_cost,
            costPerQuintal=cost_per_qtl
        )

    async def predict_distance_and_transit(self, req: DistancePredictionRequest, farmer_id: Optional[str] = None) -> DistancePredictionResponse:
        # 1. Resolve source coordinates
        src_coords = {"lat": 29.6520, "lng": 77.0210}
        src_name = req.source.address or req.source.village or "Farmer Farm Location"
        if req.source.lat is not None and req.source.lng is not None and req.source.lat != 0:
            src_coords = {"lat": req.source.lat, "lng": req.source.lng}
        else:
            geo = await google_maps_service.geocode(src_name)
            src_coords = {"lat": geo["lat"], "lng": geo["lng"]}
            src_name = geo["formatted"]

        # 2. Resolve destination coordinates
        dest_coords = {"lat": 29.6857, "lng": 76.9905}
        dest_name = req.destination.mandiName or req.destination.address or req.destination.village or "Karnal Grain Mandi"
        if req.destination.lat is not None and req.destination.lng is not None and req.destination.lat != 0:
            dest_coords = {"lat": req.destination.lat, "lng": req.destination.lng}
        else:
            geo = await google_maps_service.geocode(dest_name)
            dest_coords = {"lat": geo["lat"], "lng": geo["lng"]}
            dest_name = geo["formatted"]

        # 3. Calculate Google Maps distance & route
        route_data = await google_maps_service.get_distance_and_route(
            source_coords=src_coords,
            dest_coords=dest_coords,
            source_name=src_name,
            dest_name=dest_name
        )

        dist_km = route_data["distanceKm"]
        qty = req.quantity if req.quantity and req.quantity > 0 else 50.0
        v_type = req.vehicleType or "tractor_trolley"

        # 4. Economic Calculations: Crop Price, Value & Transport Cost
        crop_price = None
        gross_value = None
        net_return = None
        transport_resp = self.calculate_transport_cost(dist_km, qty, v_type)
        transport_cost = transport_resp.estimatedCost

        crop_name = req.cropName or "Wheat"
        matching_prices = await crop_price_service.get_crop_prices(crop=crop_name)
        if matching_prices:
            # Match destination market if possible
            mandi_match = next((p for p in matching_prices if p["marketName"].lower() in dest_name.lower() or dest_name.lower() in p["marketName"].lower()), matching_prices[0])
            crop_price = mandi_match["modalPrice"]
            gross_value = round(crop_price * qty, 2)
            net_return = round(gross_value - transport_cost, 2)

        calc_time_str = datetime.utcnow().strftime("%d %b %Y, %I:%M %p UTC")

        response = DistancePredictionResponse(
            distanceKm=dist_km,
            distanceFormatted=route_data["distanceFormatted"],
            travelTimeMinutes=route_data["travelTimeMinutes"],
            travelTimeFormatted=route_data["travelTimeFormatted"],
            recommendedRoute=route_data["recommendedRoute"],
            routeStatus=route_data["routeStatus"],
            sourceFormatted=src_name,
            destinationFormatted=dest_name,
            sourceCoords=src_coords,
            destinationCoords=dest_coords,
            routeWaypoints=route_data.get("routeWaypoints", []),
            cropPricePerQuintal=crop_price,
            grossCropValue=gross_value,
            estimatedTransportCost=transport_cost,
            estimatedNetReturn=net_return,
            calculatedAt=calc_time_str,
            sourceProvider=route_data.get("sourceProvider", "Google Maps Platform"),
            googleMapsDirectionsUrl=route_data.get("googleMapsDirectionsUrl", "")
        )

        # 5. Persist into Prediction History if farmer_id provided
        if farmer_id:
            try:
                db = get_database()
                history_doc = {
                    "farmerId": farmer_id,
                    "date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "cropName": crop_name,
                    "quantity": qty,
                    "vehicleType": v_type,
                    "sourceName": src_name,
                    "destinationName": dest_name,
                    "distanceKm": dist_km,
                    "travelTime": route_data["travelTimeFormatted"],
                    "cropPrice": crop_price or 0.0,
                    "transportCost": transport_cost,
                    "estimatedNetReturn": net_return or 0.0,
                    "createdAt": datetime.utcnow()
                }
                await db.prediction_history.insert_one(history_doc)
            except Exception as e:
                print(f"[PREDICTION HISTORY ERROR] Failed to save history: {e}")

        return response

    async def get_mandi_recommendations(
        self,
        source: LocationInput,
        crop_name: str = "Wheat",
        quantity: float = 50.0,
        vehicle_type: str = "tractor_trolley",
        farmer_id: Optional[str] = None
    ) -> MandiRecommendationResponse:
        """
        Smart Mandi Recommendation Engine:
        Evaluates nearby verified agricultural mandis on distance, travel time, verified crop prices,
        and transport costs to find the market delivering highest Estimated Net Return.
        """
        # Resolve source coordinates
        src_name = source.address or source.village or "Kisanpur, Karnal"
        if source.lat is not None and source.lng is not None and source.lat != 0:
            src_coords = {"lat": source.lat, "lng": source.lng}
        else:
            geo = await google_maps_service.geocode(src_name)
            src_coords = {"lat": geo["lat"], "lng": geo["lng"]}
            src_name = geo["formatted"]

        # Fetch verified crop prices from Agmarknet
        prices = await crop_price_service.get_crop_prices(crop=crop_name)
        if not prices:
            # Fallback to general staple if requested crop had zero rows
            prices = await crop_price_service.get_crop_prices()
            prices = [p for p in prices if p.get("modalPrice", 0) > 0][:5]

        # Limit to top relevant mandis
        mandis_to_evaluate = prices[:6]
        comparison_items: List[MandiComparisonItem] = []

        for p in mandis_to_evaluate:
            m_name = p["marketName"]
            m_dist = p.get("district", "")
            m_state = p.get("state", "")
            geo_mandi = await google_maps_service.geocode(f"{m_name}, {m_dist}, {m_state}")
            dest_coords = {"lat": geo_mandi["lat"], "lng": geo_mandi["lng"]}

            # Compute route & distance
            route_res = await google_maps_service.get_distance_and_route(
                source_coords=src_coords,
                dest_coords=dest_coords,
                source_name=src_name,
                dest_name=m_name
            )
            dist_km = route_res["distanceKm"]
            travel_fmt = route_res["travelTimeFormatted"]

            # Compute economics
            t_cost_res = self.calculate_transport_cost(dist_km, quantity, vehicle_type)
            transport_cost = t_cost_res.estimatedCost
            modal_price = float(p.get("modalPrice", 2200.0))
            gross_val = round(modal_price * quantity, 2)
            net_ret = round(gross_val - transport_cost, 2)

            directions_url = f"https://www.google.com/maps/dir/?api=1&origin={src_coords['lat']},{src_coords['lng']}&destination={dest_coords['lat']},{dest_coords['lng']}&travelmode=driving"

            comparison_items.append(MandiComparisonItem(
                mandiId=p.get("id", f"mandi-{len(comparison_items)}"),
                mandiName=m_name,
                district=m_dist,
                state=m_state,
                distanceKm=dist_km,
                travelTimeFormatted=travel_fmt,
                cropPrice=modal_price,
                grossCropValue=gross_val,
                transportCost=transport_cost,
                estimatedNetReturn=net_ret,
                isRecommended=False,
                recommendationReason="",
                directionsUrl=directions_url
            ))

        if not comparison_items:
            return MandiRecommendationResponse(
                cropName=crop_name,
                quantity=quantity,
                recommendedMandi=None,
                allMandis=[],
                summary="No agricultural mandis currently available for comparison."
            )

        # Sort by Estimated Net Return descending (Farmer profitability first)
        comparison_items.sort(key=lambda x: x.estimatedNetReturn, reverse=True)

        best_mandi = comparison_items[0]
        best_mandi.isRecommended = True

        # Generate clear justification reason
        if len(comparison_items) > 1:
            runner_up = comparison_items[1]
            diff = round(best_mandi.estimatedNetReturn - runner_up.estimatedNetReturn, 2)
            if best_mandi.distanceKm < runner_up.distanceKm:
                best_mandi.recommendationReason = (
                    f"Optimal choice: ₹{best_mandi.cropPrice:,.0f}/Qtl with lower transport of ₹{best_mandi.transportCost:,.0f} "
                    f"({best_mandi.distanceKm} km). Gives ₹{diff:,.0f} more net profit than {runner_up.mandiName}."
                )
            else:
                best_mandi.recommendationReason = (
                    f"Highest Net Profit: Higher modal rate (₹{best_mandi.cropPrice:,.0f}/Qtl) outweighs the additional transit cost "
                    f"of ₹{best_mandi.transportCost:,.0f}, yielding ₹{diff:,.0f} more net profit."
                )
        else:
            best_mandi.recommendationReason = f"Recommended market with estimated net return of ₹{best_mandi.estimatedNetReturn:,.0f}."

        summary_text = (
            f"Evaluated {len(comparison_items)} regional mandis for {quantity} Qtl {crop_name}. "
            f"'{best_mandi.mandiName}' is predicted to yield the highest estimated net return of ₹{best_mandi.estimatedNetReturn:,.2f}."
        )

        return MandiRecommendationResponse(
            cropName=crop_name,
            quantity=quantity,
            recommendedMandi=best_mandi,
            allMandis=comparison_items,
            summary=summary_text
        )

    async def get_history(self, farmer_id: str, limit: int = 20) -> List[PredictionHistoryItem]:
        db = get_database()
        cursor = db.prediction_history.find({"farmerId": farmer_id}).sort("createdAt", -1).limit(limit)
        docs = await cursor.to_list(limit)
        items = []
        for d in docs:
            items.append(PredictionHistoryItem(
                id=str(d["_id"]),
                farmerId=d.get("farmerId", farmer_id),
                date=d.get("date", ""),
                cropName=d.get("cropName", "Wheat"),
                sourceName=d.get("sourceName", "Farm"),
                destinationName=d.get("destinationName", "Mandi"),
                distanceKm=float(d.get("distanceKm", 0.0)),
                travelTime=d.get("travelTime", ""),
                cropPrice=float(d.get("cropPrice", 0.0)),
                transportCost=float(d.get("transportCost", 0.0)),
                estimatedNetReturn=float(d.get("estimatedNetReturn", 0.0)),
                createdAt=d.get("createdAt")
            ))
        return items

    async def delete_history_item(self, farmer_id: str, history_id: str) -> bool:
        db = get_database()
        oid = ObjectId(history_id) if ObjectId.is_valid(history_id) else history_id
        res = await db.prediction_history.delete_one({"_id": oid, "farmerId": farmer_id})
        return res.deleted_count > 0

    async def ai_explain(self, query: str, crop_name: str, quantity: float, mandis_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Explains the prediction results using Gemini API (or structured grounded fallback).
        Strictly strictly adheres to verified distances and prices.
        """
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and mandis_data:
            try:
                system_instruction = (
                    "You are FarmQ Agri-Logistics Advisor. Analyze the provided verified mandi distance, price, "
                    "and transport cost comparisons for the farmer. Explain clearly why the recommended mandi was chosen "
                    "in terms of Estimated Net Return = Gross Value - Transport Cost. "
                    "CRITICAL: Do NOT invent or fabricate any numbers. Use only the provided figures."
                )
                data_context = json.dumps(mandis_data[:5], ensure_ascii=False, indent=2)
                prompt = f"""
Farmer Question: {query}
Crop: {crop_name}, Quantity: {quantity} Quintals

VERIFIED PREDICTION & MARKET DATA:
{data_context}

Provide a concise, practical breakdown for the farmer highlighting:
1. Optimal Mandi Choice and why
2. Price vs Distance Trade-off comparison
3. Net Return summary
"""
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                payload = {
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500}
                }
                resp = requests.post(url, json=payload, timeout=8)
                if resp.status_code == 200:
                    cand = resp.json().get("candidates", [])
                    if cand:
                        text = cand[0].get("content", {}).get("parts", [])[0].get("text", "")
                        if text:
                            return {"explanation": text.strip(), "source": "Gemini AI Engine"}
            except Exception as e:
                print(f"[GEMINI EXPLAIN NOTICE] {e}")

        # Grounded Fallback explanation without hallucinations
        if not mandis_data:
            return {
                "explanation": f"Please run a distance calculation to generate mandi predictions for {crop_name}.",
                "source": "FarmQ Logic Engine"
            }

        top = mandis_data[0]
        m_name = top.get("mandiName", "Recommended Mandi")
        m_price = top.get("cropPrice", 0)
        m_dist = top.get("distanceKm", 0)
        m_trans = top.get("transportCost", 0)
        m_net = top.get("estimatedNetReturn", 0)

        explanation = (
            f"### 📍 Mandi Recommendation Analysis for {quantity} Qtl {crop_name}\n\n"
            f"**1. Recommended Destination:** **{m_name}**\n"
            f"- **Mandi Rate:** ₹{m_price:,.2f} per Quintal\n"
            f"- **Road Transit Distance:** {m_dist} km\n"
            f"- **Estimated Transport Expense:** ₹{m_trans:,.2f}\n"
            f"- **Estimated Net Return:** **₹{m_net:,.2f}**\n\n"
            f"**2. Economic Logic:**\n"
            f"While distant mandis might sometimes offer slightly higher gross rates, transporting {quantity} Qtl over additional mileage increases vehicle rental significantly. "
            f"**{m_name}** strikes the optimal balance between high procurement rate and minimal logistics expense, ensuring the highest net cash in hand."
        )

        return {"explanation": explanation, "source": "FarmQ Grounded Prediction Engine"}

prediction_service = PredictionService()
