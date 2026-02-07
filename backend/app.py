from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS for your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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