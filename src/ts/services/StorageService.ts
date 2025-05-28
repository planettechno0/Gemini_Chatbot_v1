import type { AppStateData, ArchivedChat } from '../types/index.d.ts';
import { CONSTANTS } from '../config/constants.js';

export class StorageService {
    constructor() {
        // Stateless service
    }

    public loadState(): AppStateData | null {
        try {
            const serializedState = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_STATE_KEY);
            if (serializedState === null) {
                console.info('[StorageService] No saved state found in localStorage.');
                return null;
            }
            const storedState: AppStateData = JSON.parse(serializedState);
            console.info('[StorageService] State loaded successfully from localStorage.');
            return storedState;
        } catch (error) {
            console.error('[StorageService] Failed to load state from localStorage:', error);
            // Optionally clear corrupted data:
            // localStorage.removeItem(CONSTANTS.LOCAL_STORAGE_STATE_KEY);
            return null;
        }
    }

    public saveState(state: AppStateData): boolean {
        try {
            const serializedState = JSON.stringify(state);
            localStorage.setItem(CONSTANTS.LOCAL_STORAGE_STATE_KEY, serializedState);
            console.info('[StorageService] State saved successfully to localStorage.');
            return true;
        } catch (error) {
            console.error('[StorageService] Failed to save state to localStorage:', error);
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
                console.error('[StorageService] LocalStorage quota exceeded.');
                // Handle quota error, e.g., notify user, try to free up space
            }
            return false;
        }
    }

    public loadArchivedChats(): ArchivedChat[] {
        try {
            const serializedChats = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_ARCHIVED_CHATS_KEY);
            if (serializedChats === null) {
                console.info('[StorageService] No archived chats found in localStorage.');
                return [];
            }
            const archivedChats: ArchivedChat[] = JSON.parse(serializedChats);
            console.info('[StorageService] Archived chats loaded successfully from localStorage.');
            return archivedChats;
        } catch (error) {
            console.error('[StorageService] Failed to load archived chats from localStorage:', error);
            return [];
        }
    }

    public saveArchivedChats(chats: ArchivedChat[]): boolean {
        try {
            const serializedChats = JSON.stringify(chats);
            localStorage.setItem(CONSTANTS.LOCAL_STORAGE_ARCHIVED_CHATS_KEY, serializedChats);
            console.info('[StorageService] Archived chats saved successfully to localStorage.');
            return true;
        } catch (error) {
            console.error('[StorageService] Failed to save archived chats to localStorage:', error);
             if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
                console.error('[StorageService] LocalStorage quota exceeded when saving archived chats.');
            }
            return false;
        }
    }

    public clearAllChatData(): void {
        try {
            localStorage.removeItem(CONSTANTS.LOCAL_STORAGE_STATE_KEY);
            localStorage.removeItem(CONSTANTS.LOCAL_STORAGE_ARCHIVED_CHATS_KEY);
            console.info('[StorageService] All application chat data cleared from localStorage.');
        } catch (error) {
            console.error('[StorageService] Error clearing data from localStorage:', error);
        }
    }

    // Example method to clear only current conversation state
    public clearCurrentChatState(): void {
        try {
            const currentState = this.loadState();
            if (currentState) {
                currentState.conversation = [];
                // Potentially reset other parts of state related to current chat
                // but preserve API key, model, custom instructions
                this.saveState(currentState);
                console.info('[StorageService] Current chat conversation cleared from localStorage state.');
            }
        } catch (error) {
            console.error('[StorageService] Error clearing current chat state from localStorage:', error);
        }
    }
}
