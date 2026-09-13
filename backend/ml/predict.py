import os
import json
from datetime import datetime
from typing import Dict, Any
from backend.ml.train import SimpleRandomForestRegressor

MODEL = None
MODEL_META = None

def load_model():
    global MODEL, MODEL_META
    if MODEL is not None:
        return MODEL, MODEL_META
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "model", "waiting_time_model.json")
    meta_path = os.path.join(base_dir, "model", "model_meta.json")
    
    if os.path.exists(model_path):
        try:
            MODEL = SimpleRandomForestRegressor.load(model_path)
            if os.path.exists(meta_path):
                with open(meta_path, "r") as f:
                    MODEL_META = json.load(f)
            return MODEL, MODEL_META
        except Exception as e:
            print(f"Warning: Failed to load ML model: {e}")
            return None, None
    return None, None

def format_minutes(minutes: int) -> str:
    if minutes <= 0:
        return "Immediate / Next"
    hours = minutes // 60
    mins = minutes % 60
    if hours == 0:
        return f"{mins}m"
    elif mins == 0:
        return f"{hours}h"
    else:
        return f"{hours}h {mins}m"

def calculate_fallback_wait_time(
    farmers_ahead: int,
    avg_processing_time: float = 8.0,
    crop_quantity: float = 50.0,
    active_counters: int = 2,
    time_slot_hour: int = 10,
    day_of_week: int = 2
) -> int:
    """Robust mathematical queuing formula when ML model is not available"""
    if farmers_ahead <= 0:
        return 3  # Near zero, ready for counter
    
    counters = max(1, active_counters)
    base_wait = (farmers_ahead / counters) * avg_processing_time
    qty_factor = 1.0 + (crop_quantity / 200.0) * 0.20
    peak_factor = 1.15 if 10 <= time_slot_hour <= 13 else 1.0
    day_factor = 1.08 if day_of_week == 0 else 1.0
    
    estimated = base_wait * qty_factor * peak_factor * day_factor
    return max(3, int(round(estimated)))

def predict_waiting_time(
    farmers_ahead: int,
    avg_processing_time: float = 8.0,
    crop_quantity: float = 50.0,
    active_counters: int = 2,
    current_queue_length: int = None,
    historical_avg: float = 60.0,
    day_of_week: int = None,
    time_slot_hour: int = None
) -> Dict[str, Any]:
    now = datetime.now()
    if day_of_week is None:
        day_of_week = now.weekday()
    if time_slot_hour is None:
        time_slot_hour = now.hour if 8 <= now.hour <= 18 else 10
    if current_queue_length is None:
        current_queue_length = max(farmers_ahead + 2, farmers_ahead)
    
    model, meta = load_model()
    
    if model is not None:
        try:
            sample = {
                "farmers_ahead": float(farmers_ahead),
                "avg_processing_time": float(avg_processing_time),
                "crop_quantity": float(crop_quantity),
                "active_counters": float(active_counters),
                "current_queue_length": float(current_queue_length),
                "historical_avg": float(historical_avg),
                "day_of_week": float(day_of_week),
                "time_slot_hour": float(time_slot_hour)
            }
            predicted_raw = model.predict(sample)
            estimated_minutes = max(2, int(round(predicted_raw)))
            confidence = "High" if farmers_ahead < 20 else "Moderate"
            model_used = "Random Forest Regressor (AI Model)"
        except Exception as e:
            print(f"ML prediction error: {e}. Falling back to formula.")
            estimated_minutes = calculate_fallback_wait_time(
                farmers_ahead, avg_processing_time, crop_quantity, active_counters, time_slot_hour, day_of_week
            )
            confidence = "Approximate"
            model_used = "Mathematical Queuing Formula (Fallback)"
    else:
        estimated_minutes = calculate_fallback_wait_time(
            farmers_ahead, avg_processing_time, crop_quantity, active_counters, time_slot_hour, day_of_week
        )
        confidence = "Approximate"
        model_used = "Mathematical Queuing Formula (Fallback)"
    
    formatted_time = format_minutes(estimated_minutes)
    
    # Exact arrival timing guidance: "Farmer ko procurement center par exactly kab pahunchna chahiye?"
    if estimated_minutes > 45:
        arrival_buffer = 20
        advice = f"Plan to arrive at the center ~{arrival_buffer} mins before your turn ({format_minutes(max(10, estimated_minutes - arrival_buffer))} from now). Avoid standing in long queues early!"
    elif estimated_minutes > 15:
        advice = "Your turn is approaching within the next hour. Head towards the gate and keep your crop pass ready."
    else:
        advice = "You are next in queue! Please proceed directly to Counter/Inspection bay."
    
    return {
        "farmers_ahead": farmers_ahead,
        "estimated_wait_minutes": estimated_minutes,
        "formatted_wait_time": formatted_time,
        "confidence": confidence,
        "active_counters": active_counters,
        "model_used": model_used,
        "factors": {
            "avg_processing_time_min": avg_processing_time,
            "crop_quantity_quintal": crop_quantity,
            "active_counters": active_counters,
            "peak_hour": 10 <= time_slot_hour <= 13,
            "time_slot_hour": time_slot_hour
        },
        "advice": advice
    }
