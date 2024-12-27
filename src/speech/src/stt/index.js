import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const apiKey = process.env.OPENAI_API_KEY;

const transcribeAudio = async (audioFilePath) => {
  try {
    // Read the audio file
    const audioFile = fs.createReadStream(audioFilePath);

    // Create form data
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');

    // Set up the request headers
    const headers = {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${apiKey}`,
    };

    // Make the API request
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      { headers }
    );

    // Return the transcribed text
    return response.data.text;
  } catch (error) {
    console.error('Error transcribing audio:', error.response?.data || error.message);
    throw error;
  }
};

export { transcribeAudio };