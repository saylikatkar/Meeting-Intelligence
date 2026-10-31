from services.groq.analysis_service import MeetingAnalysisService

def run_meeting_analysis(meeting_title: str, transcript_text: str):
    return MeetingAnalysisService.analyze_meeting(meeting_title, transcript_text)
