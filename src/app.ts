// src/app.ts
import { AppState, ChatMessage, UserMessageContentPart } from './state';
import { StorageService, GeminiAPIService, GeminiRequestContent, ArchivedChat } from './services';
import { Header, ChatHistory, ChatInput, SettingsModal, LogsModal, ConfirmModal, EditModal } from './components';
import { marked } from 'marked'; // Using a proper Markdown library for safety and features

export class App {
  private appState: AppState;
  private storageService: StorageService;
  private geminiService: GeminiAPIService;

  // UI Components
  private header!: Header;
  private chatHistory!: ChatHistory;
  private chatInput!: ChatInput;
  private settingsModal!: SettingsModal;
  private logsModal!: LogsModal;
  private confirmModal!: ConfirmModal;
  private editModal!: EditModal;

  private appElement: HTMLElement;

  constructor(appRootSelector: string) {
    const rootElement = document.querySelector(appRootSelector);
    if (!rootElement) {
      throw new Error(`App root element '${appRootSelector}' not found.`);
    }
    this.appElement = rootElement as HTMLElement;

    this.storageService = new StorageService();
    this.geminiService = new GeminiAPIService();

    // Load initial state from storage
    const loadedState = this.storageService.loadState();
    this.appState = AppState.getInstance(loadedState || {}); // Pass loaded or empty object

    // Initialize and mount UI components
    this.initComponents();
    this.setupEventListeners();

    // Initial load of conversation if any
    if (loadedState?.currentConversation?.length) {
      this.appState.setConversation(loadedState.currentConversation);
    } else {
      // Add a welcome message or leave it empty
      this.appState.addMessage({
        id: `sys-${Date.now()}`,
        role: 'system',
        content: [{ type: 'text', data: "Welcome! Configure your API key in settings to begin." }],
        timestamp: Date.now()
      });
    }
    
    // Save state whenever it changes
    this.appState.subscribe(state => {
        this.storageService.saveState(state);
    });

    console.info("Application initialized.");
  }

  private initComponents(): void {
    this.header = new Header(this.appState, this.appElement);
    this.chatHistory = new ChatHistory(this.appState, this.appElement);
    this.chatInput = new ChatInput(this.appState, this.appElement);

    // Modals are not attached to appElement directly here,
    // they attach themselves to document.body when shown.
    this.settingsModal = new SettingsModal(this.appState);
    this.logsModal = new LogsModal(this.appState);
    this.confirmModal = new ConfirmModal(this.appState);
    this.editModal = new EditModal(this.appState);
  }

  private setupEventListeners(): void {
    // Listen for events from components
    this.appElement.addEventListener('send-message', this.handleSendMessage.bind(this) as EventListener);
    this.appElement.addEventListener('regenerate-response', this.handleRegenerateResponse.bind(this) as EventListener);
    this.appElement.addEventListener('edit-message-request', this.handleEditMessageRequest.bind(this) as EventListener);
    this.appElement.addEventListener('new-chat-requested', this.handleNewChatRequest.bind(this) as EventListener);
    
    // Events from modals (can be dispatched on appElement or a specific modal element if preferred)
    this.settingsModal.getElement().addEventListener('test-api-requested', this.handleTestApiRequest.bind(this) as EventListener);
    this.logsModal.getElement().addEventListener('run-basic-tests', this.handleRunBasicTests.bind(this) as EventListener);

    // Example of listening to a specific component's element if not bubbling to appElement
    // this.chatInput.getElement().addEventListener('some-specific-event', handler);
  }

  private async handleSendMessage(event: CustomEvent<{ content: UserMessageContentPart[] }>): Promise<void> {
    const { content } = event.detail;
    if (this.appState.getState().isSending) return;

    const apiKey = this.appState.getState().apiKey;
    if (!apiKey) {
      this.appState.setError("API Key not set. Please configure it in Settings.");
      this.appState.addMessage({
        id: `err-${Date.now()}`,
        role: 'system',
        content: [{ type: 'text', data: "Error: API Key not set. Please configure it in Settings." }],
        timestamp: Date.now(),
        meta: { error: "API Key not set" }
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content,
      timestamp: Date.now(),
    };
    this.appState.addMessage(userMessage);
    this.appState.setIsSending(true);

    const aiThinkingMessageId = `ai-thinking-${Date.now()}`;
    this.appState.addMessage({
        id: aiThinkingMessageId,
        role: 'model',
        content: [{ type: 'text', data: "" }], // Placeholder, content will be updated
        timestamp: Date.now(),
        meta: { isLoading: true }
    });

    try {
      const history = this.appState.getState().currentConversation;
      const geminiHistory = this.buildGeminiHistory(history.slice(0, -1)); // Exclude the "thinking" message

      const payloadContents: GeminiRequestContent[] = [
        ...geminiHistory,
        {
          role: 'user', // Current user message
          parts: content.map(part => {
            if (part.type === 'image') {
              return { inlineData: { mimeType: part.mimeType!, data: part.data.split(',')[1] } }; // Base64 data
            }
            return { text: part.data };
          })
        }
      ];
      
      const systemInstruction = this.appState.getState().customInstructions;
      const requestPayload = {
          contents: payloadContents,
          ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] }})
      };

