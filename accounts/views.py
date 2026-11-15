from django.shortcuts import render

# Create your views here.
from django.shortcuts import render

# Create your views here.
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .db_operations import ( get_all_meetings, delete_meeting, reprocess_meeting,  get_meeting_by_id, get_ai_request)
from .db_operations import ( get_admin_stats, get_today_usage,  get_meetings_per_day, get_monthly_stats, get_top_users, get_failure_reasons)



@api_view(["GET"])
def meetings_list(request):
    search = request.GET.get("search", "")
    status_filter = request.GET.get("status", "all")

    meetings = get_all_meetings(
        search,
        status_filter
    )
    return Response(meetings)
# 2. VIEW DETAILS

@api_view(["GET"])
def meeting_detail(request, meeting_id):
    meeting = get_meeting_by_id(
        meeting_id
    )
    if meeting is None:
        return Response(
            {
                "error":"Meeting not found"
            },
            status=404
        )
    return Response(meeting)


@api_view(["DELETE"])
def meeting_delete(request, meeting_id):
    deleted = delete_meeting(meeting_id)

    if not deleted:
        return Response(
            {
            "error": "Meeting not found"
            },
            status=status.HTTP_404_NOT_FOUND
        )
    return Response(
        {
             "message": "Meeting deleted successfully"
        },
        status=status.HTTP_200_OK
    )    

@api_view(["POST"])
def meeting_reprocess(request, meeting_id):
    updated = reprocess_meeting(meeting_id)

    if not updated:
        return Response(
            {
                "error": "Meeting not found"
            },
            status=404
        )
    return Response(
        {
            "message": "Meeting reprocessing started",
            "status": "processing"
        },
       status=200
    )   

@api_view(["GET"])
def admin_stats(request):
    stats = get_admin_stats()
    return Response(stats)
  
@api_view(["GET"])
def today_usage(request):
    usage = get_today_usage()
    return Response(usage)      

@api_view(["GET"])

def meetings_per_day(request):
    data = get_meetings_per_day()
    return Response(data)


@api_view(["GET"])
def monthly_stats(request):
    data = get_monthly_stats()
    return Response(data)

@api_view(["GET"])
def top_users(request):
    data = get_top_users()
    return Response(data)    

@api_view(["GET"])
def failure_reasons(request):

    data = get_failure_reasons()

    return Response(data) 




@api_view(["GET"])
def ai_request(request):
    data = get_ai_request()
    return Response(data)