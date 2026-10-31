from services.groq.conversation_service import ConversationAnalysisService

def run_turn_detection(segments: list):
    return ConversationAnalysisService.detect_speakers(segments)
