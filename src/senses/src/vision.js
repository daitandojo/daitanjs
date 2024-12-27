import fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const apiKey = process.env.OPENAI_API_KEY;

const encodeImage = async (imagePath) => {
  const buffer = await fs.readFile(imagePath);
  return buffer.toString('base64');
};

const defaultPath =
  '/home/mark/Repos/booktranslator/pages/lightindarkness.jpeg';

const analyzeImage = async ({ imagePath = defaultPath }) => {
  try {
    const base64Image = await encodeImage(imagePath);
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe the text in this image in Spanish',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    };

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      { headers },
    );

    console.dir(response.data.choices[0].message);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
};

export { analyzeImage };
