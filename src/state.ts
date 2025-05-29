// src/state.ts

// --- Type Definitions ---

export interface UserMessageContentPart {
  type: 'text' | 'image';
  data: string; // Text content or Base64 image data
  mimeType?: string; // For images, e.g., 'image/png', 'image/jpeg'
}

export interface ChatMessage {
  id: string; // Unique ID for each message
  role: 'user' | 'model' | 'system'; // System messages for errors or info
  content: UserMessageContentPart[]; // Array to support multi-modal input like text + image
  timestamp: number;
  meta?: { // Optional metadata
    isLoading?: boolean; // For AI responses that are being generated
    error?: string; // If an error occurred generating this message
    edited?: boolean; // If the user message was edited
    regenerated?: boolean; // If the AI response was regenerated
    originalMessageId?: string; // For edited/regenerated messages, points to the original
  };
}

export interface AppStateData {
  apiKey: string | null;
  selectedModel: string;
  customInstructions: string;
  currentConversation: ChatMessage[];
  // Potentially add: isLoading, error, etc. at the app level
  isSending: boolean; // True when a message is being sent to the API
  currentError: string | null; // General app error message
  // UI states
  isSettingsModalOpen: boolean;
  isLogsModalOpen: boolean;
  isConfirmModalOpen: boolean;
  confirmModalAction: (() => void) | null;
  confirmModalMessage: string;
  isEditModalOpen: boolean;
  editingMessage: ChatMessage | null; // Message being edited
}

export type AppStateSubscriber = (state: AppStateData) => void;

// --- AppState Class (Singleton) ---

const DEFAULT_MODEL = 'gemini-1.5-flash-latest'; // Or any other default model

export class AppState {
  private static instance: AppState;
  private state: AppStateData;
  private subscribers: AppStateSubscriber[];

  private constructor(initialState?: Partial<AppStateData>) {
    this.state = {
      apiKey: null,
      selectedModel: DEFAULT_MODEL,
      customInstructions: '',
      currentConversation: [],
      isSending: false,
      currentError: null,
      isSettingsModalOpen: false,
      isLogsModalOpen: false,
      isConfirmModalOpen: false,
      confirmModalAction: null,
      confirmModalMessage: '',
      isEditModalOpen: false,
      editingMessage: null,
      ...initialState, // Spread any initial state provided (e.g., from localStorage)
    };
    this.subscribers = [];
  }

  public static getInstance(initialState?: Partial<AppStateData>): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState(initialState);
    }
    return AppState.instance;
  }

  public getState(): AppStateData {
    // Return a deep copy to prevent direct modification
    return JSON.parse(JSON.stringify(this.state));
  }

  public updateState(updater: (currentState: AppStateData) => Partial<AppStateData>): void {
    const updates = updater(this.getState()); // Pass a copy to updater
    // Create a new state object to ensure immutability and trigger change detection
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  public subscribe(callback: AppStateSubscriber): () => void {
    this.subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notify(): void {
    // Notify subscribers with a deep copy of the current state
    const currentState = this.getState();
    for (const subscriber of this.subscribers) {
      try {
        subscriber(currentState);
      } catch (error) {
        console.error("Error in AppState subscriber:", error);
      }
    }
  }

  // --- Convenience Methods for State Updates ---

  public setApiKey(apiKey: string | null): void {
    this.updateState(s => ({ ...s, apiKey }));
  }

  public setSelectedModel(model: string): void {
    this.updateState(s => ({ ...s, selectedModel: model }));
  }

  public setCustomInstructions(instructions: string): void {
    this.updateState(s => ({ ...s, customInstructions: instructions }));
  }

  public addMessage(message: ChatMessage): void {
    this.updateState(s => ({
      ...s,
      currentConversation: [...s.currentConversation, message],
      currentError: null, // Clear previous errors when a new message is added
    }));
  }

  public updateMessage(messageId: string, updates: Partial<ChatMessage> | ((msg: ChatMessage) => Partial<ChatMessage>)): void {
    this.updateState(s => {
      const newConversation = s.currentConversation.map(msg => {
        if (msg.id === messageId) {
          const newUpdates = typeof updates === 'function' ? updates(msg) : updates;
          return { ...msg, ...newUpdates, meta: { ...msg.meta, ...newUpdates.meta } };
        }
        return msg;
      });
      return { ...s, currentConversation: newConversation };
    });
  }

  public removeMessage(messageId: string): void {
    this.updateState(s => ({
      ...s,
      currentConversation: s.currentConversation.filter(msg => msg.id !== messageId)
    }));
  }

  public clearConversation(): void {
    this.updateState(s => ({ ...s, currentConversation: [] }));
  }

  public setConversation(conversation: ChatMessage[]): void {
    this.updateState(s => ({ ...s, currentConversation: conversation }));
  }

  public setIsSending(isSending: boolean): void {
    this.updateState(s => ({ ...s, isSending }));
  }

  public setError(error: string | null): void {
    this.updateState(s => ({ ...s, currentError: error }));
  }

  public openSettingsModal(): void {
    this.updateState(s => ({ ...s, isSettingsModalOpen: true }));
  }

  public closeSettingsModal(): void {
    this.updateState(s => ({ ...s, isSettingsModalOpen: false }));
  }

  public openLogsModal(): void {
    this.updateState(s => ({ ...s, isLogsModalOpen: true }));
  }

  public closeLogsModal(): void {
    this.updateState(s => ({ ...s, isLogsModalOpen: false }));
  }

  public openConfirmModal(message: string, action: () => void): void {
    this.updateState(s => ({
      ...s,
      isConfirmModalOpen: true,
      confirmModalMessage: message,
      confirmModalAction: action,
    }));
  }

  public closeConfirmModal(): void {
    this.updateState(s => ({
      ...s,
      isConfirmModalOpen: false,
      confirmModalMessage: '',
      confirmModalAction: null,
    }));
  }
  
  public openEditModal(message: ChatMessage): void {
    this.updateState(s => ({ ...s, isEditModalOpen: true, editingMessage: message }));
  }

  public closeEditModal(): void {
    this.updateState(s => ({ ...s, isEditModalOpen: false, editingMessage: null }));
  }
}
