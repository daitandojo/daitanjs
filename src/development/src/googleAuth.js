import { google } from 'googleapis';

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
);

export default oauth2Client;