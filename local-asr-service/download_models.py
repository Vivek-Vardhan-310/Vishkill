from faster_whisper import WhisperModel


if __name__ == "__main__":
    model = WhisperModel("small", device="cpu", compute_type="int8")
    print(f"faster-whisper model loaded: {model.model.model.is_multilingual}")
