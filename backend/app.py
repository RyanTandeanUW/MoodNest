import os
import io
import json
import re
import base64
import threading
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

# import speech_recognition as sr  # Removed - incompatible with Python 3.14
import google.generativeai as genai
from elevenlabs.client import ElevenLabs

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

# --- Update lines 31-36 in your app.py ---
VIBE_PRESETS = {
    "happy": {
        "label": "Energetic", 
        "color": "#DFDB1C", 
        "intensity": 1.5, 
        # Replace the URL below with your actual happy.mp3 public link + &raw=1
        "track": "https://www.dropbox.com/scl/fi/alhlajib2osutreupqlg1/happy.mp3?rlkey=x4kh98gh9u85imlndjj9ifbvf&st=w5f0kkyc&raw=1" 
    },
    "sad": {
        "label": "Calming", 
        "color": "#3805F0", 
        "intensity": 0.4, 
        # Verified link with &raw=1 added for direct streaming
        "track": "https://www.dropbox.com/scl/fi/aoysxjirs7k7meoquhf86/sad.mp3?rlkey=yiojizqwkjqjmbjblfgigtkuz&st=ehcdr5pr&raw=1" 
    },
    "angry": {
        "label": "Intense", 
        "color": "#FF0055", 
        "intensity": 2.5, 
        "track": "https://www.dropbox.com/scl/fi/b64c0zwdts6smrmurg2eq/angry.mp3?rlkey=g4oa7ejk56112puioyzvd9zrj&st=p0jg2rrw&raw=1"
    },
    "neutral": {
        "label": "Balanced", 
        "color": "#FFFFFF", 
        "intensity": 0.6, 
    }
}
# --- ADD THIS AFTER app = FastAPI(...) ---
# This serves files from a folder named "music" in your project directory
if not os.path.exists("music"):
    os.makedirs("music")

app.mount("/music", StaticFiles(directory="music"), name="music")



class MoodNestState:
    def __init__(self):
        self.is_active = False
        self.current_vibe = "neutral"
        self.transcript = []
        self.conversation_mode = False  # Flag for conversation vs quick mode
        self.pending_vibe = None  # Vibe waiting for user confirmation
        self.awaiting_confirmation = False  # True when waiting for yes/no

state = MoodNestState()
state_lock = threading.Lock()

def audio_stream_to_base64(audio_data):
    """
    Convert ElevenLabs audio stream to base64 for sending to frontend.
    Frontend will play it through the browser (no temp files, no windows).
    """
    try:
        # Collect all audio chunks into a single bytes object
        audio_bytes = b""
        for chunk in audio_data:
            if chunk:
                audio_bytes += chunk
        
        # Convert to base64 for JSON transport
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"🎵 Audio converted to base64 ({len(audio_bytes)} bytes)")
        return audio_base64
    except Exception as e:
        print(f"⚠️ Could not convert audio: {e}")
        return None

SYSTEM_PROMPT = (
    "You are MoodNest, a friendly AI that adjusts room lighting and music.\\n"
    "Your job: Chat with the user and suggest mood changes.\\n\\n"
    "4 MOODS: happy, sad, angry, neutral\\n\\n"
    "CONVERSATION FLOW:\\n"
    "1. Ask ONE casual question to understand their mood\\n"
    "2. After their answer, ASK PERMISSION to change the room\\n"
    "3. If they say yes → confirm the change\\n"
    "4. If they say no → acknowledge and don't change\\n\\n"
    "JSON FORMATS:\\n"
    "To ask permission: JSON: {\\\"vibe\\\": \\\"happy\\\", \\\"confirm_request\\\": true}\\n"
    "User says yes: JSON: {\\\"confirmed\\\": true}\\n"
    "User says no: JSON: {\\\"confirmed\\\": false}\\n\\n"
    "EXAMPLES:\\n"
    "User: 'Hey'\\n"
    "You: Hey! How's it going?\\n\\n"
    "User: 'Pretty good actually'\\n"
    "You: Want me to set a happy vibe? JSON: {\\\"vibe\\\": \\\"happy\\\", \\\"confirm_request\\\": true}\\n\\n"
    "User: 'Yes'\\n"
    "You: Done! Enjoy! JSON: {\\\"confirmed\\\": true}\\n\\n"
    "User: 'Feeling down'\\n"
    "You: Should I set a calming mood? JSON: {\\\"vibe\\\": \\\"sad\\\", \\\"confirm_request\\\": true}\\n\\n"
    "User: 'No thanks'\\n"
    "You: No problem! JSON: {\\\"confirmed\\\": false}\\n\\n"
    "RULES:\\n"
    "- ALWAYS ask permission before changing mood\\n"
    "- Keep responses 5-7 words max\\n"
    "- Match vibe to their emotion\\n"
    "- Use EXACTLY the JSON formats shown"
)

