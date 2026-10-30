import bcrypt
from getpass import getpass
from datetime import datetime, timezone
from db import db

email = input("Admin email: ").strip().lower()
password = getpass("Admin password: ")
secret = getpass("Admin secret key: ")

db.users.update_one(
    {"email": email},
    {"$set": {
        "name": "Admin",
        "email": email,
        "role": "admin",
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()),
        "secret_key_hash": bcrypt.hashpw(secret.encode(), bcrypt.gensalt()),
        "created_at": datetime.now(timezone.utc),
    }},
    upsert=True,
)
print("Admin saved in MongoDB.")