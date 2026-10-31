"""
MongoDB Atlas Client & Collection Manager
Supports MongoDB Atlas (via pymongo) with automatic fallback to JSON document store
if MONGO_URI is not set or remote Atlas is unreachable during local evaluation.
"""

import os
import json
import logging
from pathlib import Path
from datetime import datetime
from bson import ObjectId
from django.conf import settings

logger = logging.getLogger(__name__)

class JSONDocumentCollection:
    """
    In-memory / JSON-persisted collection providing MongoDB-compatible interface.
    Used seamlessly when MONGO_URI is omitted or MongoDB Atlas is offline.
    """
    def __init__(self, name: str, data_dir: Path):
        self.name = name
        self.file_path = data_dir / f"{name}.json"
        self._load()

    def _load(self):
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self.docs = json.load(f)
            except Exception:
                self.docs = []
        else:
            self.docs = []
            self._save()

    def _save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.docs, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error persisting collection {self.name}: {e}")

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "_id":
                if str(doc.get("_id")) != str(v):
                    return False
            elif isinstance(v, dict):
                # Basic operator support e.g. $in, $regex, $ne
                val = doc.get(k)
                if "$in" in v and val not in v["$in"]:
                    return False
                if "$ne" in v and val == v["$ne"]:
                    return False
                if "$regex" in v:
                    import re
                    pattern = v["$regex"]
                    if not re.search(pattern, str(val or ""), re.IGNORECASE):
                        return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find_one(self, query=None):
        self._load()
        query = query or {}
        for doc in self.docs:
            if self._matches(doc, query):
                return dict(doc)
        return None

    def find(self, query=None, sort=None, limit=None):
        self._load()
        query = query or {}
        results = [dict(doc) for doc in self.docs if self._matches(doc, query)]
        if sort:
            # Sort is list of (field, direction)
            for field, direction in reversed(sort):
                reverse = direction < 0
                results.sort(key=lambda d: d.get(field) or "", reverse=reverse)
        if limit:
            results = results[:limit]
        return results

    def insert_one(self, doc):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = str(ObjectId())
        else:
            doc["_id"] = str(doc["_id"])
        self.docs.append(doc)
        self._save()
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc["_id"])

    def insert_many(self, doc_list):
        inserted_ids = []
        for d in doc_list:
            res = self.insert_one(d)
            inserted_ids.append(res.inserted_id)
        class InsertManyResult:
            def __init__(self, ids):
                self.inserted_ids = ids
        return InsertManyResult(inserted_ids)

    def update_one(self, query, update, upsert=False):
        matched = False
        update_set = update.get("$set", update)
        for i, doc in enumerate(self.docs):
            if self._matches(doc, query):
                self.docs[i].update(update_set)
                matched = True
                self._save()
                break
        if not matched and upsert:
            new_doc = dict(query)
            new_doc.update(update_set)
            self.insert_one(new_doc)
        class UpdateResult:
            def __init__(self, matched_count):
                self.matched_count = 1 if matched else 0
                self.modified_count = 1 if matched else 0
        return UpdateResult(1 if matched else 0)

    def delete_one(self, query):
        for i, doc in enumerate(self.docs):
            if self._matches(doc, query):
                del self.docs[i]
                self._save()
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        deleted = initial - len(self.docs)
        self._save()
        class DeleteResult:
            deleted_count = deleted
        return DeleteResult()

    def count_documents(self, query=None):
        query = query or {}
        return len([d for d in self.docs if self._matches(d, query)])

    def distinct(self, field, query=None):
        docs = self.find(query)
        vals = set()
        for d in docs:
            v = d.get(field)
            if v is not None:
                vals.add(v)
        return list(vals)


class DatabaseClient:
    """
    Central database provider. Tries MongoDB Atlas first.
    If MONGO_URI is missing or fails to connect, safely uses JSON document collections.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseClient, cls).__new__(cls)
            cls._instance._init_db()
        return cls._instance

    def _init_db(self):
        self.use_mongo = False
        self.mongo_client = None
        self.db = None
        self.json_collections = {}
        self.data_dir = getattr(settings, "DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data")
        self.data_dir.mkdir(parents=True, exist_ok=True)

        mongo_uri = getattr(settings, "MONGO_URI", "").strip()
        db_name = getattr(settings, "MONGO_DB_NAME", "meeting_intelligence")

        if mongo_uri:
            try:
                from pymongo import MongoClient
                logger.info(f"Connecting to MongoDB Atlas at: {mongo_uri.split('@')[-1] if '@' in mongo_uri else 'local'}")
                self.mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
                # Quick ping check
                self.mongo_client.admin.command('ping')
                self.db = self.mongo_client[db_name]
                self.use_mongo = True
                logger.info(f"Successfully connected to MongoDB Database: {db_name}")
            except Exception as e:
                logger.warning(f"Could not connect to MongoDB Atlas ({e}). Falling back to JSON document store at {self.data_dir}")
                self.use_mongo = False
        else:
            logger.info("MONGO_URI not configured. Operating with local JSON document store.")

    def get_collection(self, collection_name: str):
        if self.use_mongo and self.db is not None:
            return self.db[collection_name]
        
        if collection_name not in self.json_collections:
            self.json_collections[collection_name] = JSONDocumentCollection(collection_name, self.data_dir)
        return self.json_collections[collection_name]

# Helper singleton getter
def get_db():
    return DatabaseClient()

def get_collection(name: str):
    return DatabaseClient().get_collection(name)
