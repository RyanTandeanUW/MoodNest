import os
import io
import json
import threading
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # Required to serve MP3s
import io

import speech_recognition as sr
import google.generativeai as genai
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

# --- 1. INITIALIZATION ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
el_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

app = FastAPI(title="MoodNest File-Based Hub")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- THE MAGIC LINE ---
# This allows http://localhost:8000/music/neutral.mp3 to work
# Ensure you have a folder named "music" in the same directory as this file.
if not os.path.exists("music"):
    os.makedirs("music")
app.mount("/music", StaticFiles(directory="music"), name="music")

VIBE_PRESETS = {
    "happy": {
        "label": "Energetic", 
        "color": "#DFDB1C", 
        "intensity": 1.5,
        "audio_url": "http://localhost:8000/music/happy.mp3"
    },
    "sad": {
        "label": "Calming", 
        "color": "#3805F0", 
        "intensity": 0.4,
        "audio_url": "http://localhost:8000/music/sad.mp3"
    },
    "angry": {
        "label": "Intense", 
        "color": "#FF0055", 
        "intensity": 2.5,
        "audio_url": "http://localhost:8000/music/angry.mp3"
    },
    "neutral": {
        "label": "Balanced", 
        "color": "#FFFFFF", 
        "intensity": 0.6,
        "audio_url": "http://localhost:8000/music/neutral.mp3"
    }
}

class MoodNestState:
    def __init__(self):
        self.is_active = False
        self.current_vibe = "neutral"
        self.transcript = []

state = MoodNestState()
state_lock = threading.Lock()

SYSTEM_PROMPT = (
    "You are MoodNest. Converse with the user to find their mood. "
    "When you are confident in their emotion, pick a vibe key: 'happy', 'sad', 'angry', or 'neutral'. "
    "Always provide a JSON block at the end like this: JSON: {\"vibe\": \"happy\"}"
)

# Using Gemini 1.5 Flash for multimodal/audio processing
model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=SYSTEM_PROMPT)
chat_session = model.start_chat(history=[])

# --- 2. CORE LOGIC ---

def process_interaction(input_text):
    global chat_session
    
    with state_lock:
        state.transcript.append({"role": "user", "content": input_text})
    
    response = chat_session.send_message(input_text)
    full_reply = response.text
    
    # Strip the JSON block for the spoken TTS part
    clean_text = full_reply.split("JSON:")[0].strip()

    try:
        if "JSON:" in full_reply:
            data = json.loads(full_reply.split("JSON:")[1].strip())
            new_vibe = data.get("vibe")
            with state_lock:
                if new_vibe in VIBE_PRESETS:
                    state.current_vibe = new_vibe
    except Exception as e:
        print(f"JSON Parsing Error: {e}")

    with state_lock:
        state.transcript.append({"role": "assistant", "content": clean_text})

    # ElevenLabs Voice Response
    if el_client and clean_text:
        try:
            audio = el_client.text_to_speech.convert(
                text=clean_text, 
                voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
                model_id="eleven_turbo_v2_5"
            )
            play(audio)
        except Exception as e:
            print(f"ElevenLabs Error: {e}")
        
    return clean_text

# --- 3. ENDPOINTS ---

@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    recognizer = sr.Recognizer()
    audio_data = await file.read()
    audio_file = io.BytesIO(audio_data)
    
    try:
        with sr.AudioFile(audio_file) as source:
            recorded_audio = recognizer.record(source)
            text = recognizer.recognize_google(recorded_audio).lower()
            print(f"Transcribed: {text}")
            
            ai_response = process_interaction(text)
            return {"transcript": text, "ai_response": ai_response}
            
    except Exception as e:
        return {"error": str(e)}

@app.get("/state")
async def get_state():
    with state_lock:
        vibe_key = state.current_vibe
        # Returning vibe_details so React can use vibe.audio_url
        return {
            "vibe_name": vibe_key,
            "color": VIBE_PRESETS[vibe_key]["color"],
            "audio_url": VIBE_PRESETS[vibe_key]["audio_url"],
            "label": VIBE_PRESETS[vibe_key]["label"],
            "transcript": state.transcript[-5:]
        }

@app.post("/action/reset")
async def api_reset():
    global chat_session
    with state_lock:
        state.transcript = []
        state.current_vibe = "neutral"
    chat_session = model.start_chat(history=[])
    return {"message": "System Reset"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)