import type { AppStateData, MessageData } from '../types/index.d.ts'; // MessageData might be relevant for payload construction later
import { CONSTANTS } from '../config/constants.js';

// Define more specific types for API interaction if possible, based on Gemini API documentation
// For now, using 'any' for brevity, but these should be refined.
interface GeminiRequestPayload {
    contents: any[]; // Array of content objects (user/model turns)
    safetySettings?: any[]; // Optional safety settings
    generationConfig?: any; // Optional generation config
}

interface GeminiSuccessResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
            role: string;
        };
        finishReason?: string;
        index?: number;
        safetyRatings?: Array<any>; // Define more strictly if needed
    }>;
    promptFeedback?: {
        blockReason?: string;
        safetyRatings?: Array<any>; // Define more strictly if needed
    };
}

interface GeminiErrorResponse {
    error: {
        code: number;
        message: string;
        status: string;
    };
}

export class GeminiAPIService {
    constructor() {
        // Service can be stateless, or initialized with some config if needed
    }

    public async generateContent(
        payload: GeminiRequestPayload, // Use the defined interface
        apiKey: string,
        model: string
    ): Promise<GeminiSuccessResponse> { // Return a more specific type
        if (!apiKey) {
            throw new Error('API Key is required for GeminiAPIService.');
        }
        if (!model) {
            throw new Error('Model is required for GeminiAPIService.');
        }

        const API_URL = `${CONSTANTS.API_BASE_URL}/${model}:${CONSTANTS.API_GENERATE_CONTENT_METHOD}?key=${apiKey}`;

        console.info('[GeminiAPIService] Sending request to:', API_URL);
        console.debug('[GeminiAPIService] Payload:', JSON.stringify(payload, null, 2));


        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseData: GeminiSuccessResponse | GeminiErrorResponse = await response.json();

            if (!response.ok) {
                const error = responseData as GeminiErrorResponse;
                console.error('[GeminiAPIService] API Error:', error);
                let errorMessage = `API request failed with status ${response.status}.`;
                if (error.error && error.error.message) {
                    errorMessage += ` Message: ${error.error.message}`;
                }
                // Throw a custom error object or re-throw the API's error structure
                throw {
                    message: errorMessage,
                    status: response.status,
                    details: error.error || 'No additional error details provided.'
                };
            }
            
            // Check for block reasons or other non-OK but structured responses
            const successData = responseData as GeminiSuccessResponse;
            if (successData.promptFeedback && successData.promptFeedback.blockReason) {
                console.warn('[GeminiAPIService] Request blocked:', successData.promptFeedback.blockReason);
                // Depending on requirements, this might be treated as an error or a specific type of response
                // For now, returning it as part of the "success" shape, App/Components can decide
            } else if (!successData.candidates || successData.candidates.length === 0) {
                 console.warn('[GeminiAPIService] No candidates returned from API.');
                 // This could also be an error or a specific state.
                 // For now, we let it pass, the caller should check candidates array.
            }

            console.info('[GeminiAPIService] Response received successfully.');
            console.debug('[GeminiAPIService] Response Data:', JSON.stringify(successData, null, 2));
            return successData;

        } catch (error: any) {
            console.error('[GeminiAPIService] Network or parsing error:', error);
            // Ensure a consistent error shape is thrown
            if (error.message && error.status) { // It's already our custom error
                throw error;
            }
            throw {
                message: error.message || 'An unexpected error occurred during API communication.',
                status: error.status || 500, // Generic server error if status unknown
                details: error.details || error
            };
        }
    }
}

// Example of how it might be used (for testing purposes, not part of the class itself)
// async function testService() {
//     const service = new GeminiAPIService();
//     const DUMMY_API_KEY = 'YOUR_API_KEY'; // Replace with a real key for actual testing
//     const DUMMY_MODEL = 'gemini-1.5-flash-latest'; // or another valid model

//     if (DUMMY_API_KEY === 'YOUR_API_KEY') {
//         console.warn("Skipping testService as DUMMY_API_KEY is not set.");
//         return;
//     }

//     try {
//         const response = await service.generateContent(
//             { contents: [{ role: 'user', parts: [{ text: 'Hello, world!' }] }] },
//             DUMMY_API_KEY,
//             DUMMY_MODEL
//         );
//         console.log('Test API Response:', response);
//         if (response.candidates && response.candidates.length > 0) {
//             console.log('Generated text:', response.candidates[0].content.parts[0].text);
//         }
//     } catch (error) {
//         console.error('Test API Error:', error);
//     }
// }
// testService(); // Uncomment for manual testing if needed
