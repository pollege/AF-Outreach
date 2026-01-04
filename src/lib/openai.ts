import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set in environment variables.');
}

export const openai = new OpenAI({
    apiKey: apiKey || 'dummy-key', // Prevent crash on init, but calls will fail if missing
    dangerouslyAllowBrowser: true // Ideally we only use this server-side, but this flag allows client usage if strictly necessary (NOT RECOMMENDED)
});
