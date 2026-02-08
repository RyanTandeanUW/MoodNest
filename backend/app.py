import os
import io
import json
import base64
import threading
from dotenv import load_dotenv

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
    "You are MoodNest, an AI assistant that controls smart home lighting based on the user's mood.\n\n"
    "CONVERSATION FLOW:\n"
    "1. Ask follow-up questions to understand how the user is feeling\n"
    "2. When you're confident about their mood, ASK them: 'Would you like me to change your home lighting to match this [emotion] feeling?'\n"
    "   - Use the EXACT mood word in your question (happy, sad, angry, or neutral)\n"
    "   - Make sure your description matches the mood you're detecting\n"
    "3. Wait for their yes/no response\n"
    "4. Only apply the mood change if they say yes\n\n"
    "MOOD DEFINITIONS (BE CONSISTENT!):\n"
    "- happy: Joyful, excited, cheerful, energetic, positive, upbeat, great, good\n"
    "- sad: Down, melancholic, tired, low energy, disappointed, upset, blue\n"
    "- angry: Frustrated, irritated, stressed, annoyed, mad, tense\n"
    "- neutral: Calm, balanced, content, relaxed, at ease, okay, fine\n\n"
    "EXAMPLE GOOD RESPONSE:\n"
    "\"It sounds like you're feeling really cheerful and energetic today! Would you like me to change your home lighting to match this happy feeling?\"\n"
    "JSON: {\"vibe\": \"happy\", \"confirm_request\": true}\n\n"
    "RESPONSE FORMAT:\n"
    "When asking for confirmation:\n"
    "JSON: {\"vibe\": \"[mood]\", \"confirm_request\": true}\n"
    "CRITICAL: The 'vibe' MUST match the emotion you described in your text!\n\n"
    "When user responds yes/no:\n"
    "JSON: {\"vibe\": \"[same_mood]\", \"confirmed\": true}  (if yes)\n"
    "JSON: {\"confirmed\": false}  (if no)\n\n"
    "Always be conversational, empathetic, and CONSISTENT with mood detection!"
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
    
    print(f"🤖 Full Gemini response: {full_reply}")
    
    # 3. Strip the JSON block so the user only hears the spoken part
    # Remove everything after "JSON:" or any JSON-like content
    clean_text = full_reply
    
    # Split on JSON: marker first
    if "JSON:" in clean_text:
        clean_text = clean_text.split("JSON:")[0]
    
    # Also remove any standalone JSON blocks that might appear
    import re
    clean_text = re.sub(r'\{[^}]*"vibe"[^}]*\}', '', clean_text)
    clean_text = re.sub(r'\{[^}]*"confirmed"[^}]*\}', '', clean_text)
    clean_text = re.sub(r'\{[^}]*"confirm_request"[^}]*\}', '', clean_text)
    
    # Remove any markdown code blocks
    clean_text = re.sub(r'```json.*?```', '', clean_text, flags=re.DOTALL)
    clean_text = re.sub(r'```.*?```', '', clean_text, flags=re.DOTALL)
    
    # Clean up extra whitespace
    clean_text = ' '.join(clean_text.split()).strip()
    
    print(f"💬 Clean text for audio: {clean_text}")

    # 4. Parse the JSON to handle confirmation flow
    new_vibe = None
    confirm_request = False
    confirmed = None
    
    try:
        if "JSON:" in full_reply:
            json_str = full_reply.split("JSON:")[1].strip()
            # Clean up any markdown formatting
            json_str = json_str.replace("```json", "").replace("```", "").strip()
            data = json.loads(json_str)
            
            new_vibe = data.get("vibe")
            confirm_request = data.get("confirm_request", False)
            confirmed = data.get("confirmed")
            
    except Exception as e:
        print(f"⚠️ JSON parsing failed: {e}")
        # Fallback: try to extract vibe from text
        import re
        vibe_match = re.search(r'vibe[:\s]+["\']?(happy|sad|angry|neutral)["\']?', full_reply, re.IGNORECASE)
        if vibe_match:
            new_vibe = vibe_match.group(1).lower()
            print(f"💡 Extracted vibe from text: {new_vibe}")
    
    # Validate mood matches what was said
    if new_vibe and confirm_request:
        mood_keywords = {
            "happy": ["happy", "joy", "great", "good", "excited", "energetic", "cheerful", "positive"],
            "sad": ["sad", "down", "tired", "low", "disappointed", "upset", "melancholic"],
            "angry": ["angry", "frustrated", "stressed", "irritated", "annoyed", "mad"],
            "neutral": ["neutral", "calm", "balanced", "content", "relaxed", "okay", "fine"]
        }
        
        text_lower = clean_text.lower()
        detected_keywords = mood_keywords.get(new_vibe, [])
        has_matching_keyword = any(keyword in text_lower for keyword in detected_keywords)
        
        if not has_matching_keyword:
            print(f"⚠️ WARNING: Detected mood '{new_vibe}' doesn't match conversational text!")
            print(f"   Text: {clean_text[:100]}...")
    
    # Handle the confirmation flow
    with state_lock:
        if confirm_request and new_vibe and new_vibe in VIBE_PRESETS:
            # Gemini is asking user for permission
            state.pending_vibe = new_vibe
            state.awaiting_confirmation = True
            print(f"❓ Asking user to confirm mood change to: {new_vibe}")
            
        elif confirmed is True and state.pending_vibe:
            # User said yes - apply the pending mood
            old_vibe = state.current_vibe
            state.current_vibe = state.pending_vibe
            print(f"✅ User confirmed! Mood changed: {old_vibe} → {state.current_vibe}")
            state.pending_vibe = None
            state.awaiting_confirmation = False
            
        elif confirmed is False:
            # User said no - cancel the pending mood
            print(f"❌ User declined mood change to {state.pending_vibe}")
            state.pending_vibe = None
            state.awaiting_confirmation = False

    # 5. Add AI's text to history
    with state_lock:
        state.transcript.append({"role": "assistant", "content": clean_text})

    # 6. Generate ElevenLabs audio response and return as base64
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
            "Transcribe this audio exactly. Return only the spoken words, no other text.",
            audio_file
        ])
        
        user_text = transcribe_response.text.strip()
        print(f"💬 User said: {user_text}")
        
        # Clean up temp file
        import os as os_module
        if os_module.path.exists(temp_path):
            os_module.remove(temp_path)
        
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
            os_module.remove("temp_audio_conv.wav")
        
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
    chat_session = model.start_chat(history=[])
    return {"message": "System Reset"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
