
import re
import getpass
import bcrypt
from datetime import datetime, timezone

from db import db


def create_admin():
    print("\nCREATE ADMIN ACCOUNT")
    print("--------------------")

    name = input("Enter admin name: ").strip()
    email = input("Enter admin email: ").strip().lower()
    password = getpass.getpass("Enter admin password: ")
    confirm_password = getpass.getpass("Confirm admin password: ")

    if len(name) < 2:
        print("Name must contain at least 2 characters.")
        return

    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        print("Please enter a valid email address.")
        return

    if len(password) < 8:
        print("Password must contain at least 8 characters.")
        return

    if len(password.encode("utf-8")) > 72:
        print("Password is too long.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    existing = db.users.find_one({
        "email": {
            "$regex": f"^{re.escape(email)}$",
            "$options": "i"
        }
    })

    if existing:
        print("An account with this email already exists.")
        print("No account was created.")
        return

    admin = {
        "name": name,
        "email": email,
        "password_hash": bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ),
        "role": "admin",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }

    db.users.insert_one(admin)

    print("\nAdmin account created successfully!")
    print("Name:", name)
    print("Email:", email)
    print("Role: admin")
    print("Status: active")
    print("Password: securely stored")


if __name__ == "__main__":
    create_admin()
