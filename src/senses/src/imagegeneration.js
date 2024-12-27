import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const apiKey = process.env.OPENAI_API_KEY;

const generateImage = async ({
  prompt, 
  outputPath = './generated_image.png'
}) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const imageData = response.data.data[0].b64_json;
    const buffer = Buffer.from(imageData, 'base64');

    if (typeof window === 'undefined') {
      const fs = await import('fs');
      fs.writeFileSync(outputPath, buffer);
      console.log(`Image generated and saved to ${outputPath}`);
    } else {
      console.warn('File system operations are only available on the server.');
    }

    return outputPath;
  } catch (error) {
    console.error('Error generating image:', error.response?.data || error.message);
    throw error;
  }
};

export { generateImage };
