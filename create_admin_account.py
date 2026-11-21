
import sys
import os
from pathlib import Path
from datetime import datetime
from dotenv import dotenv_values

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "meeting_intelligence_backend"

sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from services.storage.mongo import get_db, get_collection
from apps.authentication.jwt_utils import hash_password

config = dotenv_values(BASE_DIR / "frontend" / ".env")

name = config.get("VITE_ADMIN_NAME")
email = config.get("VITE_ADMIN_EMAIL", "").strip().lower()
password = config.get("VITE_ADMIN_PASSWORD")

if not name or not email or not password:
    raise SystemExit("Admin credentials missing.")

db = get_db()

if db.use_mongo:
    raise SystemExit("MongoDB detected. No changes made.")

users = get_collection("users")

if users.find_one({"email": email}):
    raise SystemExit("Account already exists. No changes made.")

admin = {
    "_id": "meetingintel-admin-local",
    "name": name,
    "email": email,
    "passwordHash": hash_password(password),
    "role": "admin",
    "status": "active",
    "totalMeetings": 0,
    "totalMinutesProcessed": 0,
    "createdAt": datetime.utcnow().isoformat(),
    "lastLoginAt": datetime.utcnow().isoformat(),
    "plan": "free",
    "subscriptionStatus": "free",
}

users.insert_one(admin)

print("Admin account created successfully!")
print("Email:", email)
print("Role: admin")
