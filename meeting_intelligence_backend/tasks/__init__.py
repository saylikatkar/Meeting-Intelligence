"""
Celery background tasks for meeting pipeline
"""
from services.pipeline.processor import PipelineProcessor

def run_pipeline_sync_or_async(meeting_id: str, auto_name_speakers: bool = True):
    try:
        from config.celery import app
        # Try celery task if worker available
        @app.task
        def celery_process(m_id, auto_name):
            PipelineProcessor.process_meeting(m_id, auto_name)

        celery_process.delay(meeting_id, auto_name_speakers)
    except Exception:
        # Fallback to direct thread or synchronous execution
        PipelineProcessor.process_meeting(meeting_id, auto_name_speakers)
