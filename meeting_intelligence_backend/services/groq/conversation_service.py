"""
Conversation Turn Analysis Service (Option B Speaker Diarization)
Analyzes conversational structure, turn-taking, and linguistic flow via Groq LLM
to generate anonymous speaker labels (SPEAKER_1, SPEAKER_2, etc.) as specified in Section 27.
"""

import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are analyzing a timestamped conversation transcript.
Your task is to identify conversational turns.

Use anonymous labels:
SPEAKER_1
SPEAKER_2
SPEAKER_3

Do not identify real-world people.

Use:
- Conversation flow
- Question and answer patterns
- Context
- Turn-taking
- Sentence continuity
- Timestamp sequence

Do not invent unnecessary speakers.
Return structured JSON only with this schema:
{
  "detectedSpeakerLabels": ["SPEAKER_1", "SPEAKER_2", "SPEAKER_3"],
  "speakers": [
    {"label": "SPEAKER_1", "inferredRole": "Host / Project Lead"},
    {"label": "SPEAKER_2", "inferredRole": "Engineering / Developer"},
    {"label": "SPEAKER_3", "inferredRole": "Reviewer / Participant"}
  ],
  "turnAssignments": [
    {"id": 1, "speaker": "SPEAKER_1"},
    {"id": 2, "speaker": "SPEAKER_1"},
    {"id": 3, "speaker": "SPEAKER_2"}
  ]
}
"""

class ConversationAnalysisService:
    @staticmethod
    def detect_speakers(segments: list) -> dict:
        """
        Takes raw timestamped segments and uses Groq to segment conversation turns
        """
        groq_api_key = getattr(settings, "GROQ_API_KEY", "").strip()
        model = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")

        if not groq_api_key:
            logger.info("GROQ_API_KEY is not set. Using linguistic heuristic turn assignment.")
            return ConversationAnalysisService._fallback_turn_assignment(segments)

        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)

            formatted_segments = [
                {
                    "id": s.get("id"),
                    "start": s.get("start"),
                    "end": s.get("end"),
                    "text": s.get("text")
                }
                for s in segments
            ]

            prompt = (
                f"Analyze these transcript segments and return conversational turns JSON:\n"
                f"{json.dumps(formatted_segments, indent=2)}"
            )

            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            response_content = completion.choices[0].message.content
            parsed = json.loads(response_content)
            return parsed

        except Exception as e:
            logger.error(f"Groq Conversation Analysis failed: {e}. Using fallback turn assignment.")
            return ConversationAnalysisService._fallback_turn_assignment(segments)

    @staticmethod
    def _fallback_turn_assignment(segments: list) -> dict:
        """
        Fallback deterministic turn detector based on conversational patterns & question/answer markers
        """
        speakers = ["SPEAKER_1", "SPEAKER_2", "SPEAKER_3"]
        turn_assignments = []
        current_speaker_idx = 0

        for i, seg in enumerate(segments):
            text = seg.get("text", "")
            # Turn switch detection: question mark in previous segment, or affirmative starter
            if i > 0:
                prev_text = segments[i - 1].get("text", "")
                if prev_text.strip().endswith("?") or any(text.lower().startswith(w) for w in ["yes", "no", "that fits", "agreed", "what about", "can we"]):
                    current_speaker_idx = (current_speaker_idx + 1) % len(speakers)

            turn_assignments.append({
                "id": seg.get("id"),
                "speaker": speakers[current_speaker_idx]
            })

        detected_labels = list({t["speaker"] for t in turn_assignments})
        detected_labels.sort()

        return {
            "detectedSpeakerLabels": detected_labels,
            "speakers": [
                {"label": "SPEAKER_1", "inferredRole": "Project Manager"},
                {"label": "SPEAKER_2", "inferredRole": "Frontend Lead"},
                {"label": "SPEAKER_3", "inferredRole": "Product / QA"}
            ],
            "turnAssignments": turn_assignments
        }
