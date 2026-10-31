"""
JWT Authentication & Password Utilities
Generates and validates JWT tokens for Member, Manager, and Admin roles.
"""

import jwt
import hashlib
import os
from datetime import datetime, timedelta
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from django.conf import settings
from services.storage.mongo import get_collection

class AuthenticatedUser:
    """Wrapper to make MongoDB user doc act like a Django User instance"""
    def __init__(self, doc):
        self.doc = doc
        self.id = str(doc.get("_id"))
        self.pk = self.id
        self.email = doc.get("email")
        self.name = doc.get("name")
        self.role = doc.get("role", "member")
        self.status = doc.get("status", "active")
        self.is_authenticated = True

    @property
    def is_staff(self):
        return self.role in ("admin", "manager")

    @property
    def is_superuser(self):
        return self.role == "admin"

    def __getitem__(self, item):
        return self.doc.get(item)


def hash_password(password: str) -> str:
    """Secure SHA-256 salted password hashing"""
    salt = settings.SECRET_KEY[:16]
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def generate_tokens(user_doc: dict):
    """Generate access token and refresh token"""
    user_id = str(user_doc.get("_id"))
    role = user_doc.get("role", "member")
    email = user_doc.get("email")

    now = datetime.utcnow()
    exp_hours = getattr(settings, "JWT_EXPIRATION_HOURS", 72)

    access_payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(hours=exp_hours),
    }

    refresh_payload = {
        "user_id": user_id,
        "email": email,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=30),
    }

    access_token = jwt.encode(access_payload, settings.JWT_SECRET, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, settings.JWT_SECRET, algorithm="HS256")

    return {
        "access": access_token,
        "refresh": refresh_token,
        "token_type": "Bearer",
        "expires_in": exp_hours * 3600
    }

def decode_token(token: str):
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed("Token has expired")
    except Exception as e:
        raise exceptions.AuthenticationFailed(f"Invalid token: {str(e)}")

class JWTAuthentication(BaseAuthentication):
    """
    Custom DRF authentication class checking Authorization: Bearer <token>
    """
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]
        payload = decode_token(token)

        user_id = payload.get("user_id")
        users_col = get_collection("users")
        user_doc = users_col.find_one({"_id": user_id})

        if not user_doc:
            raise exceptions.AuthenticationFailed("User not found")

        if user_doc.get("status") == "disabled":
            raise exceptions.AuthenticationFailed("User account is disabled")

        user = AuthenticatedUser(user_doc)
        return (user, token)
