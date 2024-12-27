import dotenv from 'dotenv';
import path from 'path';

export function configureEnv(envPath = '/home/mark/Repos/.env') {
  dotenv.config({ path: path.resolve(envPath) });
}

export function checkEnv(variableName = "OPENAI_API_KEY") {
  if (!process.env[variableName]) {
    console.error(`No ${variableName} found`);
    return false;
  }
  return true;
}