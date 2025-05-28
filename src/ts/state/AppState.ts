import type { AppStateData, MessageData, ArchivedChat } from '../types/index.d.ts';
import { StorageService } from '../services/StorageService.js';
import { CONSTANTS } from '../config/constants.js';

type Subscriber = (state: AppStateData) => void;

export class AppState {
    private static instance: AppState;
    private state: AppStateData;
    private subscribers: Subscriber[] = [];
    private storageService: StorageService;

    private constructor() {
        this.storageService = new StorageService();
        this.state = this.loadInitialState();
        console.info('[AppState] Initialized with state:', this.state);
    }

    public static getInstance(): AppState {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }

    private loadInitialState(): AppStateData {
        const savedState = this.storageService.loadState();
        if (savedState) {
            // Ensure conversation is always an array, even if savedState.conversation is null/undefined
            savedState.conversation = savedState.conversation || [];
            return savedState;
        }
        return {
            apiKey: '',
            selectedModel: CONSTANTS.DEFAULT_MODEL,
            customInstructions: '',
            conversation: [],
        };
    }

    public subscribe(callback: Subscriber): () => void {
        this.subscribers.push(callback);
        console.info('[AppState] New subscriber added. Total:', this.subscribers.length);
        // Optionally, immediately call back with current state
        // callback(this.state); 
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
            console.info('[AppState] Subscriber removed. Total:', this.subscribers.length);
        };
    }

    private notify(): void {
        console.debug('[AppState] Notifying subscribers. Current state:', this.state);
        this.storageService.saveState(this.state);
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('[AppState] Error in subscriber callback:', error);
            }
        });
    }

    // --- Getters ---
    public getStateSnapshot(): AppStateData {
        // Return a deep copy if state is complex and direct mutation is a risk
        // For now, returning the direct state object for simplicity in subscribers
        return this.state;
    }
    public getApiKey(): string { return this.state.apiKey; }
    public getSelectedModel(): string { return this.state.selectedModel; }
    public getCustomInstructions(): string { return this.state.customInstructions; }
    public getConversation(): MessageData[] { return [...this.state.conversation]; } // Return a copy

    // --- Setters / Updaters ---
    public setApiKey(apiKey: string): void {
        if (this.state.apiKey !== apiKey) {
            this.state.apiKey = apiKey;
            console.log('[AppState] API Key updated.');
            this.notify();
        }
    }

    public updateSettings(apiKey: string, selectedModel: string, customInstructions: string): void {
        let changed = false;
        if (this.state.apiKey !== apiKey) { this.state.apiKey = apiKey; changed = true; }
        if (this.state.selectedModel !== selectedModel) { this.state.selectedModel = selectedModel; changed = true; }
        if (this.state.customInstructions !== customInstructions) { this.state.customInstructions = customInstructions; changed = true; }
        
        if (changed) {
            console.log('[AppState] Settings updated:', { apiKey, selectedModel, customInstructions });
            this.notify();
        }
    }

    public addMessage(message: MessageData): void {
        this.state.conversation.push(message);
        console.log('[AppState] Message added:', message);
        this.notify();
    }
    
    public addMessages(messages: MessageData[]): void {
        this.state.conversation.push(...messages);
        console.log('[AppState] Multiple messages added:', messages.length);
        this.notify();
    }

    public updateMessage(messageId: string, updatedProperties: Partial<MessageData>): void {
        const messageIndex = this.state.conversation.findIndex(msg => msg.id === messageId);
        if (messageIndex > -1) {
            this.state.conversation[messageIndex] = {
                ...this.state.conversation[messageIndex],
                ...updatedProperties
            };
            console.log('[AppState] Message updated:', this.state.conversation[messageIndex]);
            this.notify();
        } else {
            console.warn('[AppState] Attempted to update non-existent message, ID:', messageId);
        }
    }
    
    public removeLastNMessages(count: number): void {
        if (count <= 0) return;
        this.state.conversation.splice(-count);
        console.log(`[AppState] Last ${count} message(s) removed.`);
        this.notify();
    }

    public clearConversation(): void {
        if (this.state.conversation.length > 0) {
            this.state.conversation = [];
            console.log('[AppState] Conversation cleared.');
            this.notify();
        }
    }
    
    public replaceConversation(messages: MessageData[]): void {
        this.state.conversation = messages;
        console.log('[AppState] Conversation replaced.');
        this.notify();
    }

    public resetStateToDefaults(preserveApiKey: boolean = true): void {
        const currentApiKey = this.state.apiKey;
        this.state = {
            apiKey: preserveApiKey ? currentApiKey : '',
            selectedModel: CONSTANTS.DEFAULT_MODEL,
            customInstructions: '',
            conversation: [],
        };
        console.log('[AppState] State reset to defaults.', { preserveApiKey });
        this.notify();
    }
}