# Use Gemini 2.5 Flash-Lite for higher quota
model = genai.GenerativeModel('gemini-2.5-flash-lite', system_instruction=SYSTEM_PROMPT)
chat_session = model.start_chat(history=[])

# --- 2. CORE LOGIC ---

def process_interaction(input_text):
    """Process user input through Gemini conversation."""
    global chat_session
    
    print(f"\\n{'='*60}")
    print(f"📥 USER: {input_text}")
    
    # Add to transcript
    with state_lock:
        state.transcript.append({"role": "user", "content": input_text})
    
    # Get Gemini response
    response = chat_session.send_message(input_text)
    full_reply = response.text
    
    print(f"🤖 GEMINI: {full_reply}")
    
    # Parse JSON if present
    new_vibe = None
    confirm_request = False
    confirmed = None
    
    try:
        # Look for "JSON:" marker (case insensitive)
        if "JSON:" in full_reply or "json:" in full_reply.lower():
            json_str = re.split(r'json:', full_reply, flags=re.IGNORECASE)[1].strip()
            json_str = json_str.replace("```json", "").replace("```", "").strip()
            json_match = re.search(r'\{[^}]*\}', json_str)
            if json_match:
                data = json.loads(json_match.group(0))
                new_vibe = data.get("vibe")
                confirm_request = data.get("confirm_request", False)
                confirmed = data.get("confirmed")
                print(f"📋 JSON: vibe={new_vibe}, confirm_request={confirm_request}, confirmed={confirmed}")
        
        # Fallback: Look for any JSON with relevant keys
        if not new_vibe and not confirmed:
            json_match = re.search(r'\{[^}]*("vibe"|"confirm"|"confirmed")[^}]*\}', full_reply)
            if json_match:
                data = json.loads(json_match.group(0))
                new_vibe = data.get("vibe")
                confirm_request = data.get("confirm_request", False)
                confirmed = data.get("confirmed")
                print(f"📋 JSON (fallback): vibe={new_vibe}, confirm_request={confirm_request}, confirmed={confirmed}")
    except Exception as e:
        print(f"⚠️ JSON parsing: {e}")
    
    # Handle the confirmation flow
    with state_lock:
        if confirm_request and new_vibe and new_vibe in VIBE_PRESETS:
            # Gemini is asking for permission
            state.pending_vibe = new_vibe
            state.awaiting_confirmation = True
            print(f"❓ ASKING: Want to change to '{new_vibe}'?")
        
        elif confirmed is True and state.pending_vibe:
            # User said yes - apply the pending mood
            old_vibe = state.current_vibe
            state.current_vibe = state.pending_vibe
            print(f"✅ CONFIRMED: {old_vibe} → {state.current_vibe}")
            state.pending_vibe = None
            state.awaiting_confirmation = False
        
        elif confirmed is False:
            # User said no - cancel
            print(f"❌ DECLINED: Not changing from {state.current_vibe}")
            state.pending_vibe = None
            state.awaiting_confirmation = False
        else:
            print(f"💭 CHATTING: No state change")
    
    # Clean text for audio (remove JSON and markers)
    clean_text = full_reply
    if "JSON:" in clean_text or "json:" in clean_text.lower():
        clean_text = re.split(r'json:', clean_text, flags=re.IGNORECASE)[0].strip()
    # Also remove any standalone JSON objects
    clean_text = re.sub(r'\{[^}]*("vibe"|"confirm")[^}]*\}', '', clean_text).strip()
    print(f"💬 Response: {clean_text}")
    print(f"{'='*60}\\n")

    # 6. Add AI's text to history
    with state_lock:
        state.transcript.append({"role": "assistant", "content": clean_text})

    # 7. Generate ElevenLabs audio response and return as base64
    audio_base64 = None
    if el_client and clean_text:
        try:
            audio = el_client.text_to_speech.convert(
                text=clean_text, 
                voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
                model_id="eleven_turbo_v2_5"
            )
            # Convert audio stream to base64 for frontend playback
            audio_base64 = audio_stream_to_base64(audio)
        except ConnectionResetError:
            print(f"⚠️ ElevenLabs connection reset - skipping audio")
        except Exception as e:
            print(f"⚠️ Could not generate audio: {e}")
        
    return clean_text, audio_base64

# --- 3. AUDIO ANALYSIS ENDPOINTS ---

