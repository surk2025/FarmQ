import sys
import os

# Insert project root into sys.path so 'backend' module is importable
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Import the FastAPI application
from backend.app.main import app

# Export for Vercel Serverless Function (ASGI handler)
handler = app
