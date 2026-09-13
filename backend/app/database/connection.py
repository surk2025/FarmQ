import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "farmq")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
        db_instance.db = db_instance.client[DATABASE_NAME]
        # Quick ping
        await db_instance.client.admin.command('ping')
        print(f"Connected to MongoDB at {MONGODB_URL}, database: {DATABASE_NAME}")
    except Exception as e:
        print(f"Warning: Could not connect to MongoDB: {e}")
        # Allow server to start even if Mongo is temporarily offline

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_instance.db

def get_sync_db():
    """Synchronous client for seeding and scripts"""
    client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
    return client[DATABASE_NAME]
