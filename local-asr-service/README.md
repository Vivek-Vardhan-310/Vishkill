# Faster Whisper Service

This service runs `faster-whisper` for VishKill and is optimized for live chunked audio.

Default behavior:

- `faster-whisper small` handles English and Telugu transcription
- Telugu audio is translated to English using Whisper's built-in `translate` task
- `/analyze-call` accepts the same base64 audio payload shape used by the app and Android service

## Local Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

## Docker Run

```powershell
docker compose up --build
```

## Endpoints

- `GET /health`
- `POST /transcribe` with multipart form field `file`
- `POST /analyze-call` with JSON body:

```json
{
  "audio_blob": "base64-wav",
  "phone_number": "optional",
  "call_id": "optional",
  "audio_mime_type": "audio/wav"
}
```

## Environment Variables

- `WHISPER_MODEL_SIZE`
- `WHISPER_DEVICE`
- `WHISPER_COMPUTE_TYPE`
- `SCAM_THRESHOLD`
