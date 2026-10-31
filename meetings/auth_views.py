import os, jwt, bcrypt
from datetime import datetime, timedelta, timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from db import db

JWT_SECRET = os.getenv("JWT_SECRET")
HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))


@api_view(["POST"])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")
    secret_key = request.data.get("secret_key")

    user = db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"]):
        return Response({"detail": "Invalid email or password."}, status=401)

    if user["role"] == "admin":
        if not secret_key or not bcrypt.checkpw(secret_key.encode(), user["secret_key_hash"]):
            return Response({"detail": "Invalid secret key."}, status=401)

    token = jwt.encode(
        {"sub": str(user["_id"]), "role": user["role"],
         "exp": datetime.now(timezone.utc) + timedelta(hours=HOURS)},
        JWT_SECRET, algorithm="HS256",
    )
    return Response({
        "access": token,
        "refresh": token,
        "user": {"name": user["name"], "email": user["email"], "role": user["role"]},
    })


@api_view(["POST"])
def logout(request):
    return Response({"ok": True})
