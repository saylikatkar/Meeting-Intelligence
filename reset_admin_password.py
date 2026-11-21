import os
import sys
import getpass
from pathlib import Path

backend = Path(__file__).parent / "meeting_intelligence_backend"
sys.path.insert(0, str(backend))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from services.storage.mongo import get_db, get_collection
from apps.authentication.jwt_utils import hash_password

db = get_db()

if db.use_mongo:
    print("STOP: Backend is using MongoDB, not the local JSON database.")
    raise SystemExit(1)

users = get_collection("users")
email = "ayush@example.com"
user = users.find_one({"email": email})

if not user:
    print("Admin account not found.")
    raise SystemExit(1)

if user.get("role") != "admin":
    print("STOP: The selected account is not an admin.")
    raise SystemExit(1)

password = getpass.getpass("Enter your new admin password: ")
confirm = getpass.getpass("Confirm your new admin password: ")

if password != confirm:
    print("Passwords do not match. No changes made.")
    raise SystemExit(1)

if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
    print("Password must contain at least 8 characters, one letter and one number.")
    raise SystemExit(1)

result = users.update_one(
    {"_id": user["_id"]},
    {"$set": {"passwordHash": hash_password(password)}}
)

if result.matched_count == 1:
    print("Admin password reset successfully.")
else:
    print("Password update failed.")
