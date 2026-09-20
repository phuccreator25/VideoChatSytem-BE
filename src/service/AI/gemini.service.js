import axios from 'axios';
import env from '../../config/env.js';

const generateCallSummary = async (transcript) => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in Backend .env file.");
    }

    if (!Array.isArray(transcript) || transcript.length === 0) {
        return {
            summary: "The call has no conversation content.",
            keyPoints: [],
            actionItems: []
        };
    }

    const transcriptText = transcript
        .map((t) => `[${t.timestamp || 'N/A'}] ${t.speaker || 'Unknown'}: ${t.text || ''}`)
        .join("\n");

    const prompt = `You are an automated API system processing call data.
                    Task: Analyze the transcript below and return the result ONLY AS A SINGLE JSON OBJECT.

                    CRITICAL RULES:
                    1. DO NOT use Markdown codeblocks (NO \`\`\`json or \`\`\`).
                    2. DO NOT add any intro, explanations, or greetings.
                    3. ONLY return a valid JSON string strictly following this schema:

                    {
                    "summary": "Concise summary of the main call content (2-3 sentences)",
                    "keyPoints": ["Key point 1", "Key point 2"],
                    "actionItems": ["Post-call action items (specify assignee if mentioned)"]
                    }

                    Call transcript:
                    ${transcriptText}`;

    try {
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
                model: 'gemini-3.5-flash',
                input: prompt
            },
            {
                headers: {
                    'x-goog-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract text from response flexibly
        const modelOutputStep = response.data?.steps?.find((s) => s.type === 'model_output');
        let rawText =
            modelOutputStep?.content?.[0]?.text ||
            modelOutputStep?.content?.[0]?.parts?.[0]?.text ||
            response.data?.output ||
            response.data?.text;

        if (typeof rawText === 'object') {
            rawText = JSON.stringify(rawText);
        }

        if (!rawText || typeof rawText !== 'string') {
            throw new Error("No text data received from Gemini API.");
        }

        // Clean codeblocks
        const cleanedJsonText = rawText
            .replace(/^```json/gi, '')
            .replace(/^```/gi, '')
            .replace(/```$/g, '')
            .trim();

        const aiSummary = JSON.parse(cleanedJsonText);
        return aiSummary;

    } catch (error) {
        console.error("Error creating call summary:", error?.response?.data || error.message);
        
        if (error instanceof SyntaxError) {
            throw new Error("AI response data could not be parsed into valid JSON.");
        }
        
        throw new Error(error?.response?.data?.error?.message || error.message || "Error processing call summary.");
    }
};


export const GEMINI_SERVICE = {
    generateCallSummary,
};
