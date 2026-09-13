from typing import List, Dict, Any, Optional
from bson import ObjectId
from backend.app.database.connection import get_database
from backend.ml.predict import predict_waiting_time, format_minutes

async def get_center_recommendation(selected_center_id: Optional[str] = None, farmer_lat: float = 29.6857, farmer_lng: float = 76.9905) -> Optional[Dict[str, Any]]:
    db = get_database()
    centers = await db.procurement_centers.find({"status": {"$ne": "closed"}}).to_list(20)
    if not centers or len(centers) < 2:
        return None
    
    # Calculate queue and wait metrics for all centers
    center_metrics = []
    selected_metric = None
    
    for c in centers:
        c_id = str(c["_id"])
        # Active queue count
        queue_count = await db.queue_tokens.count_documents({
            "centerId": c_id,
            "status": {"$in": ["waiting", "processing", "arrived", "verification"]}
        })
        
        active_counters = c.get("activeCounters", 2)
        avg_processing = c.get("avgProcessingMinutes", 8)
        pred = predict_waiting_time(
            farmers_ahead=queue_count,
            avg_processing_time=avg_processing,
            crop_quantity=50.0,
            active_counters=active_counters
        )
        
        daily_cap = c.get("capacityPerDay", 150.0)
        booked_qty = c.get("bookedQuantity", 0.0)
        remaining_cap = max(0.0, daily_cap - booked_qty)
        distance = c.get("distanceKm", 5.0)
        
        # Composite score: lower is better
        # We weigh wait time heavily (0.6), distance (0.25), and capacity headroom (0.15)
        capacity_penalty = 50.0 if remaining_cap < 20 else 0.0
        score = (pred["estimated_wait_minutes"] * 0.6) + (distance * 3.0 * 0.25) + capacity_penalty
        
        metric = {
            "centerId": c_id,
            "name": c.get("name"),
            "distanceKm": distance,
            "queueCount": queue_count,
            "estimatedWaitMinutes": pred["estimated_wait_minutes"],
            "formattedWaitTime": pred["formatted_wait_time"],
            "remainingCapacity": remaining_cap,
            "score": score
        }
        center_metrics.append(metric)
        if selected_center_id and c_id == selected_center_id:
            selected_metric = metric
            
    # Sort centers by optimal score
    center_metrics.sort(key=lambda x: x["score"])
    best = center_metrics[0]
    
    # If a center was selected and is already the best, or no selected center provided
    if selected_metric:
        if best["centerId"] == selected_metric["centerId"]:
            # If the selected center is already the best, no alternate recommendation needed
            return {
                "hasRecommendation": False,
                "selectedCenter": selected_metric,
                "message": "Your selected center currently has the optimal balance of wait time and capacity."
            }
        
        wait_diff = selected_metric["estimatedWaitMinutes"] - best["estimatedWaitMinutes"]
        reasons = []
        if best["queueCount"] < selected_metric["queueCount"]:
            reasons.append(f"Shorter queue ({best['queueCount']} farmers vs {selected_metric['queueCount']})")
        if best["estimatedWaitMinutes"] < selected_metric["estimatedWaitMinutes"]:
            reasons.append(f"Saves ~{wait_diff} minutes in estimated waiting time")
        if best["remainingCapacity"] > selected_metric["remainingCapacity"]:
            reasons.append(f"More available intake capacity ({best['remainingCapacity']} Q remaining)")
        if not reasons:
            reasons.append("Less congestion and faster counter throughput")
            
        return {
            "hasRecommendation": True,
            "selectedCenter": selected_metric,
            "recommendedCenter": best,
            "timeSavedMinutes": max(0, wait_diff),
            "reasons": reasons,
            "whyText": "Recommended based on real-time queue length, counter throughput, and remaining procurement capacity."
        }
    else:
        # Suggest overall top center
        return {
            "hasRecommendation": True,
            "recommendedCenter": best,
            "reasons": [
                f"Lowest wait time ({best['formattedWaitTime']})",
                f"Only {best['queueCount']} farmers in queue",
                f"{best['remainingCapacity']} Quintal intake capacity available"
            ],
            "whyText": "Recommended based on lowest real-time queue congestion."
        }
