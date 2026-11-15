from .db import db
from .db import (meetings_collection,users_collection ,analytics_collection, ai_requests_collection )
from bson import ObjectId
from datetime import datetime


def get_all_meetings(search="", status="all"):
    query = {}
    #status filter
    
    if status != "all":
        query["status"] = status
        # search filter
    if search:
        query["$or"] = [
            {
                "title": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "owner": {
                    "$regex": search,
                    "$options": "i"
                }
            }
        ]    

    meetings = list(db.meetings.find(query))
    #meetings = list(meetings_collection.find(query))
    for meeting in meetings:
        meeting["id"] = str(meeting["_id"])
        del meeting["_id"]

    return meetings

def get_meeting_by_id(meeting_id):

    meeting = meetings_collection.find_one(
        {
            "_id": meeting_id
        }
    )

    if meeting:

        meeting["id"] = str(
            meeting["_id"]
        )

        del meeting["_id"]

    return meeting


def delete_meeting(meeting_id):
   
    result = meetings_collection.delete_one(
        {
            "_id": meeting_id
        }
    )
     

    if result.deleted_count ==1:
        return True

    return False    

def reprocess_meeting(meeting_id):
    result = meetings_collection.update_one(
        {
            "_id": meeting_id
        },
        {
            "$set": {
                "status": "processing"
            }
        }
    ) 

    if result.modified_count == 1:
        return True
    return False       

def get_admin_stats():
    total_meetings = meetings_collection.count_documents({})
    successful = meetings_collection.count_documents(

        {
            "status": "completed"
        }
    )

    failed = meetings_collection.count_documents(
        {
            "status": "failed"
        }
    )


    processing = meetings_collection.count_documents(
        {
            "status": "processing"
        }
    )

    total_users = users_collection.count_documents({})
    active_users = users_collection.count_documents(
        {
            "status": "active"
        }
    )

    audio_seconds = 0

    meetings = meetings_collection.find({})

    for meeting in meetings:
        if "duration" in meeting:
            audio_seconds += meeting["duration"]

    audio_hours = round(audio_seconds / 3600, 2)


    return {
        "successful": successful,
        "failed": failed,
        "processing": processing,
        "totalMeetings": total_meetings,
        "activeUsers": active_users,
        "totalUsers": total_users,
        "audioHours": audio_hours
    }

def get_today_usage():

    today = datetime.now().date()

    meeting_today = 0
    today_audio_seconds = 0

    meetings = meetings_collection.find({})

    for meeting in meetings:

        if "createdAt" in meeting:

            meeting_date = datetime.fromisoformat(
                meeting["createdAt"]
            ).date()

            if meeting_date == today:
                meeting_today += 1
                today_audio_seconds += meeting.get(
                    "duration",
                    0
                )

    today_audio_hours = round(
        today_audio_seconds / 3600,
        2
    )
    ai_requests_today = ai_requests_collection.count_documents(
       {
            "createdAt": {
                "$regex": str(today)
            }
        }
    )            
    return {
        "meetings": meeting_today,
        "audioHours": today_audio_hours,
        "aiRequests":  ai_requests_today
    }

def get_meetings_per_day():
    days = {
        "Mon": 0,
        "Tue": 0,
        "Wed": 0,
        "Thu": 0,
        "Fri": 0,
        "Sat": 0,
        "Sun": 0

    }  

    meetings =meetings_collection.find({})

    for meeting in meetings:
        if "createdAt" in meeting:
            date = datetime.fromisoformat(
                meeting["createdAt"]
            )

            day = date.strftime("%a")
            days[day] += 1
    result = [] 

    for day, count in days.items():
        result.append(
            {
                "day": day,
                "count": count
            }
        )
    return result           

def get_monthly_stats():
    monthly_data = {}
    users = users_collection.find({})

    for user in users:
        if "createdAt" in user:
            date = datetime.fromisoformat(
                user["createdAt"].replace("Z", "+00:00")
            )

            month = date.strftime("%b")
            if month not in monthly_data:
                monthly_data[month] = {
                    "newUsers": 0,
                    "meetings": 0,
                    "audioHours": 0

                }
            monthly_data[month]["newUsers"] +=1
    meetings = meetings_collection.find({})

    for meeting in meetings:
        if "createdAt" in meeting:
            date = datetime.fromisoformat(
                meeting["createdAt"]
            )  

            month = date.strftime("%b")

            if month not in monthly_data:
                monthly_data[month] = {
                    "newUsers": 0,
                    "meetings": 0,
                    "audioHours": 0
                }          
            monthly_data[month]["meetings"] += 1

            if "duration" in meeting:
                monthly_data[month]["audioHours"]+= (
                    meeting["duration"] / 3600
                )

    result= []

    for month, data in monthly_data.items():

        result.append(

            {
                "month" : month,
                "newUsers": data["newUsers"],
                "meetings": data["meetings"],
                "audioHours": round(
                    data["audioHours"],
                    2
                )
            }
        )       

    return result    

 
def get_top_users():

    users = list(users_collection.find({}))

    result = []

    for user in users:

        result.append(
            {
                "id": str(user["_id"]),
                "name": user.get("name", "Unknown"),
                "minutes": user.get("totalMinutesProcessed", 0)
            }
        )

    return result

def get_failure_reasons():
    failed_meetings = meetings_collection.find(
        {
            "failureReason": {
                "$exists": True 
            }
        }
    )
    reasons = {}
    for meeting in failed_meetings:
        if "failureReason" in meeting:
            error = meeting["failureReason"]

            if error not in reasons:
                reasons[error] = 0
            reasons[error] +=1      
    result =[]

    for reason, count in reasons.items():
        result.append(
            {
                "reason": reason,
                "count": count
            }
        )
    return result

def get_ai_request():
    today = datetime.now().date()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    count = ai_requests_collection.count_documents(
        {
            "createdAt": {
                "$gte": start.isoformat(),
                "$lte": end.isoformat()
              }
    }
    )

    return {
        "totalAIRequests": count
    }  