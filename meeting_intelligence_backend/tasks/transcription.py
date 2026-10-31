from services.whisper.whisper_service import WhisperService

def run_transcription(audio_file_path: str):
    return WhisperService.transcribe(audio_file_path)
