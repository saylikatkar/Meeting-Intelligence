import os, jwt, bcrypt
from datetime import datetime, timedelta, timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from db import db

JWT_SECRET = os.getenv("JWT_SECRET")
HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))


@api_view(["POST"])
def register(request):
    name = request.data.get("name", "").strip()
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if len(name) < 2 or "@" not in email or len(password) < 8:
        return Response(
            {"detail": "Enter your name, a valid email and a password of 8+ characters."},
            status=400,
        )
    if db.users.find_one({"email": email}):
        return Response(
            {"detail": "An account with this email already exists. Try signing in."},
            status=400,
        )

    db.users.insert_one({
        "name": name,
        "email": email,
        "role": "member",
        "status": "active",
        "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()),
        "created_at": datetime.now(timezone.utc),
    })
    return Response({"ok": True}, status=201)


@api_view(["POST"])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")
    secret_key = request.data.get("secret_key")

    user = db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"]):
        return Response({"detail": "Invalid email or password."}, status=401)

    if user.get("status") == "disabled":
        return Response({"detail": "This account has been disabled. Contact your admin."}, status=403)

    # admins also need their secret key
    if user["role"] == "admin":
        stored_key = user.get("secret_key_hash")
        if not secret_key or not stored_key or not bcrypt.checkpw(secret_key.encode(), stored_key):
            return Response({"detail": "Invalid secret key."}, status=401)

    token = jwt.encode(
        {
            "sub": str(user["_id"]),
            "role": user["role"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=HOURS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return Response({
        "access": token,
        "refresh": token,
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
    })


@api_view(["POST"])
def logout(request):
    return Response({"ok": True})