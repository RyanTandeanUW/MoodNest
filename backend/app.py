from fastapi import FastAPI, UploadFile
from speechbrain.inference.interfaces import foreign_class

app = FastAPI()

# Load the emotion model
classifier = foreign_class(
    source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
    pymodule_file="custom_interface.py",
    classname="CustomEncoderWav2vec2Classifier"
)

@app.post("/emotion/voice")
async def emotion_from_voice(file: UploadFile):
    # Save the uploaded audio temporarily
    with open("temp.wav", "wb") as f:
        f.write(await file.read())

    # Run the model
    result = classifier.classify_file("temp.wav")
    return result