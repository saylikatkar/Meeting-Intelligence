from pathlib import Path
from dotenv import dotenv_values
from datetime import datetime

from services.storage.mongo import get_db, get_collection
from apps.authentication.jwt_utils import hash_password

config = dotenv_values(Path("../frontend/.env"))

name = config.get("VITE_ADMIN_NAME")
email = (config.get("VITE_ADMIN_EMAIL") or "").strip().lower()
password = config.get("VITE_ADMIN_PASSWORD")

db = get_db()

print("Atlas connected:", db.use_mongo)

if not db.use_mongo:
    raise SystemExit("Atlas is not connected. No changes made.")

if not name or not email or not password:
    raise SystemExit("Admin credentials missing. No changes made.")

users = get_collection("users")

if users.find_one({"email": email}):
    print("Account already exists. No changes made.")
else:
    admin = {
        "_id": "meetingintel-admin-atlas",
        "name": name,
        "email": email,
        "passwordHash": hash_password(password),
        "role": "admin",
        "status": "active",
        "totalMeetings": 0,
        "totalMinutesProcessed": 0,
        "createdAt": datetime.now().isoformat(),
        "lastLoginAt": datetime.now().isoformat(),
        "plan": "free",
        "subscriptionStatus": "free",
    }

    users.insert_one(admin)
    print("Admin account created successfully in Atlas.")

print("Email:", email)
