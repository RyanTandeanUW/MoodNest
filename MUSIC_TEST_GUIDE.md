# Music Testing Guide

## How Music Works in MoodNest

### Quick Mode

- **Behavior**: Instantly detects emotion from voice → changes mood → plays music
- **Music starts**: Immediately after emotion detection
- **Track mapping**:
  - Happy → Energetic track (yellow lights)
  - Sad → Calming track (blue lights)
  - Angry → Intense track (red lights)
  - Neutral → No music (white lights)

### Conversation Mode ("Talk")

- **Behavior**: Gemini asks follow-up questions → confirms mood → waits for "yes" → then changes mood and plays music
- **Music starts**: ONLY after user says "yes" to confirmation
- **Each recording maintains conversation history**

## Testing Steps

### Test 1: Quick Mode Music

1. Start backend: `cd backend && python app.py`
2. Start frontend: `cd frontend && npm run dev`
3. Click apartment to expand
4. Select "⚡ Quick" mode
5. Hold record button and say: "I'm feeling really happy today!"
6. Release button
7. **Expected**:
   - Lights turn yellow/energetic
   - Happy music starts playing automatically
   - Console shows: `🎵 Music playing: happy`

### Test 2: Conversation Mode Music (Separate Questions)

1. Select "💬 Talk" mode
2. **First recording** - Hold and say: "Hey"
3. Release
4. **Expected**:
   - Gemini responds with voice: "How are you feeling today?"
   - No mood change
   - No music plays
5. **Second recording** - Hold and say: "I'm feeling great!"
6. Release
7. **Expected**:
   - Gemini asks follow-up: "That's wonderful! What's making you feel so good?"
   - Still no mood change
   - Still no music
8. **Third recording** - Hold and say: "I just finished a big project"
9. Release
10. **Expected**:
    - Gemini says: "Would you like me to change your lighting and music to match this happy feeling?"
    - Lights stay current (no change yet)
    - Music doesn't play yet
11. **Fourth recording** - Hold and say: "Yes"
12. Release
13. **Expected**:
    - Lights turn yellow/energetic
    - Happy music starts playing
    - Console shows: `✅ Mood confirmed, updating lights and music: happy`
    - Console shows: `🎵 Changing track to: [dropbox URL]`
    - Console shows: `🎵 Music playing: happy`

### Test 3: Conversation Mode - Saying "No"

1. Follow steps 1-10 from Test 2
2. **Instead say**: "No"
3. **Expected**:
   - Lights stay same
   - Music doesn't change
   - Gemini acknowledges: "Okay, your current settings will stay the same."

## Debugging

### Music Not Playing?

Check browser console for these messages:

- ✅ `🎵 Music sync - mood: [mood] track: [url]`
- ✅ `🎵 Changing track to: [url]`
- ✅ `🎵 Music playing: [mood]`
- ❌ `⏸️ Audio waiting for user interaction...` → Click anywhere on page first (browser autoplay policy)
- ❌ `❌ Music sync failed` → Backend might not be running

### Music Playing at Wrong Time in Conversation Mode?

Check console for:

- During questions: `⏳ Waiting for user confirmation before changing mood` ✅
- After "yes": `✅ Mood confirmed, updating lights and music: [mood]` ✅

### Dropbox Links Not Working?

- Make sure `&raw=1` is at the end of each URL in VIBE_PRESETS
- Test URL directly in browser - should download/play audio file

## Volume Control

- Use the 🔊 button in top right to mute/unmute music
- Music volume is set to 50% by default (see App.jsx line 36)

## Key Code Changes Made

1. **Backend (app.py)**:
   - ✅ Music tracks in VIBE_PRESETS with Dropbox URLs
   - ✅ Conversation mode maintains context via `chat_session`
   - ✅ Only changes `state.current_vibe` after user confirms "yes"
   - ✅ System prompt instructs Gemini to ask ONE question at a time

2. **Frontend (App.jsx)**:
   - ✅ Music syncs from `/state` endpoint every time `currentMood` changes
   - ✅ Console logs for debugging music playback
   - ✅ Volume set to 50%
   - ✅ Mute button in top right

3. **Frontend (VoiceRecorder.jsx)**:
   - ✅ Checks `!result.awaiting_confirmation` before calling `onRecordingComplete`
   - ✅ Console logs to show when waiting for confirmation
   - ✅ Console logs when mood is confirmed and applied

## Expected Console Output (Conversation Mode)

### Recording 1 (Initial greeting):

```
🤖 Full Gemini response: How are you feeling today?
💬 Clean text for audio: How are you feeling today?
🔊 Playing AI audio through browser
⏳ Waiting for user confirmation before changing mood
```

### Recording 2 (User shares feeling):

```
🤖 Full Gemini response: That's wonderful! What's making you feel so good?
💬 Clean text for audio: That's wonderful! What's making you feel so good?
🔊 Playing AI audio through browser
⏳ Waiting for user confirmation before changing mood
```

### Recording 3 (Gemini asks for confirmation):

```
🤖 Full Gemini response: Would you like me to change your home lighting and music to match this happy feeling?
JSON: {"vibe": "happy", "confirm_request": true}
💬 Clean text for audio: Would you like me to change your home lighting and music to match this happy feeling?
❓ Asking user to confirm mood change to: happy
🔊 Playing AI audio through browser
⏳ Waiting for user confirmation before changing mood
```

### Recording 4 (User says "yes"):

```
🤖 Full Gemini response: Great! I'll change your lighting and music to match your happy mood.
JSON: {"vibe": "happy", "confirmed": true}
💬 Clean text for audio: Great! I'll change your lighting and music to match your happy mood.
✅ User confirmed! Mood changed: neutral → happy
🔊 Playing AI audio through browser
✅ Mood confirmed, updating lights and music: happy
🎵 Music sync - mood: happy track: https://www.dropbox.com/scl/fi/.../happy.mp3?...&raw=1
🎵 Changing track to: https://www.dropbox.com/scl/fi/.../happy.mp3?...&raw=1
🎵 Music playing: happy
```
