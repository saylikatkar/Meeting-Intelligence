import os, jwt
from bson import ObjectId
from rest_framework.decorators import api_view
from rest_framework.response import Response
from db import db

JWT_SECRET = os.getenv("JWT_SECRET")


def current_admin(request):
    """Return the logged-in admin's database record, or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(header[7:], JWT_SECRET, algorithms=["HS256"])
        return db.users.find_one({"_id": ObjectId(payload["sub"]), "role": "admin"})
    except Exception:
        return None


def serialize(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name", ""),
        "email": u["email"],
        "role": u.get("role", "member"),
        "status": u.get("status", "active"),
        "joined": u["created_at"].date().isoformat() if u.get("created_at") else None,
    }


@api_view(["GET"])
def users_list(request):
    if not current_admin(request):
        return Response({"detail": "Admin only."}, status=403)
    users = db.users.find().sort("created_at", -1)
    return Response([serialize(u) for u in users])


@api_view(["PATCH", "DELETE"])
def user_detail(request, user_id):
    me = current_admin(request)
    if not me:
        return Response({"detail": "Admin only."}, status=403)
    if not ObjectId.is_valid(user_id):
        return Response({"detail": "Invalid id."}, status=400)

    target = db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        return Response({"detail": "User not found."}, status=404)
    if target["_id"] == me["_id"]:
        return Response({"detail": "You can't change your own account."}, status=400)

    if request.method == "DELETE":
        db.users.delete_one({"_id": target["_id"]})
        return Response({"ok": True})

    role = request.data.get("role")
    status = request.data.get("status")
    changes, removes = {}, {}

    if role == "admin":
        if not me.get("secret_key_hash"):
            return Response({"detail": "Your account has no secret key. Run create_admin.py first."}, status=400)
        changes["role"] = "admin"
        changes["secret_key_hash"] = me["secret_key_hash"]  # same secret key as you
    elif role == "member":
        changes["role"] = "member"
        removes["secret_key_hash"] = ""

    if status in ("active", "disabled"):
        changes["status"] = status

    update = {}
    if changes:
        update["$set"] = changes
    if removes:
        update["$unset"] = removes
    if update:
        db.users.update_one({"_id": target["_id"]}, update)

    return Response(serialize(db.users.find_one({"_id": target["_id"]})))