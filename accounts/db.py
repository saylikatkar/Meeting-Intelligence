#from pymongo import MongoClient
#from django.conf import settings
#import certifi


#client = MongoClient(settings.MONGO_URI, tls=True,   tlsCAFile=certifi.where() )

#db = client[settings.MONGO_DB_NAME]

#users_collection = db["users"]



import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "meeting_intelligence")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(),serverSelectionTimeoutMS=10000)
db = client[MONGO_DB_NAME]


meetings_collection = db["meetings"]
users_collection = db["users"]
analytics_collection = db["analytics"]
ai_requests_collection = db["ai_request_logs"]

if __name__ == "__main__":
    try:
        client.admin.command("ping")
        print("MongoDB Atlas connected successfully!")
        print("Database:", db.name)
    except Exception as e:
        print("Mongo connection failed:", e)
    finally:
        client.close()