import os
import json
import threading
import uvicorn
from dotenv import load_dotenv

# Web Server Components
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Audio and AI Components
import speech_recognition as sr
import google.generativeai as genai
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

# --- 1. INITIALIZATION ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
el_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

app = FastAPI(title="MoodNest Unified Control Hub")

# Enable CORS for Three.js frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. SHARED STATE MANAGEMENT ---
class MoodNestState:
    def __init__(self):
        self.is_active = False        # True if assistant is in a conversation
        self.brightness = 50          # 0-100 for Three.js
        self.color = "#FFFFFF"        # Hex code for Three.js
        self.genre = "ambient"        # Music genre
        self.transcript = []          # List of {"role": "user/bot", "text": "..."}
        self.is_listening = True      # Flag to control the background mic loop

state = MoodNestState()
state_lock = threading.Lock()

# --- 3. AI CONFIGURATION ---
SYSTEM_PROMPT = (
    "You are MoodNest, a feminine smart home assistant. "
    "1. Deduce user emotion through conversation. "
    "2. Ask if they want to change music, lighting, or both. "
    "3. Once they confirm a plan, provide final environmental settings. "
    "ALWAYS end your response with a JSON block: "
    "JSON: {\"brightness\": int(0-100), \"color\": \"string\", \"genre\": \"string\"}"
)

model = genai.GenerativeModel('gemini-2.5-flash-lite', system_instruction=SYSTEM_PROMPT)
chat_session = model.start_chat(history=[])

# --- 4. CORE LOGIC FUNCTIONS ---

def process_interaction(input_text, is_user_speech=True):
    """Handles the brain logic: Gemini call -> State Update -> ElevenLabs speech."""
    global chat_session
    
    # Update local transcript state
    with state_lock:
        state.transcript.append({"role": "user" if is_user_speech else "system", "content": input_text})
    
    # Get Gemini Response
    response = chat_session.send_message(input_text)
    full_reply = response.text
    clean_text = full_reply.split("JSON:")[0].strip()

    # Update Environmental State from JSON block
    try:
        if "JSON:" in full_reply:
            data = json.loads(full_reply.split("JSON:")[1].strip())
            with state_lock:
                state.brightness = data.get("brightness", state.brightness)
                state.color = data.get("color", state.color)
                state.genre = data.get("genre", state.genre)
    except Exception as e:
        print(f"JSON Parse Error: {e}")

    # Update transcript with AI response
    with state_lock:
        state.transcript.append({"role": "assistant", "content": clean_text})

    # ElevenLabs Audio Output
    if el_client and clean_text:
        audio = el_client.text_to_speech.convert(
            text=clean_text, 
            voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
            model_id="eleven_turbo_v2_5"
        )
        play(audio)

def voice_background_worker():
    """Independent thread for continuous microphone listening."""
    recognizer = sr.Recognizer()
    mic = sr.Microphone()
    
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)
        print(">>> Microphone Ready. Listening for wake word 'Mood'...")
        
        while state.is_listening:
            try:
                # Listen with a shorter phrase limit to keep the loop snappy
                audio = recognizer.listen(source, timeout=None, phrase_time_limit=3)
                text = recognizer.recognize_google(audio).lower()
                print(f"DEBUG: Heard '{text}'")

                # Keyword Activation
                if "mood" in text:
                    # Check if already active to avoid double-activation
                    if not state.is_active:
                        print("!!! ACTIVATING MOODNEST !!!")
                        with state_lock:
                            state.is_active = True
                        # Immediately trigger the first greeting
                        process_interaction("Hello! MoodNest is active. How are you feeling today?")
                    else:
                        # If already active, just process the text as a command
                        process_interaction(text, is_user_speech=True)
                
                elif state.is_active:
                    # Normal conversation flow
                    process_interaction(text, is_user_speech=True)

            except sr.UnknownValueError:
                continue # Ignore background noise
            except Exception as e:
                print(f"Worker Error: {e}")
                continue

# --- 5. FASTAPI ENDPOINTS ---

@app.on_event("startup")
async def startup_event():
    """Launches the voice worker thread automatically when the server starts."""
    threading.Thread(target=voice_background_worker, daemon=True).start()

@app.get("/status")
async def get_system_status():
    """Main endpoint for Three.js to pull the latest lighting/music parameters."""
    with state_lock:
        return {
            "is_active": state.is_active,
            "lighting": {"brightness": state.brightness, "color": state.color},
            "music": {"genre": state.genre},
            "transcript": state.transcript[-5:] # Last 5 messages
        }

@app.post("/action/wake")
async def api_wake():
    """Manual trigger to activate the assistant without the wake word."""
    with state_lock: state.is_active = True
    process_interaction("Manual wake-up triggered. How can I help?")
    return {"message": "Assistant Woken"}

@app.post("/action/reset")
async def api_reset():
    """Resets the environment and AI memory."""
    global chat_session
    with state_lock:
        state.is_active = False
        state.transcript = []
        state.color = "#FFFFFF"
        state.brightness = 50
    chat_session = model.start_chat(history=[])
    return {"message": "System Reset"}

# --- 6. SERVER RUNNER ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)