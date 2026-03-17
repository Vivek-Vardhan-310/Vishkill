import base64
import io
import os
import struct
import tempfile
from functools import lru_cache
from typing import TypedDict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from pydantic import BaseModel


SCAM_KEYWORDS = [
    "bank", "account", "blocked", "arrest", "police", "irs", "tax",
    "refund", "verify", "social security", "otp", "password", "urgent",
    "immediately", "credit card", "wire transfer", "gift card", "bitcoin",
    "suspended", "lawsuit", "warrant", "fraud", "penalty", "overdue",
    "aadhaar", "pan card", "kyc", "debit", "loan", "court",
]

EMOTION_MAP = {
    "immediately": "urgency",
    "urgent": "urgency",
    "now": "urgency",
    "today": "urgency",
    "deadline": "urgency",
    "overdue": "urgency",
    "quickly": "urgency",
    "arrest": "fear",
    "police": "fear",
    "court": "fear",
    "lawsuit": "fear",
    "warrant": "fear",
    "penalty": "fear",
    "jail": "fear",
    "must": "pressure",
    "have to": "pressure",
    "required": "pressure",
    "mandatory": "pressure",
    "no choice": "pressure",
    "demand": "aggression",
    "pay": "aggression",
    "fine": "aggression",
    "forfeit": "aggression",
    "seized": "aggression",
}

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "tiny.en")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
SCAM_THRESHOLD = int(os.getenv("SCAM_THRESHOLD", "70"))


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    compute_type: str


class AnalyzeCallBody(BaseModel):
    audio_blob: str
    phone_number: str | None = None
    call_id: str | None = None
    audio_mime_type: str | None = "audio/wav"


class AnalysisResult(TypedDict):
    transcript: str
    translated_text: str | None
    detected_language: str
    emotion: str
    keywords: list[str]
    risk_score: int
    status: str


def detect_emotion(text: str) -> str:
    lower = text.lower()
    for trigger, emotion in EMOTION_MAP.items():
        if trigger in lower:
            return emotion
    return "neutral"


def detect_keywords(text: str) -> list[str]:
    lower = text.lower()
    return [keyword for keyword in SCAM_KEYWORDS if keyword in lower]


def normalize_language(language: str | None) -> str:
    if language == "en":
        return "english"
    if language == "te":
        return "telugu"
    return "unknown"


def calculate_risk(keywords: list[str], emotion: str) -> int:
    risk = len(keywords) * 10
    if emotion == "urgency":
        risk += 15
    if emotion == "fear":
        risk += 20
    if emotion == "pressure":
        risk += 12
    if emotion == "aggression":
        risk += 18
    return max(0, min(100, risk))


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 8000) -> bytes:
    """Convert raw PCM bytes to WAV format"""
    num_samples = len(pcm_bytes) // 2
    wav_buffer = io.BytesIO()

    # WAV header
    wav_buffer.write(b'RIFF')
    wav_buffer.write(struct.pack('<I', 36 + len(pcm_bytes)))
    wav_buffer.write(b'WAVE')
    wav_buffer.write(b'fmt ')
    wav_buffer.write(struct.pack('<I', 16))
    wav_buffer.write(struct.pack('<H', 1))  # PCM format
    wav_buffer.write(struct.pack('<H', 1))  # Mono
    wav_buffer.write(struct.pack('<I', sample_rate))
    wav_buffer.write(struct.pack('<I', sample_rate * 2))
    wav_buffer.write(struct.pack('<H', 2))  # Block align
    wav_buffer.write(struct.pack('<H', 16))  # Bits per sample
    wav_buffer.write(b'data')
    wav_buffer.write(struct.pack('<I', len(pcm_bytes)))
    wav_buffer.write(pcm_bytes)

    return wav_buffer.getvalue()


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    return WhisperModel(
        "tiny.en",
        device=WHISPER_DEVICE,
        compute_type=WHISPER_COMPUTE_TYPE,
    )


def transcribe_file(audio_path: str, task: str = "transcribe", language: str | None = None) -> tuple[str, str]:
    model = get_model()
    segments, info = model.transcribe(
        audio_path,
        beam_size=1,
        best_of=1,
        vad_filter=False,
        condition_on_previous_text=False,
        task=task,
        language="en",
        num_workers=4,
        compression_ratio_threshold=1.5,
    )
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    return transcript, "english"


def analyze_audio_bytes(audio_bytes: bytes) -> AnalysisResult:
    # Convert PCM to WAV if needed
    if not audio_bytes.startswith(b'RIFF'):
        # Assume it's raw PCM at 8kHz
        audio_bytes = pcm_to_wav(audio_bytes, sample_rate=8000)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        transcript, detected_language = transcribe_file(
            temp_path, task="transcribe")
        translated_text = None

        analysis_text = translated_text or transcript
        emotion = detect_emotion(analysis_text)
        keywords = detect_keywords(analysis_text)
        risk_score = calculate_risk(keywords, emotion)
        status = "scam" if risk_score >= SCAM_THRESHOLD else "suspicious" if risk_score >= 40 else "safe"

        return {
            "transcript": transcript,
            "translated_text": translated_text,
            "detected_language": detected_language,
            "emotion": emotion,
            "keywords": keywords,
            "risk_score": risk_score,
            "status": status,
        }
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


app = FastAPI(title="VishKill Faster Whisper Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model=WHISPER_MODEL_SIZE,
        device=WHISPER_DEVICE,
        compute_type=WHISPER_COMPUTE_TYPE,
    )


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> AnalysisResult:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    return analyze_audio_bytes(raw_bytes)


@app.post("/analyze-call")
async def analyze_call(body: AnalyzeCallBody) -> AnalysisResult:
    try:
        audio_bytes = base64.b64decode(body.audio_blob)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Invalid audio_blob: {exc}") from exc

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audio_blob is empty")

    return analyze_audio_bytes(audio_bytes)