      const response = await this.geminiService.generateContent(
        this.appState.getState().selectedModel,
        requestPayload,
        apiKey
      );

      const aiResponseText = response.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('
') || 'No response text.';
      
      // Update the "thinking" message with the actual response
      this.appState.updateMessage(aiThinkingMessageId, {
          content: [{ type: 'text', data: aiResponseText }],
          meta: { isLoading: false }
      });

    } catch (error: any) {
      console.error("Error generating content:", error);
      const errorMessage = error.message || "Failed to get response from AI.";
      this.appState.updateMessage(aiThinkingMessageId, {
          content: [{ type: 'text', data: `Error: ${errorMessage}` }],
          meta: { isLoading: false, error: errorMessage }
      });
      this.appState.setError(errorMessage);
    } finally {
      this.appState.setIsSending(false);
    }
  }

  private async handleRegenerateResponse(event: CustomEvent<{ messageId: string }>): Promise<void> {
    const { messageId } = event.detail;
    if (this.appState.getState().isSending) return;

    const conversation = this.appState.getState().currentConversation;
    const messageIndex = conversation.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1 || conversation[messageIndex].role !== 'model') {
        console.error("Cannot regenerate: Message not found or not an AI message.");
        return;
    }

    // Find the user message that prompted this AI response
    let lastUserMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
        if (conversation[i].role === 'user') {
            lastUserMessageIndex = i;
            break;
        }
    }

    if (lastUserMessageIndex === -1) {
        console.error("Cannot regenerate: Could not find preceding user message.");
        return;
    }
    
    const userPromptMessage = conversation[lastUserMessageIndex];

    // Truncate conversation from the AI message to be regenerated
    this.appState.setConversation(conversation.slice(0, messageIndex));
    
    // Resend the last user message's content
    this.handleSendMessage(new CustomEvent('send-message', { detail: { content: userPromptMessage.content } }));
  }

  private async handleEditMessageRequest(event: CustomEvent<{ messageId: string; newContent: UserMessageContentPart[] }>): Promise<void> {
    const { messageId, newContent } = event.detail;
    if (this.appState.getState().isSending) return;

    const conversation = this.appState.getState().currentConversation;
    const messageIndex = conversation.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1 || conversation[messageIndex].role !== 'user') {
      console.error("Cannot edit: Message not found or not a user message.");
      return;
    }

    // Create a new message object for the edited content to maintain history integrity (optional)
    // Or, update the existing message and mark it as edited.
    // For this implementation, we'll update and mark as edited, then truncate.
    
    const updatedMessage: ChatMessage = {
        ...conversation[messageIndex],
        content: newContent,
        timestamp: Date.now(),
        meta: { ...conversation[messageIndex].meta, edited: true }
    };

    // Truncate conversation from the point of the edited message
    // Then add the updated message and resend.
    const truncatedConversation = conversation.slice(0, messageIndex);
    this.appState.setConversation([...truncatedConversation, updatedMessage]);

    // Now, treat this edited message as a new send operation
    this.handleSendMessage(new CustomEvent('send-message', { detail: { content: newContent } }));
  }
  
  private handleNewChatRequest(event: CustomEvent<{ saveCurrent: boolean }>): void {
    const { saveCurrent } = event.detail;
    const currentConversation = this.appState.getState().currentConversation;

    if (saveCurrent && currentConversation.length > 0) {
        // Create a summary (e.g., first user message text)
        const firstUserMessage = currentConversation.find(m => m.role === 'user');
        const summary = firstUserMessage?.content.find(p => p.type === 'text')?.data.substring(0, 50) || `Chat from ${new Date().toLocaleDateString()}`;
        
        const archivedChat: ArchivedChat = {
            id: `archive-${Date.now()}`,
            timestamp: Date.now(),
            summary: summary + "...",
            conversation: currentConversation,
            appStateSnapshot: { // Save relevant settings with the chat
                selectedModel: this.appState.getState().selectedModel,
                customInstructions: this.appState.getState().customInstructions
            }
        };
        this.storageService.archiveChat(archivedChat);
        console.info("Current chat archived.");
    }

    this.appState.clearConversation();
    this.appState.addMessage({
        id: `sys-${Date.now()}`,
        role: 'system',
        content: [{ type: 'text', data: "New chat started." }],
        timestamp: Date.now()
    });
    // If API key is not set, remind user
     if (!this.appState.getState().apiKey) {
      this.appState.addMessage({
        id: `sys-nokey-${Date.now()}`,
        role: 'system',
        content: [{ type: 'text', data: "Remember to set your API key in Settings if you haven't already." }],
        timestamp: Date.now()
      });
    }
    this.appState.closeConfirmModal(); // Ensure confirm modal is closed
  }

  private async handleTestApiRequest(event: CustomEvent<{ apiKey: string, model: string }>): Promise<void> {
    const { apiKey, model } = event.detail;
    console.log(`Testing API with key: ${apiKey.substring(0,5)}... and model: ${model}`);
    this.logsModal.getElement().querySelector('.logs-content')!.innerHTML += `<div>[${new Date().toISOString()}] [INFO] Starting API test for model ${model}...</div>`;

    try {
        const result = await this.geminiService.checkAPIConnection(apiKey, model);
        if (result.ok) {
            console.info("API Test Successful:", result.message);
            this.logsModal.getElement().querySelector('.logs-content')!.innerHTML += `<div>[${new Date().toISOString()}] [SUCCESS] ${result.message}</div>`;
        } else {
            console.error("API Test Failed:", result.message, result.error);
            this.logsModal.getElement().querySelector('.logs-content')!.innerHTML += `<div>[${new Date().toISOString()}] [ERROR] ${result.message} ${result.error ? JSON.stringify(result.error) : ''}</div>`;
        }
    } catch (error: any) {
        console.error("API Test Exception:", error);
        this.logsModal.getElement().querySelector('.logs-content')!.innerHTML += `<div>[${new Date().toISOString()}] [EXCEPTION] ${error.message}</div>`;
    }
  }
  
  private handleRunBasicTests(): void {
    // This is where other basic tests could be run, e.g., localStorage access, etc.
    console.log("--- Running Basic Application Tests ---");
    
    // 1. Check LocalStorage
    try {
        this.storageService.saveState(this.appState.getState()); // Try a save
        const loaded = this.storageService.loadState();
        if (loaded) {
            console.info("PASS: LocalStorage read/write test successful.");
        } else {
            console.warn("WARN: LocalStorage test - data not loaded as expected.");
        }
    } catch (e: any) {
        console.error("FAIL: LocalStorage access error.", e.message);
    }

    // 2. Check API Key presence (not validity here, that's testApiRequest)
    if (this.appState.getState().apiKey) {
        console.info("PASS: API Key is present in state.");
    } else {
        console.warn("INFO: API Key is not set in state. (This might be normal if not configured yet)");
    }
    
    // 3. Test Markdown rendering (simple test)
    try {
        const html = marked.parseInline('**Bold** `code` *italic*');
        if (html === "<strong>Bold</strong> <code>code</code> <em>italic</em>") {
            console.info("PASS: Markdown (marked.parseInline) basic test successful.");
        } else {
            console.error("FAIL: Markdown (marked.parseInline) test output mismatch.", html);
        }
    } catch (e: any) {
        console.error("FAIL: Markdown (marked.parseInline) processing error.", e.message);
    }


    console.log("--- Basic Application Tests Complete ---");
  }


  // Helper to convert App's ChatMessage array to Gemini's content array
  private buildGeminiHistory(messages: ChatMessage[]): GeminiRequestContent[] {
    const history: GeminiRequestContent[] = [];
    let currentRole: 'user' | 'model' | null = null;
    let currentParts: GeminiRequestContent['parts'] = [];

    messages.forEach(msg => {
        // Skip system messages for Gemini history, but ensure roles alternate correctly
        if (msg.role === 'system' || msg.meta?.isLoading || msg.meta?.error) return;

        const geminiRole = msg.role as 'user' | 'model'; // Cast, system already filtered

        // Gemini requires alternating user/model roles.
        // If the role is the same as the last, it's problematic.
        // This simple history builder assumes a basic alternating structure.
        // More complex logic might be needed for advanced scenarios (e.g., multiple user messages before an AI one).
        // For now, we'll just push what we have. If there's a role switch, start a new content block.
        if (currentRole !== geminiRole && currentRole !== null) {
            history.push({ role: currentRole, parts: currentParts });
            currentParts = [];
        }
        currentRole = geminiRole;

        msg.content.forEach(part => {
            if (part.type === 'text') {
                currentParts.push({ text: part.data });
            } else if (part.type === 'image' && part.mimeType && part.data) {
                // Ensure data is just the base64 string, not the full data URL
                const base64Data = part.data.split(',')[1];
                if (base64Data) {
                    currentParts.push({ inlineData: { mimeType: part.mimeType, data: base64Data } });
                }
            }
        });
    });

    // Add any remaining parts
    if (currentRole && currentParts.length > 0) {
        history.push({ role: currentRole, parts: currentParts });
    }
    return history;
  }
}
