import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// Load environment variables from .env file
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const tts = async ({
  text,
  outputFile = 'output.mp3',
  options = {},
  gender = 'NEUTRAL', // Default gender is NEUTRAL
  language = 'es-ES'  // Default language is en-US
}) => {
  try {
    return;
    const voiceNames = {
      'en-US': {
        MALE: 'en-US-Wavenet-D',
        FEMALE: 'en-US-Wavenet-F',
        NEUTRAL: 'en-US-Wavenet-C'
      },
      // Add more languages here with corresponding voice names
      'es-ES': {
        MALE: 'es-ES-Wavenet-B',
        FEMALE: 'es-ES-Neural2-C',
        NEUTRAL: 'es-ES-Wavenet-C'
      },
      // You can add additional language/voice configurations here
    };

    const voiceName = (voiceNames[language] && voiceNames[language][gender.toUpperCase()]) 
                      || voiceNames['en-US'][gender.toUpperCase()];

    const request = {
      input: { text },
      voice: { languageCode: language, name: voiceName, ssmlGender: gender, ...options.voice },
      audioConfig: { audioEncoding: 'MP3', ...options.audioConfig },
    };

    const [response] = await client.synthesizeSpeech(request);

    await fs.writeFile(outputFile, response.audioContent, 'binary');
    console.log(`Audio content written to file: ${outputFile}`);

    // Play the audio file using child_process and mpg123, and return a promise
    return new Promise((resolve, reject) => {
      exec(`mpg123 ${outputFile}`, (err, stdout, stderr) => {
        if (err) {
          console.error('Error playing the audio file:', stderr);
          reject(err);
        } else {
          console.log('Playback finished.');
          resolve();
        }
      });
    });

  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
};

// CLI functionality
// if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
//   const args = process.argv.slice(2);
//   if (args.length < 1) {
//     console.error('Usage: node tts.js <text> [outputFile] [gender]');
//     process.exit(1);
//   }

//   const text = args[0];
//   const outputFile = args[1] || 'output.mp3';
//   const gender = args[2] || 'NEUTRAL'; // Default to NEUTRAL if not provided

//   tts({ text, outputFile, gender })
//     .then(filePath => {
//       console.log(`Speech synthesized and saved to: ${filePath}`);
//     })
//     .catch(error => {
//       console.error('Speech synthesis failed:', error);
//     });
// }

export { tts };
