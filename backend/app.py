import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lists of real YouTube IDs discovered via search for each emotion
# The system picks one at random during initialization
VIBE_PRESETS = {
    "focus": {
        "label": "Deep Work",
        "color": "#00E5FF",
        "intensity": 1.5,
        "curtains": "open",
        "ac_temp": 21,
        "youtube_id": random.choice(["57kPhbdj3Xk&list=PL7CnNTK7rCopBvCz2lwDmlS_oqR055QMZ",
                                     "9_qCIRNn1G4&list=PL7CnNTK7rCopBvCz2lwDmlS_oqR055QMZ&index=2",
                                     "yTc1Maol2ZA&list=PL7CnNTK7rCopBvCz2lwDmlS_oqR055QMZ&index=3",
                                     "IL5AhzUSVR4&list=RDIL5AhzUSVR4&start_radio=1", "_4kHxtiuML0"])
    },
    "chill": {
        "label": "Relaxing",
        "color": "#FFCC80",
        "intensity": 0.4,
        "curtains": "half",
        "ac_temp": 23,
        "youtube_id": random.choice(["nLzJLUPRquI&list=RDnLzJLUPRquI&start_radio=1",
                                     "a_iQqN1Hp74&list=RDa_iQqN1Hp74&start_radio=1",
                                     "2WfaotSK3mI&list=RD2WfaotSK3mI&start_radio=1",
                                     "8wwD-Jnveso", "VOoXsOWE-rQ"])
    },
    "chaos": {
        "label": "High Energy",
        "color": "#FF0055",
        "intensity": 2.5,
        "curtains": "closed",
        "ac_temp": 18,
        "youtube_id": random.choice(["rhwD5S-o0QY", "bo1Tt8F5m2o", "FYnRWRG7GnY", "2Rj5K09dVn4", "5SnfV2nr08c"])
    },
    "forest": {
        "label": "Nature/Zen",
        "color": "#2ECC71",
        "intensity": 0.6,
        "curtains": "open",
        "ac_temp": 22,
        "youtube_id": random.choice(["Wq3Y-C9IkSU&list=RDWq3Y-C9IkSU&start_radio=1",
                                     "V1RPi2MYptM", "Nd7e4SNjGBM", "0fjo9ZwpepA", "zcm6nV7Bod8"])
    },
    "midnight": {
        "label": "Sleepy",
        "color": "#1A237E",
        "intensity": 0.2,
        "curtains": "closed",
        "ac_temp": 20,
        "youtube_id": random.choice(["KqnTdfwG2cQ", "sSER7a1qKjI", "2AH5t_o7lmg", "rA7m3iKpuko", "9PYUYvDQ55o"])
    }
}

current_room_state = VIBE_PRESETS["focus"]

@app.get("/")
async def root():
    return {"message": "Vibe-Home API with Dynamic Music IDs"}

@app.get("/state")
async def get_state():
    return current_room_state

@app.post("/set-vibe/{vibe_name}")
async def set_vibe(vibe_name: str):
    global current_room_state
    if vibe_name in VIBE_PRESETS:
        # To make it truly random on every click, you could move the random choice here:
        # VIBE_PRESETS[vibe_name]["youtube_id"] = random.choice(ID_LISTS[vibe_name])
        current_room_state = VIBE_PRESETS[vibe_name]
        return current_room_state
    return {"error": "Vibe not found"}