@app.post("/analyze-voice-conversation")
async def analyze_voice_conversation(audio: UploadFile = File(...)):
    """
    Conversational mode: Transcribes audio, has Gemini conversation,
    and plays audio response via ElevenLabs.
    """
    try:
        # Read and save audio
        audio_bytes = await audio.read()
        temp_path = "temp_audio_conv.wav"
        with open(temp_path, "wb") as f:
            f.write(audio_bytes)
        
        print(f"🎤 Conversation mode - processing audio...")
        
        # Upload to Gemini for transcription
        audio_file = genai.upload_file(path=temp_path)
        transcribe_model = genai.GenerativeModel('gemini-2.5-flash-lite')
        transcribe_response = transcribe_model.generate_content([
            "Listen to this audio and transcribe EXACTLY what is said. "
            "Return ONLY the spoken words with no additional commentary, explanations, or interpretations. "
            "If you cannot clearly hear the words, return: [unclear audio]",
            audio_file
        ])
        
        user_text = transcribe_response.text.strip()
        
        # Check if transcription failed
        if "[unclear audio]" in user_text.lower() or len(user_text) < 1:
            print(f"⚠️ Transcription unclear: {user_text}")
            return {
                "success": False,
                "error": "Could not understand audio clearly. Please speak clearly and try again."
            }
        
        print(f"💬 User said: '{user_text}'")
        
        # Clean up temp file
        import os as os_module
        if os_module.path.exists(temp_path):
            try:
                os_module.remove(temp_path)
            except:
                pass  # Will be overwritten next time
        
        # Process through conversation (with ElevenLabs response)
        ai_response, audio_base64 = process_interaction(user_text)
        
        # Return the conversation state
        with state_lock:
            current_mood = state.current_vibe
            pending = state.pending_vibe
            awaiting = state.awaiting_confirmation
        
        return {
            "success": True,
            "mode": "conversation",
            "user_input": user_text,
            "ai_response": ai_response,
            "audio": audio_base64,  # Base64-encoded audio for frontend playback
            "detected_mood": current_mood,
            "pending_mood": pending,
            "awaiting_confirmation": awaiting,
            "vibe_details": VIBE_PRESETS.get(current_mood, VIBE_PRESETS["neutral"])
        }
        
    except Exception as e:
        print(f"❌ Error in conversation mode: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Clean up temp file on error
        import os as os_module
        if os_module.path.exists("temp_audio_conv.wav"):
            try:
                os_module.remove("temp_audio_conv.wav")
            except:
                pass  # Will be overwritten next time
        
        return {
            "success": False,
            "error": str(e)
        }

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
            try:
                os_module.remove(temp_path)
            except:
                pass  # Will be overwritten next time
        
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
            try:
                os_module.remove("temp_audio.wav")
            except:
                pass  # Will be overwritten next time
        
        return {
            "success": False,
            "error": str(e)
        }

# --- 4. EXISTING ENDPOINTS ---

@app.get("/")
async def root():
    with state_lock:
        mode = "conversation" if state.conversation_mode else "quick"
    return {
        "message": "MoodNest API is running",
        "current_mode": mode,
        "endpoints": [
            "/state", 
            "/analyze-voice (quick mode)", 
            "/analyze-voice-conversation (conversation mode)",
            "/set-mode/{mode}", 
            "/set-vibe/{vibe_name}", 
            "/action/reset", 
            "/docs"
        ],
        "available_vibes": list(VIBE_PRESETS.keys())
    }

@app.get("/state")
async def get_state():
    with state_lock:
        vibe_key = state.current_vibe
        mode = "conversation" if state.conversation_mode else "quick"
        return {
            "mode": mode,
            "vibe_name": vibe_key,
            "vibe_details": VIBE_PRESETS[vibe_key],
            "transcript": state.transcript[-5:]
        }

@app.post("/set-mode/{mode}")
async def set_mode(mode: str):
    """Toggle between 'quick' and 'conversation' modes"""
    with state_lock:
        if mode == "conversation":
            state.conversation_mode = True
            return {
                "success": True,
                "mode": "conversation",
                "message": "Switched to conversation mode - Gemini will ask follow-up questions"
            }
        elif mode == "quick":
            state.conversation_mode = False
            return {
                "success": True,
                "mode": "quick",
                "message": "Switched to quick mode - instant emotion detection"
            }
        else:
            return {
                "success": False,
                "error": "Invalid mode. Use 'quick' or 'conversation'"
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
        state.pending_vibe = None
        state.awaiting_confirmation = False
    chat_session = model.start_chat(history=[])
    return {"message": "System Reset"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)