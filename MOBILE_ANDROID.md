# VishKill Android Prototype

## What This Repo Now Supports

- Capacitor-wrapped React app in `android/`
- Native Android call-state receiver
- Native Android foreground mic monitoring service
- Native Android scam alert overlay
- React bridge for `CALL_STARTED`, `CALL_ENDED`, `TRANSCRIPT_UPDATE`, and `SCAM_ALERT`
- Dockerized `faster-whisper` backend in `local-asr-service/`

## Faster Whisper Backend

Run the backend container:

```powershell
cd local-asr-service
docker compose up --build
```

It serves:

- `GET /health`
- `POST /analyze-call`
- `POST /transcribe`

## Android Backend URL

For Android emulator, do not use `localhost`.

Use:

```env
VITE_NATIVE_ANALYZE_URL="http://10.0.2.2:8000"
```

For a real device on the same Wi-Fi, use your laptop IP:

```env
VITE_NATIVE_ANALYZE_URL="http://192.168.x.x:8000"
```

## Web URL

For browser testing, this repo still uses:

```env
VITE_LOCAL_ASR_URL="http://127.0.0.1:8000"
```

## Mobile Workflow

```powershell
npm run mobile:sync
npm run mobile:open
```

or:

```powershell
npm run mobile:run
```

## Important Prototype Limits

- The Android service now uses bundled offline Whisper speech models and a bundled ONNX spam classifier, so runtime scam detection no longer depends on Wi-Fi or mobile data.
- The Android service records microphone audio, not guaranteed full two-sided PSTN call audio.
- Overlay alerts are intended for demo builds and may need additional handling for production distribution.
- The current native `End Call` overlay button only dismisses the warning; it does not programmatically hang up the call.
