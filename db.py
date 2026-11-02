
import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "meeting_intelligence")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is missing from .env")

client = MongoClient(
    MONGODB_URI,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=15000,
)

db = client[MONGODB_DB]

if __name__ == "__main__":
    try:
        client.admin.command("ping")
        print("MongoDB Atlas connected successfully!")
        print("Database:", db.name)
    except Exception as e:
        print("MongoDB connection failed:", e)
    finally:
        client.close()
