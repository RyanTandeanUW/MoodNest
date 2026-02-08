from fastapi import FastAPI, UploadFile
from speechbrain.inference.interfaces import foreign_class
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Load the emotion model
classifier = foreign_class(
    source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
    pymodule_file="custom_interface.py",
    classname="CustomEncoderWav2vec2Classifier"
# Enable CORS for your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/emotion/voice")
async def emotion_from_voice(file: UploadFile):
    # Save the uploaded audio temporarily
    with open("temp.wav", "wb") as f:
        f.write(await file.read())
VIBE_PRESETS = {
    "focus": {
        "label": "Deep Work",
        "color": "#00E5FF",  # Electric Cyan
        "intensity": 1.5,
        "curtains": "open",
        "ac_temp": 21
    },
    "chill": {
        "label": "Relaxing",
        "color": "#FFCC80",  # Soft Peach/Orange
        "intensity": 0.4,
        "curtains": "half",
        "ac_temp": 23
    },
    "chaos": {
        "label": "High Energy",
        "color": "#FF0055",  # Neon Pink/Red
        "intensity": 2.5,
        "curtains": "closed",
        "ac_temp": 18
    },
    "forest": {
        "label": "Nature/Zen",
        "color": "#2ECC71",  # Emerald Green
        "intensity": 0.6,
        "curtains": "open",
        "ac_temp": 22
    },
    "midnight": {
        "label": "Sleepy",
        "color": "#1A237E",  # Deep Indigo
        "intensity": 0.2,
        "curtains": "closed",
        "ac_temp": 20
    }
}

    # Run the model
    result = classifier.classify_file("temp.wav")
    return result
current_room_state = VIBE_PRESETS["focus"]

# --- ADDED THIS TO FIX THE "NOT FOUND" ERROR ---
@app.get("/")
async def root():
    return {
        "message": "Vibe-Home API is running",
        "endpoints": ["/state", "/set-vibe/{vibe_name}", "/docs"]
    }

@app.get("/state")
async def get_state():
    return current_room_state

@app.post("/set-vibe/{vibe_name}")
async def set_vibe(vibe_name: str):
    global current_room_state
    if vibe_name in VIBE_PRESETS:
        current_room_state = VIBE_PRESETS[vibe_name]
        return current_room_state
    return {"error": "Vibe not found"}