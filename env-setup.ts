import dotenv from 'dotenv';
import path from 'path';

// Load .env.local immediately
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('[STARTUP] Environment variables loaded.');
console.log('[DEBUG] GEMINI_API_KEY check:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
