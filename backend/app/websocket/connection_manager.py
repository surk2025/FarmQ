from typing import Dict, List
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger("farmq.websocket")

class ConnectionManager:
    def __init__(self):
        # Maps center_id -> list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Global listeners (e.g. admins monitoring all centers)
        self.global_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, center_id: str):
        await websocket.accept()
        if center_id not in self.active_connections:
            self.active_connections[center_id] = []
        self.active_connections[center_id].append(websocket)
        logger.info(f"WebSocket connected for center: {center_id}. Total: {len(self.active_connections[center_id])}")

    def disconnect(self, websocket: WebSocket, center_id: str):
        if center_id in self.active_connections:
            if websocket in self.active_connections[center_id]:
                self.active_connections[center_id].remove(websocket)
            if not self.active_connections[center_id]:
                del self.active_connections[center_id]
        if websocket in self.global_connections:
            self.global_connections.remove(websocket)
        logger.info(f"WebSocket disconnected for center: {center_id}")

    async def broadcast_to_center(self, center_id: str, message: dict):
        payload = json.dumps(message)
        dead_sockets = []
        # Broadcast to center subscribers
        if center_id in self.active_connections:
            for connection in self.active_connections[center_id]:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.warning(f"Error sending to WebSocket: {e}")
                    dead_sockets.append(connection)

            for dead in dead_sockets:
                if dead in self.active_connections.get(center_id, []):
                    self.active_connections[center_id].remove(dead)

        # Also broadcast to global admin connections
        global_dead = []
        for connection in self.global_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                global_dead.append(connection)
        for dead in global_dead:
            if dead in self.global_connections:
                self.global_connections.remove(dead)

    async def broadcast_all(self, message: dict):
        payload = json.dumps(message)
        for center_id in list(self.active_connections.keys()):
            await self.broadcast_to_center(center_id, message)

ws_manager = ConnectionManager()
