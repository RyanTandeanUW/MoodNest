import os
import io
import json
import threading
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

import speech_recognition as sr
import google.generativeai as genai
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

# --- 1. INITIALIZATION ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
el_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

app = FastAPI(title="MoodNest File-Based Hub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VIBE_PRESETS = {
    "happy": {"label": "Energetic", "color": "#DFDB1C", "intensity": 1.5},
    "sad": {"label": "Calming", "color": "#3805F0", "intensity": 0.4},
    "angry": {"label": "Intense", "color": "#FF0055", "intensity": 2.5},
    "neutral": {"label": "Balanced", "color": "#FFFFFF", "intensity": 0.6}
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
    "In your final decision, include 'final': true in the JSON."
)

# Use Gemini 2.5 Flash-Lite for higher quota
model = genai.GenerativeModel('gemini-2.5-flash-lite', system_instruction=SYSTEM_PROMPT)
chat_session = model.start_chat(history=[])

# --- 2. CORE LOGIC ---

def process_interaction(input_text):
    """Same brain logic as before."""
    global chat_session
    
    # 1. Add the user's message to the history for polling
    with state_lock:
        state.transcript.append({"role": "user", "content": input_text})
    
    # 2. Call Gemini (Flash-Lite for high quota)
    response = chat_session.send_message(input_text)
    full_reply = response.text
    
    # 3. Strip the JSON block so the user only hears the spoken part
    clean_text = full_reply.split("JSON:")[0].strip()

    # 4. Parse the JSON to update the vibe key
    try:
        if "JSON:" in full_reply:
            data = json.loads(full_reply.split("JSON:")[1].strip())
            new_vibe = data.get("vibe")
            with state_lock:
                if new_vibe in VIBE_PRESETS:
                    state.current_vibe = new_vibe
    except Exception as e:
        print(f"JSON Error: {e}")

    # 5. Add AI's text to history
    with state_lock:
        state.transcript.append({"role": "assistant", "content": clean_text})

    # 6. Trigger the ElevenLabs audio response
    if el_client and clean_text:
        audio = el_client.text_to_speech.convert(
            text=clean_text, 
            voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
            model_id="eleven_turbo_v2_5"
        )
        play(audio)
        
    return clean_text

# --- 3. THE NEW FILE ENDPOINT ---

@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Accepts an audio file from the frontend, transcribes it, and triggers Gemini."""
    recognizer = sr.Recognizer()
    
    # Read the uploaded file into memory
    audio_data = await file.read()
    audio_file = io.BytesIO(audio_data)
    
    try:
        with sr.AudioFile(audio_file) as source:
            # Record the audio from the file-like object
            recorded_audio = recognizer.record(source)
            # Transcribe using Google Web Speech (Free/Included)
            text = recognizer.recognize_google(recorded_audio).lower()
            print(f"Transcribed File: {text}")
            
            # Send the transcribed text to our existing AI logic
            ai_response = process_interaction(text)
            
            return {"transcript": text, "ai_response": ai_response}
            
    except sr.UnknownValueError:
        return {"error": "Could not understand audio"}
    except Exception as e:
        return {"error": str(e)}

# --- 4. EXISTING ENDPOINTS ---

@app.get("/state")
async def get_state():
    with state_lock:
        vibe_key = state.current_vibe
        return {
            "vibe_name": vibe_key,
            "vibe_details": VIBE_PRESETS[vibe_key],
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