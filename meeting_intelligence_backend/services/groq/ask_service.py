
import json
import logging
from datetime import datetime, timezone

from django.conf import settings

logger = logging.getLogger(__name__)

ASK_SYSTEM_PROMPT = """
You are an AI assistant that answers questions about recorded meetings.

Use only the supplied meeting transcript. Never invent people, assignments,
decisions, deadlines, quotations, or other meeting details.

Return a JSON object with exactly these fields:
{
  "answer": "A concise answer based only on the transcript.",
  "sourceTimestamp": "00:18",
  "citedSpeaker": "Speaker name",
  "confidence": "high"
}

Rules:
1. Cite the timestamp of the transcript segment supporting the answer.
2. Use the speaker's supplied name or label.
3. If the transcript does not answer the question, say:
   "I could not find this information in the meeting transcript."
   Set sourceTimestamp to an empty string, citedSpeaker to an empty string,
   and confidence to "low".
4. Do not guess missing information.
5. confidence must be "high", "medium", or "low".
6. Return valid JSON only.
"""


def format_timestamp(seconds):
    """Convert seconds to MM:SS or HH:MM:SS."""
    try:
        total_seconds = max(0, int(float(seconds or 0)))
    except (TypeError, ValueError):
        total_seconds = 0

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60

    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    return f"{minutes:02d}:{secs:02d}"


class AskMeetingService:

    @staticmethod
    def answer_question(
        question: str,
        transcript_segments: list,
        meeting_metadata: dict = None
    ) -> dict:

        question = (question or "").strip()

        if not question:
            raise ValueError("Please enter a question.")

        if not transcript_segments:
            return AskMeetingService._not_found(question)

        groq_api_key = getattr(settings, "GROQ_API_KEY", "").strip()
        model = getattr(
            settings,
            "GROQ_MODEL",
            "llama-3.3-70b-versatile"
        )

        if not groq_api_key:
            logger.error("GROQ_API_KEY is not configured.")
            raise RuntimeError(
                "Ask AI is unavailable because the Groq API key is not configured."
            )

        # Build transcript context from the actual meeting segments.
        transcript_lines = []
        valid_segments = []

        for segment in transcript_segments:
            if not isinstance(segment, dict):
                continue

            text = str(segment.get("text") or "").strip()

            if not text:
                continue

            start_time = segment.get("startTime", 0)
            timestamp = format_timestamp(start_time)
            speaker = (
                segment.get("speakerName")
                or segment.get("speakerLabel")
                or "Unknown speaker"
            )

            transcript_lines.append(
                f"[{timestamp}] {speaker}: {text}"
            )

            valid_segments.append({
                "timestamp": timestamp,
                "speaker": str(speaker),
                "text": text,
            })

        if not transcript_lines:
            return AskMeetingService._not_found(question)

        transcript_context = "\n".join(transcript_lines)

        title = (
            meeting_metadata.get("title", "Meeting")
            if meeting_metadata
            else "Meeting"
        )

        prompt = f"""
Meeting title: {title}

Meeting transcript:
{transcript_context}

User question:
{question}

Answer using only the transcript. Return the required JSON object.
"""

        try:
            from groq import Groq

            client = Groq(api_key=groq_api_key)

            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": ASK_SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            content = completion.choices[0].message.content

            if not content:
                raise RuntimeError("Groq returned an empty response.")

            result = json.loads(content)

            answer = str(result.get("answer") or "").strip()
            source_timestamp = str(
                result.get("sourceTimestamp") or ""
            ).strip()
            cited_speaker = str(
                result.get("citedSpeaker") or ""
            ).strip()
            confidence = str(
                result.get("confidence") or "low"
            ).lower()

            if confidence not in {"high", "medium", "low"}:
                confidence = "low"

            # Verify that the cited timestamp and speaker exist in
            # the supplied transcript.
            matching_segment = next(
                (
                    segment
                    for segment in valid_segments
                    if segment["timestamp"] == source_timestamp
                    and (
                        segment["speaker"].casefold()
                        == cited_speaker.casefold()
                    )
                ),
                None,
            )

            if matching_segment is None:
                source_timestamp = ""
                cited_speaker = ""
                confidence = "low"

                # Do not keep an answer that depends on an invalid citation.
                answer = (
                    "I could not verify a supporting timestamp and speaker "
                    "in the meeting transcript."
                )

            if not answer:
                answer = (
                    "I could not find this information in the meeting transcript."
                )
                source_timestamp = ""
                cited_speaker = ""
                confidence = "low"

            return {
                "question": question,
                "answer": answer,
                "sourceTimestamp": source_timestamp,
                "citedSpeaker": cited_speaker,
                "confidence": confidence,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as exc:
            logger.exception("Groq Ask AI request failed: %s", exc)

            # Do not silently replace a failed LLM response with
            # fabricated keyword-based answers.
            raise RuntimeError(
                "Ask AI could not generate an answer. Check the Groq "
                "API key, model access, and server logs."
            ) from exc

    @staticmethod
    def _not_found(question):
        return {
            "question": question,
            "answer": (
                "I could not find this information in the meeting transcript."
            ),
            "sourceTimestamp": "",
            "citedSpeaker": "",
            "confidence": "low",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
