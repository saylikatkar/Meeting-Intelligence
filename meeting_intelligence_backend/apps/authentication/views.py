
"""
Authentication Views
Handles Register, Login, Refresh, Logout, Password Reset, Profile
"""

from datetime import datetime

from bson import ObjectId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from services.storage.mongo import get_collection, get_db
from .jwt_utils import (
    hash_password,
    verify_password,
    generate_tokens,
    decode_token,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirmPassword", "")
        phone = data.get("phone", "")
        profile_picture = data.get("profilePicture", "")

        if not name or not email or not password:
            return Response(
                {"error": "Name, email, and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if confirm_password and password != confirm_password:
            return Response(
                {"error": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_col = get_collection("users")

        if users_col.find_one({"email": email}):
            return Response(
                {"error": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_count = users_col.count_documents({})
        role = "admin" if user_count == 0 else "member"

        user_doc = {
            "_id": str(ObjectId()),
            "name": name,
            "email": email,
            "passwordHash": hash_password(password),
            "role": role,
            "status": "active",
            "phone": phone,
            "profilePicture": profile_picture,
            "totalMeetings": 0,
            "totalMinutesProcessed": 0,
            "createdAt": datetime.utcnow().isoformat(),
            "lastLoginAt": datetime.utcnow().isoformat(),
        }

        users_col.insert_one(user_doc)
        tokens = generate_tokens(user_doc)

        get_collection("system_logs").insert_one({
            "event": "user_registered",
            "userId": user_doc["_id"],
            "email": email,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return Response(
            {
                "message": "Registration successful",
                "user": {
                    "id": user_doc["_id"],
                    "name": user_doc["name"],
                    "email": user_doc["email"],
                    "role": user_doc["role"],
                    "status": user_doc["status"],
                },
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        print("LOGIN VIEW REACHED")
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_col = get_collection("users")
        user = users_col.find_one({"email": email})

        # Temporary diagnostics: never print the password or its hash.
        db = get_db()
        print(
            "LOGIN DEBUG - Database:",
            db.db.name if db.use_mongo else "LOCAL JSON FALLBACK",
        )
        print("LOGIN DEBUG - Email received:", repr(email))
        print("LOGIN DEBUG - User found:", user is not None)

        password_matches = (
            verify_password(password, user.get("passwordHash", ""))
            if user
            else False
        )
        print("LOGIN DEBUG - Password matches:", password_matches)

        if not user or not password_matches:
            get_collection("system_logs").insert_one({
                "event": "failed_login",
                "email": email,
                "timestamp": datetime.utcnow().isoformat(),
            })

            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.get("status") == "disabled":
            return Response(
                {
                    "error": (
                        "Your account has been deactivated. "
                        "Please contact support."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        users_col.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "lastLoginAt": datetime.utcnow().isoformat()
                }
            },
        )

        tokens = generate_tokens(user)

        get_collection("system_logs").insert_one({
            "event": "login",
            "userId": str(user["_id"]),
            "email": email,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return Response({
            "message": "Login successful",
            "user": {
                "id": str(user["_id"]),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role", "member"),
                "status": user.get("status", "active"),
                "totalMeetings": user.get("totalMeetings", 0),
                "totalMinutesProcessed": user.get(
                    "totalMinutesProcessed", 0
                ),
            },
            "tokens": tokens,
        })


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"error": "Refresh token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = decode_token(refresh_token)

            if payload.get("type") != "refresh":
                return Response(
                    {"error": "Invalid token type"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            users_col = get_collection("users")
            user = users_col.find_one({
                "_id": payload.get("user_id")
            })

            if not user or user.get("status") == "disabled":
                return Response(
                    {"error": "User not active"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            return Response(generate_tokens(user))

        except Exception:
            return Response(
                {"error": "Invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # JWTs are stateless; the client clears its saved tokens.
        return Response({"message": "Successfully logged out"})


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        users_col = get_collection("users")
        user_doc = users_col.find_one({"_id": user.id})

        if not user_doc:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "id": str(user_doc["_id"]),
            "name": user_doc.get("name"),
            "email": user_doc.get("email"),
            "role": user_doc.get("role", "member"),
            "status": user_doc.get("status", "active"),
            "phone": user_doc.get("phone", ""),
            "profilePicture": user_doc.get("profilePicture", ""),
            "totalMeetings": user_doc.get("totalMeetings", 0),
            "totalMinutesProcessed": user_doc.get(
                "totalMinutesProcessed", 0
            ),
            "createdAt": user_doc.get("createdAt"),
            "lastLoginAt": user_doc.get("lastLoginAt"),
        })


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        users_col = get_collection("users")
        users_col.find_one({"email": email})

        # This endpoint currently does not send an actual reset link.
        return Response({
            "message": (
                "If this email is registered, a password reset link "
                "has been dispatched."
            )
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        new_password = request.data.get("password")

        if not email or not new_password:
            return Response(
                {"error": "Email and new password required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_col = get_collection("users")
        user = users_col.find_one({"email": email})

        if not user:
            return Response(
                {"error": "Account not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        users_col.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "passwordHash": hash_password(new_password)
                }
            },
        )

        return Response({"message": "Password reset successfully"})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"error": "Current password and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the authenticated user's MongoDB record.
        users_col = get_collection("users")
        user_id = str(request.user.id)

        user = users_col.find_one({"_id": user_id})

        if not user:
            return Response(
                {"error": "User account not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify the existing password using the same method as login.
        if not verify_password(
            current_password,
            user.get("passwordHash", ""),
        ):
            return Response(
                {"error": "Your current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"error": "Password must contain at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            not any(char.isalpha() for char in new_password)
            or not any(char.isdigit() for char in new_password)
        ):
            return Response(
                {"error": "Password must contain at least one letter and one number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_password == new_password:
            return Response(
                {"error": "New password must be different from the current password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Hash the new password and save it in MongoDB.
        new_password_hash = hash_password(new_password)

        result = users_col.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "passwordHash": new_password_hash,
                }
            },
        )

        if result.matched_count == 0:
            return Response(
                {"error": "Unable to update password."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        get_collection("system_logs").insert_one({
            "event": "password_changed",
            "userId": user_id,
            "email": user.get("email"),
            "timestamp": datetime.utcnow().isoformat(),
        })

        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )
