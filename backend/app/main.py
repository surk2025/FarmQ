import os
import sys

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

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from backend.app.services.queue_service import init_queue_indexes
from backend.app.services.otp_service import init_otp_indexes
from backend.app.websocket.connection_manager import ws_manager
from backend.ml.predict import load_model

# Routers
from backend.app.routes.auth import router as auth_router
from backend.app.routes.farmer import router as farmer_router
from backend.app.routes.centers import router as centers_router
from backend.app.routes.slots import router as slots_router
from backend.app.routes.queue import router as queue_router
from backend.app.routes.procurement import router as procurement_router
from backend.app.routes.notifications import router as notifications_router
from backend.app.routes.admin import router as admin_router
from backend.app.routes.payments import router as payments_router
from backend.app.routes.crop_prices import router as crop_prices_router
from backend.app.routes.ai import router as ai_router
from backend.app.routes.prediction import router as prediction_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    db = get_database()
    if db is not None:
        await init_queue_indexes(db)
        await init_otp_indexes(db)
    load_model()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title="FarmQ API",
    description="Smart Agricultural Procurement & Queue Management System API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router)
app.include_router(farmer_router)
app.include_router(centers_router)
app.include_router(slots_router)
app.include_router(queue_router)
app.include_router(procurement_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(payments_router)
app.include_router(crop_prices_router)
app.include_router(ai_router)
app.include_router(prediction_router)

# WebSocket Route for Real-Time Queue Updates
@app.websocket("/ws/queue/{center_id}")
async def websocket_queue_endpoint(websocket: WebSocket, center_id: str):
    await ws_manager.connect(websocket, center_id)
    try:
        # Send initial confirmation
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "centerId": center_id,
            "message": f"Connected to live queue channel for center: {center_id}"
        })
        while True:
            # Keep connection alive and listen for client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, center_id)
    except Exception as e:
        ws_manager.disconnect(websocket, center_id)

@app.get("/api")
@app.get("/")
async def api_root():
    return {
        "status": "online",
        "service": "FarmQ API",
        "version": "1.0.0",
        "tagline": "Smart Agricultural Procurement & Queue Management System",
        "message": "FarmQ backend is running successfully."
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "FarmQ API",
        "version": "1.0.0",
        "tagline": "Smart Procurement. Less Waiting. Better Farming."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
