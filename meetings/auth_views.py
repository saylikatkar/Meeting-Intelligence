
import os
import re
import jwt
import bcrypt
from datetime import datetime, timezone

from rest_framework.decorators import api_view
from rest_framework.response import Response

from db import db

JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("DJANGO_SECRET_KEY")


def create_token(user):
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET or DJANGO_SECRET_KEY is not configured.")

    payload = {
        "sub": str(user["_id"]),
        "role": user["role"],
        "iat": datetime.now(timezone.utc),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )


def get_password_hash(user):
    stored_hash = user.get("password_hash") or user.get("passwordHash")

    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    return stored_hash


def verify_password(password, stored_hash):
    if not stored_hash:
        return False

    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            stored_hash
        )
    except (ValueError, TypeError):
        return False


def get_user_response(user):
    return {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", "member"),
    }


@api_view(["POST"])
def register(request):
    name = request.data.get("name", "").strip()
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if len(name) < 2:
        return Response(
            {"detail": "Please enter your full name."},
            status=400
        )

    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return Response(
            {"detail": "Please enter a valid email address."},
            status=400
        )

    if len(password) < 8:
        return Response(
            {"detail": "Password must contain at least 8 characters."},
            status=400
        )

    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return Response(
            {"detail": "Password must contain at least one letter and one number."},
            status=400
        )

    if len(password.encode("utf-8")) > 72:
        return Response(
            {"detail": "Password is too long."},
            status=400
        )

    existing = db.users.find_one({
        "email": {
            "$regex": f"^{re.escape(email)}$",
            "$options": "i"
        }
    })

    if existing:
        return Response(
            {"detail": "An account with this email already exists."},
            status=409
        )

    user = {
        "name": name,
        "email": email,
        "password_hash": bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ),
        "role": "member",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }

    result = db.users.insert_one(user)
    user["_id"] = result.inserted_id

    token = create_token(user)

    return Response({
        "detail": "Account created successfully.",
        "access": token,
        "refresh": token,
        "user": get_user_response(user),
    }, status=201)


@api_view(["POST"])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not email or not password:
        return Response(
            {"detail": "Email and password are required."},
            status=400
        )

    user = db.users.find_one({
        "email": {
            "$regex": f"^{re.escape(email)}$",
            "$options": "i"
        }
    })

    if not user:
        return Response(
            {"detail": "Invalid email or password."},
            status=401
        )

    stored_hash = get_password_hash(user)

    if not verify_password(password, stored_hash):
        return Response(
            {"detail": "Invalid email or password."},
            status=401
        )

    if user.get("status", "active") != "active":
        return Response(
            {"detail": "Your account is inactive. Contact the administrator."},
            status=403
        )

    token = create_token(user)

    return Response({
        "detail": "Login successful.",
        "access": token,
        "refresh": token,
        "user": get_user_response(user),
    })


@api_view(["POST"])
def logout(request):
    return Response({
        "ok": True,
        "detail": "Logged out successfully."
    })
