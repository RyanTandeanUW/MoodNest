import os
import io
import json
import threading
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

# import speech_recognition as sr  # Removed - incompatible with Python 3.14
import google.generativeai as genai
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

# --- 1. INITIALIZATION ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
el_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

app = FastAPI(title="MoodNest Hub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core mood presets
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

# --- 3. AUDIO ANALYSIS ENDPOINT ---

@app.post("/analyze-voice")
async def analyze_voice(audio: UploadFile = File(...)):
    """
    Receives a WAV audio file and analyzes it for emotion using Gemini.
    Uses Gemini for speech-to-text transcription + emotion detection.
    Returns the detected mood/emotion.
    """
    try:
        # Read the audio file
        audio_bytes = await audio.read()
        audio_size = len(audio_bytes)
        
        print(f"📥 Received audio file: {audio.filename}")
        print(f"📊 Size: {audio_size / 1024:.2f} KB")
        
        # Save temporarily for Gemini to process
        temp_path = "temp_audio.wav"
        with open(temp_path, "wb") as f:
            f.write(audio_bytes)
        
        # Upload audio to Gemini for analysis
        print("🎵 Uploading audio to Gemini...")
        audio_file = genai.upload_file(path=temp_path)
        
        # Use Gemini 2.5 Flash-Lite with audio analysis
        emotion_prompt = """Analyze audio for emotion from voice tone only.

CRITICAL RULES:
- MUST contain clear human speech with emotional tone
- REJECT silence, ambient noise, music, or unclear speech
- "neutral" is ONLY for calm spoken words, NOT for absence of speech
- If no clear speech detected, set "valid": false

Return ONLY this JSON:
{
    "detected_emotion": "happy|sad|angry|neutral",
    "confidence": 0.85,
    "valid": true
}

Set "valid":false if audio lacks clear human speech."""
        
        emotion_model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = emotion_model.generate_content([emotion_prompt, audio_file])
        
        # Clean up temp file
        import os as os_module
        if os_module.path.exists(temp_path):
            os_module.remove(temp_path)
        
        # Parse Gemini response
        try:
            response_text = response.text.strip()
            # Remove markdown code blocks if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            emotion_data = json.loads(response_text)
            
            # Check if recording is valid for mood detection
            if not emotion_data.get("valid", True):
                return {
                    "success": False,
                    "error": "Recording not suitable for mood detection. Please speak clearly about your feelings."
                }
            
            detected_mood = emotion_data.get("detected_emotion", "neutral")
            confidence = emotion_data.get("confidence", 0.75)
            
            print(f"🎯 Detected mood: {detected_mood} ({confidence*100:.0f}% confidence)")
            
            # Update the current vibe
            with state_lock:
                if detected_mood in VIBE_PRESETS:
                    state.current_vibe = detected_mood
            
            return {
                "success": True,
                "detected_mood": detected_mood,
                "confidence": confidence,
                "audio_size_kb": audio_size / 1024,
                "vibe_details": VIBE_PRESETS.get(detected_mood, VIBE_PRESETS["neutral"]),
                "message": f"Detected {detected_mood} mood"
            }
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parsing error: {e}")
            print(f"Raw response: {response.text}")
            # Fallback to default mood
            detected_mood = "neutral"
            return {
                "success": True,
                "detected_mood": detected_mood,
                "confidence": 0.5,
                "audio_size_kb": audio_size / 1024,
                "vibe_details": VIBE_PRESETS[detected_mood],
                "message": f"Using default mood: {detected_mood}"
            }
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Clean up temp file on error
        import os as os_module
        if os_module.path.exists("temp_audio.wav"):
            os_module.remove("temp_audio.wav")
        
        return {
            "success": False,
            "error": str(e)
        }

# --- 4. EXISTING ENDPOINTS ---

@app.get("/")
async def root():
    return {
        "message": "MoodNest API is running",
        "endpoints": ["/state", "/analyze-voice", "/upload-audio", "/set-vibe/{vibe_name}", "/action/reset", "/docs"],
        "available_vibes": list(VIBE_PRESETS.keys())
    }

@app.get("/state")
async def get_state():
    with state_lock:
        vibe_key = state.current_vibe
        return {
            "vibe_name": vibe_key,
            "vibe_details": VIBE_PRESETS[vibe_key],
            "transcript": state.transcript[-5:]
        }

@app.post("/set-vibe/{vibe_name}")
async def set_vibe(vibe_name: str):
    """Manually set the current vibe/mood"""
    with state_lock:
        if vibe_name in VIBE_PRESETS:
            state.current_vibe = vibe_name
            return {
                "success": True,
                "vibe_name": vibe_name,
                "vibe_details": VIBE_PRESETS[vibe_name]
            }
        return {
            "success": False,
            "error": "Vibe not found",
            "available_vibes": list(VIBE_PRESETS.keys())
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
