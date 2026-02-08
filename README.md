🏠 **MoodNest**: The Empathic Smart Home
MoodNest is an AI-driven smart home assistant that doesn't just follow orders—it feels you. By analyzing the sentiment and tone of your voice, MoodNest dynamically transforms your living environment to match or improve your emotional state.

🚀 The Vision
In high-stress environments, our surroundings should proactively support our mental well-being. MoodNest bridges the gap between Generative AI and Spatial Computing, creating a real-time feedback loop between human emotion and 3D architectural space.

🛠️ Tech Stack
Frontend: React.js, Three.js (3D Room Simulation), JavaScript.

Backend: FastAPI (Python), Multithreading.

AI Intelligence: Gemini 2.5 Flash-Lite (Sentiment Analysis).

Voice Synthesis: ElevenLabs (Rachel Voice).

Audio Processing: SpeechRecognition (STT), io.BytesIO.

✨ Key Features
Voice-to-Vibe Mapping: Analyzes audio to categorize user intent into core presets: Happy, Sad, Angry, and Neutral.

3D Spatial Feedback: Real-time lighting and music updates to a Three.js environment based on AI deductions.

Empathetic Dialogue: Provides vocal support through ElevenLabs while simultaneously reconfiguring the home.

🚀 Getting Started
1. Prerequisites
Ensure you have Python 3.9+ installed and a .env file with your API keys:

Plaintext
GOOGLE_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key

2. Installation
Clone the repository

git clone -b audio_new https://github.com/yourusername/moodnest.git

Install dependencies

pip install fastapi uvicorn google-generativeai elevenlabs speechrecognition

4. Run the Backend

python app.py

5. Connect the Frontend
Your React/Three.js frontend should point to the following local endpoint:

State Updates: GET http://localhost:8000/state

Audio Upload: POST http://localhost:8000/upload-audio

👥 Contributors
Jun, Ryan, Leon, Inyun - University of Waterloo
