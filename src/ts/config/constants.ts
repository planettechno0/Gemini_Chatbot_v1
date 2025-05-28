export const CONSTANTS = {
    API_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    API_GENERATE_CONTENT_METHOD: 'generateContent',
    DEFAULT_MODEL: 'gemini-1.5-flash-latest', // Example default model
    LOCAL_STORAGE_STATE_KEY: 'geminiOopChatState',
    LOCAL_STORAGE_ARCHIVED_CHATS_KEY: 'geminiOopArchivedChats',
    MAX_CONVERSATION_HISTORY_API: 10, // Max user/model turns to send to API
                                      // (actual number of messages is double this)
};
