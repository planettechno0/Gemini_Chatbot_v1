// src/components.ts
import { AppState, AppStateData, ChatMessage, UserMessageContentPart } from './state';

// --- Base Component Class ---
export abstract class Component<T extends HTMLElement = HTMLElement> {
  protected element: T;
  protected appState: AppState;
  private stateUnsubscribe: (() => void) | null = null;

  constructor(appState: AppState, parentElement?: HTMLElement, tagName: keyof HTMLElementTagNameMap = 'div', id?: string, classNames?: string[]) {
    this.appState = appState;
    this.element = document.createElement(tagName) as T;
    if (id) {
      this.element.id = id;
    }
    if (classNames) {
      this.element.classList.add(...classNames);
    }
    if (parentElement) {
      parentElement.appendChild(this.element);
    }
  }

  // Mount the component to a specific selector or element
  mount(selectorOrElement: string | HTMLElement): void {
    const parent = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;

    if (parent) {
      parent.appendChild(this.element);
      this.onMount(); // Call onMount after element is in DOM
    } else {
      console.error(`Component mount target '${selectorOrElement}' not found.`);
    }
  }
  
  // Called after the component's main element is added to the DOM
  protected onMount(): void {
      // Base implementation does nothing, subclasses can override
  }

  // Abstract render method to be implemented by subclasses
  abstract render(state: AppStateData): void;

  // Subscribe to state changes and re-render
  protected subscribeToStateChanges(): void {
    if (this.stateUnsubscribe) {
        this.stateUnsubscribe(); // Unsubscribe from previous if any
    }
    this.stateUnsubscribe = this.appState.subscribe(state => this.render(state));
    this.render(this.appState.getState()); // Initial render
  }

  // Clean up resources, e.g., remove event listeners, unsubscribe
  destroy(): void {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    this.element.remove();
  }

  // Helper to create and append an element
  protected createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: { id?: string; classNames?: string[]; textContent?: string; innerHTML?: string; attributes?: Record<string, string> },
    parentElement: HTMLElement = this.element
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tagName);
    if (options?.id) el.id = options.id;
    if (options?.classNames) el.classList.add(...options.classNames);
    if (options?.textContent) el.textContent = options.textContent;
    if (options?.innerHTML) el.innerHTML = options.innerHTML;
    if (options?.attributes) {
      for (const key in options.attributes) {
        el.setAttribute(key, options.attributes[key]);
      }
    }
    parentElement.appendChild(el);
    return el;
  }

  // Helper to dispatch custom events
  protected dispatchEvent<TDetail>(eventName: string, detail?: TDetail): void {
    const event = new CustomEvent(eventName, { detail, bubbles: true, composed: true });
    this.element.dispatchEvent(event);
  }

  public getElement(): T {
    return this.element;
  }
}

// --- Header Component ---
export class Header extends Component<HTMLElement> {
  constructor(appState: AppState, parentElement: HTMLElement) {
    super(appState, parentElement, 'header', 'app-header', ['header']);
    this.render(this.appState.getState()); // Initial render, no subscription needed if static
  }

  render(state: AppStateData): void {
    this.element.innerHTML = ''; // Clear previous content

    this.createElement('h1', { textContent: 'Gemini Chatbot' }, this.element);
    const actionsContainer = this.createElement('div', { classNames: ['actions'] }, this.element);

    const newChatButton = this.createElement('button', { textContent: 'New Chat' }, actionsContainer);
    newChatButton.addEventListener('click', () => {
      this.appState.openConfirmModal('Start a new chat? Your current conversation can be saved or cleared.', () => {
        // This is a placeholder, App.ts will handle the actual logic via event or direct call
        // For now, let's assume "Save & New" is the default or only option for simplicity here
        this.dispatchEvent('new-chat-requested', { saveCurrent: true });
      });
    });
    
    const newChatClearButton = this.createElement('button', { textContent: 'Clear & New' }, actionsContainer);
    newChatClearButton.addEventListener('click', () => {
        this.appState.openConfirmModal('Clear current chat and start a new one? This cannot be undone.', () => {
            this.dispatchEvent('new-chat-requested', { saveCurrent: false });
        });
    });


    const settingsButton = this.createElement('button', { textContent: 'Settings' }, actionsContainer);
    settingsButton.addEventListener('click', () => this.appState.openSettingsModal());
  }
}

// --- Chat History Component ---
export class ChatHistory extends Component<HTMLDivElement> {
  constructor(appState: AppState, parentElement: HTMLElement) {
    super(appState, parentElement, 'div', 'chat-history', ['chat-history']);
    this.subscribeToStateChanges();
  }

  render(state: AppStateData): void {
    // Smart update: Only re-render if messages changed or loading state changed
    // For simplicity, we'll clear and re-render all messages.
    // More sophisticated diffing could be implemented for performance.
    this.element.innerHTML = ''; 

    state.currentConversation.forEach(msgData => {
      new Message(this.appState, this.element, msgData);
    });

    // Auto-scroll to the bottom
    this.element.scrollTop = this.element.scrollHeight;
  }
}

// --- Message Component ---
export class Message extends Component<HTMLDivElement> {
  private messageData: ChatMessage;

  constructor(appState: AppState, parentElement: HTMLElement, messageData: ChatMessage) {
    super(appState, parentElement, 'div', `message-${messageData.id}`, ['message-container', messageData.role]);
    this.messageData = messageData;
    this.render(this.appState.getState()); // Render once, no subscription needed per message
                                         // Parent (ChatHistory) will re-create messages if needed
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // Basic Markdown to HTML (simplified)
  private markdownToHtml(text: string): string {
    let html = this.escapeHtml(text);
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
    // Italics: *text* or _text_
    html = html.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
    // Inline code: `code`
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    // Multiline code blocks: ```lang
code
``` (lang is optional)
    html = html.replace(/```(\w*
)?([\s\S]*?)```/g, (_match, _lang, code) => {
        const languageClass = _lang ? `language-${_lang.trim()}` : '';
        return `<pre><code class="${languageClass}">${code.trim()}</code></pre>`;
    });
    // Newlines to <br> (important for pre-like behavior outside code blocks if desired)
    // html = html.replace(/
/g, '<br>'); // Consider if this is desired for all text
    return html;
  }

  render(state: AppStateData): void { // state is not used here, but required by abstract class
    this.element.innerHTML = ''; // Clear previous

    const messageDiv = this.createElement('div', { classNames: ['message', this.messageData.role] });
    
    const contentDiv = this.createElement('div', { classNames: ['message-content'] });
    messageDiv.appendChild(contentDiv);

    this.messageData.content.forEach(part => {
      if (part.type === 'text') {
        if (this.messageData.role === 'model') {
          contentDiv.innerHTML += this.markdownToHtml(part.data);
        } else {
          contentDiv.innerHTML += `<p>${this.escapeHtml(part.data)}</p>`; // User messages as plain text
        }
      } else if (part.type === 'image' && part.mimeType && part.data) {
        this.createElement('img', { 
          attributes: { src: part.data, alt: 'User uploaded image' },
          classNames: ['message-image-attachment'] // Add styling for this
        }, contentDiv);
      }
    });
    
    if (this.messageData.meta?.isLoading) {
      this.createElement('p', { textContent: 'Generating response...', classNames: ['loading-indicator'] }, contentDiv);
    }
    if (this.messageData.meta?.error) {
      this.createElement('p', { textContent: `Error: ${this.messageData.meta.error}`, classNames: ['error-message'] }, contentDiv);
    }

    const metaDiv = this.createElement('div', { classNames: ['message-meta'] });
    metaDiv.textContent = `${new Date(this.messageData.timestamp).toLocaleTimeString()}`;
    if (this.messageData.meta?.edited) {
        metaDiv.textContent += ' (edited)';
    }
    messageDiv.appendChild(metaDiv);

    // Action buttons for messages
    const actionsDiv = this.createElement('div', { classNames: ['message-actions'] });
    if (this.messageData.role === 'user') {
      const editButton = this.createElement('button', { textContent: 'Edit' }, actionsDiv);
      editButton.addEventListener('click', () => {
        this.appState.openEditModal(this.messageData);
      });
    } else if (this.messageData.role === 'model' && !this.messageData.meta?.isLoading) {
      const copyButton = this.createElement('button', { textContent: 'Copy' }, actionsDiv);
      copyButton.addEventListener('click', () => {
        const textToCopy = this.messageData.content.filter(p => p.type === 'text').map(p => p.data).join('
');
        navigator.clipboard.writeText(textToCopy)
          .then(() => console.log('Copied to clipboard'))
          .catch(err => console.error('Failed to copy:', err));
      });

      // Check if this is the last AI message to show Regenerate button
      const conversation = this.appState.getState().currentConversation;
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.id === this.messageData.id) {
        const regenerateButton = this.createElement('button', { textContent: 'Regenerate' }, actionsDiv);
        regenerateButton.addEventListener('click', () => {
          this.dispatchEvent('regenerate-response', { messageId: this.messageData.id });
        });
      }
    }
    if (actionsDiv.hasChildNodes()) {
        messageDiv.appendChild(actionsDiv);
    }
  }
}

// --- Chat Input Component ---
export class ChatInput extends Component<HTMLDivElement> {
  private textarea!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private fileInput!: HTMLInputElement;
  private imagePreviewContainer!: HTMLDivElement;
  private attachedImage: { name: string, type: string, data: string } | null = null;

  constructor(appState: AppState, parentElement: HTMLElement) {
    super(appState, parentElement, 'div', 'chat-input', ['chat-input']);
    this.render(this.appState.getState()); // Initial render
    this.subscribeToStateChanges(); // To enable/disable send button based on appState.isSending
  }

  render(state: AppStateData): void {
    if (!this.textarea) { // Only build DOM on first render
        this.element.innerHTML = ''; // Clear previous

        this.imagePreviewContainer = this.createElement('div', { classNames: ['image-preview-container', 'hidden'] });
        
        this.textarea = this.createElement('textarea', {
            attributes: { placeholder: 'Type your message or attach an image...' }
        }, this.element) as HTMLTextAreaElement;
        this.textarea.addEventListener('input', this.autoGrowTextarea.bind(this));
        this.textarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        const actionsContainer = this.createElement('div', {classNames: ['input-actions']});

        // File input for image attachment
        this.fileInput = this.createElement('input', {
            attributes: { type: 'file', accept: 'image/*' },
            classNames: ['hidden'] // Hidden, triggered by a button
        }, this.element) as HTMLInputElement; // Keep it in the DOM but hidden initially
        
        const attachButton = this.createElement('button', { textContent: 'Attach Image' }, actionsContainer) as HTMLButtonElement;
        attachButton.type = 'button';
        attachButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', this.handleImageAttachment.bind(this));

        this.sendButton = this.createElement('button', { textContent: 'Send' }, actionsContainer) as HTMLButtonElement;
        this.sendButton.addEventListener('click', this.sendMessage.bind(this));
        
        this.element.appendChild(actionsContainer);
    }

    // Update send button state based on app state (e.g., isSending)
    this.sendButton.disabled = state.isSending || (!this.textarea.value.trim() && !this.attachedImage);
    this.textarea.disabled = state.isSending;
  }

  private autoGrowTextarea(): void {
    this.textarea.style.height = 'auto'; // Reset height
    this.textarea.style.height = `${this.textarea.scrollHeight}px`; // Set to scroll height
    this.updateSendButtonState();
  }
  
  private updateSendButtonState(): void {
    if (this.sendButton) {
        this.sendButton.disabled = this.appState.getState().isSending || (!this.textarea.value.trim() && !this.attachedImage);
    }
  }

  private handleImageAttachment(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.attachedImage = {
          name: file.name,
          type: file.type,
          data: e.target?.result as string,
        };
        this.renderImagePreview();
        this.updateSendButtonState();
      };
      reader.readAsDataURL(file);
    }
  }

  private renderImagePreview(): void {
    this.imagePreviewContainer.innerHTML = '';
    if (this.attachedImage) {
      new ImagePreview(this.appState, this.imagePreviewContainer, this.attachedImage.data, () => {
        this.removeImageAttachment();
      });
      this.imagePreviewContainer.classList.remove('hidden');
    } else {
      this.imagePreviewContainer.classList.add('hidden');
    }
  }

  private removeImageAttachment(): void {
    this.attachedImage = null;
    this.fileInput.value = ''; // Clear the file input
    this.renderImagePreview();
    this.updateSendButtonState();
  }

  private sendMessage(): void {
    const text = this.textarea.value.trim();
    if (!text && !this.attachedImage) return;
    if (this.appState.getState().isSending) return;

    const contentParts: UserMessageContentPart[] = [];
    if (text) {
      contentParts.push({ type: 'text', data: text });
    }
    if (this.attachedImage) {
      contentParts.push({ type: 'image', data: this.attachedImage.data, mimeType: this.attachedImage.type });
    }

    this.dispatchEvent('send-message', { content: contentParts });
    this.textarea.value = '';
    this.removeImageAttachment();
    this.autoGrowTextarea(); // Reset textarea height
  }
}

// --- Image Preview Component ---
export class ImagePreview extends Component<HTMLDivElement> {
  constructor(appState: AppState, parentElement: HTMLElement, private imageUrl: string, private onRemove: () => void) {
    super(appState, parentElement, 'div', undefined, ['image-preview-item']); // No subscription needed
    this.render(this.appState.getState());
  }

  render(state: AppStateData): void { // state not used
    this.element.innerHTML = '';
    this.createElement('img', { classNames: ['image-preview'], attributes: { src: this.imageUrl, alt: 'Preview' } });
    const removeBtn = this.createElement('button', { textContent: '×', classNames: ['remove-image-btn'] });
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRemove();
        this.destroy(); // Remove the preview component itself
    });
  }
}

// --- Modal Base Class ---
export abstract class Modal<ModalState = any> extends Component<HTMLDivElement> {
  protected modalContent!: HTMLDivElement;
  protected modalTitle: string;

  constructor(appState: AppState, id: string, title: string, classNames: string[] = []) {
    // Modals are not directly appended to a parent on construction,
    // they are typically appended to document.body when shown.
    super(appState, undefined, 'div', id, ['modal-overlay', 'hidden', ...classNames]);
    this.modalTitle = title;
    this.buildModalStructure();
    this.subscribeToStateChanges(); // To show/hide based on global state
  }

  private buildModalStructure(): void {
    const modalDialog = this.createElement('div', { classNames: ['modal'] }, this.element);
    modalDialog.addEventListener('click', e => e.stopPropagation()); // Prevent clicks inside modal from closing it

    const header = this.createElement('div', { classNames: ['modal-header'] }, modalDialog);
    this.createElement('h2', { textContent: this.modalTitle }, header);
    const closeButton = this.createElement('button', { textContent: '×', classNames: ['modal-close-btn'] }, header);
    closeButton.addEventListener('click', () => this.close());

    this.modalContent = this.createElement('div', { classNames: ['modal-content'] }, modalDialog);
    
    // Footer will be populated by subclasses if needed
  }

  // Subclasses implement this to populate modalContent and footer
  protected abstract renderModalContent(state: AppStateData, modalSpecificState?: ModalState): void;
  
  // This render method handles showing/hiding the modal overlay
  abstract render(state: AppStateData): void; // Subclasses must implement to decide when to show/hide

  protected show(): void {
    if (!this.element.parentNode) { // Append to body if not already
        document.body.appendChild(this.element);
    }
    this.element.classList.remove('hidden');
    // Focus first focusable element in modal content (optional, for accessibility)
    const focusable = this.modalContent.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }

  protected hide(): void {
    this.element.classList.add('hidden');
  }

  // Method to be called to initiate closing sequence (e.g., by close button or AppState change)
  abstract close(): void;
}

// --- Settings Modal ---
export class SettingsModal extends Modal {
  private apiKeyInput!: HTMLInputElement;
  private modelSelect!: HTMLSelectElement;
  private instructionsTextarea!: HTMLTextAreaElement;
  private logsButton!: HTMLButtonElement;
  private testApiButton!: HTMLButtonElement;

  // Supported models - could be fetched or configurable
  private readonly SUPPORTED_MODELS = [
      "gemini-1.5-flash-latest",
      "gemini-pro", // Older but widely available
      // Add other models as needed
  ];


  constructor(appState: AppState) {
    super(appState, 'settings-modal', 'Settings');
    this.renderModalContent(this.appState.getState()); // Initial content render
    // Render method (show/hide) is handled by subscribeToStateChanges in Modal base
  }

  protected renderModalContent(state: AppStateData): void {
    this.modalContent.innerHTML = ''; // Clear previous

    // API Key
    let group = this.createElement('div', { classNames: ['form-group'] }, this.modalContent);
    this.createElement('label', { textContent: 'Gemini API Key', attributes: { for: 'apiKey' } }, group);
    this.apiKeyInput = this.createElement('input', {
      id: 'apiKey',
      attributes: { type: 'password', value: state.apiKey || '' }
    }, group) as HTMLInputElement;

    // Model Selection
    group = this.createElement('div', { classNames: ['form-group'] }, this.modalContent);
    this.createElement('label', { textContent: 'AI Model', attributes: { for: 'modelSelect' } }, group);
    this.modelSelect = this.createElement('select', { id: 'modelSelect' }, group) as HTMLSelectElement;
    this.SUPPORTED_MODELS.forEach(modelName => {
      const option = this.createElement('option', {
        textContent: modelName,
        attributes: { value: modelName }
      }, this.modelSelect) as HTMLOptionElement;
      if (modelName === state.selectedModel) {
        option.selected = true;
      }
    });
    
    // Custom Instructions
    group = this.createElement('div', { classNames: ['form-group'] }, this.modalContent);
    this.createElement('label', { textContent: 'Custom Instructions (System Prompt)', attributes: { for: 'customInstructions' } }, group);
    this.instructionsTextarea = this.createElement('textarea', {
      id: 'customInstructions',
      textContent: state.customInstructions
    }, group) as HTMLTextAreaElement;

    // Modal Footer for actions
    const footer = this.createElement('div', { classNames: ['modal-footer'] }, this.modalContent.parentElement!); // Attach to modalDialog

    this.logsButton = this.createElement('button', { textContent: 'View Logs', classNames: ['secondary'] }, footer) as HTMLButtonElement;
    this.logsButton.addEventListener('click', () => this.appState.openLogsModal());
    
    this.testApiButton = this.createElement('button', { textContent: 'Test API', classNames: ['secondary'] }, footer) as HTMLButtonElement;
    this.testApiButton.addEventListener('click', () => {
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            this.dispatchEvent('test-api-requested', { apiKey, model: this.modelSelect.value });
        } else {
            alert("Please enter an API key to test.");
        }
    });

    const saveButton = this.createElement('button', { textContent: 'Save & Close' }, footer);
    saveButton.addEventListener('click', () => {
      this.appState.setApiKey(this.apiKeyInput.value.trim());
      this.appState.setSelectedModel(this.modelSelect.value);
      this.appState.setCustomInstructions(this.instructionsTextarea.value.trim());
      this.close();
    });
  }

  render(state: AppStateData): void { // Controls visibility
    if (state.isSettingsModalOpen) {
      // Refresh content in case underlying state changed while modal was closed
      // This is important if other parts of the app can change API key, model, etc.
      this.apiKeyInput.value = state.apiKey || '';
      this.modelSelect.value = state.selectedModel;
      this.instructionsTextarea.value = state.customInstructions;
      this.show();
    } else {
      this.hide();
    }
  }
  
  close(): void {
    this.appState.closeSettingsModal();
  }
}

// --- Logs Modal ---
export class LogsModal extends Modal {
  private logsContentDiv!: HTMLDivElement;
  private originalConsoleLog: (...data: any[]) => void;
  private originalConsoleError: (...data: any[]) => void;
  private originalConsoleWarn: (...data: any[]) => void;
  private originalConsoleInfo: (...data: any[]) => void;

  constructor(appState: AppState) {
    super(appState, 'logs-modal', 'Application Logs');
    this.renderModalContent(this.appState.getState());
    
    // Capture console messages
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.originalConsoleInfo = console.info.bind(console);

    console.log = (...args) => this.logMessage('LOG', ...args);
    console.error = (...args) => this.logMessage('ERROR', ...args);
    console.warn = (...args) => this.logMessage('WARN', ...args);
    console.info = (...args) => this.logMessage('INFO', ...args);

    window.addEventListener('error', (event) => {
        this.logMessage('EXCEPTION', event.message, event.filename, event.lineno, event.colno, event.error);
    });
    window.addEventListener('unhandledrejection', (event) => {
        this.logMessage('UNHANDLED_REJECTION', event.reason);
    });
  }

  private logMessage(level: string, ...args: any[]): void {
    this.originalConsoleLog(...args); // Still log to actual console

    if (this.logsContentDiv && document.body.contains(this.logsContentDiv)) { // Check if modal is still in DOM
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return arg.toString();
          }
        }
        return String(arg);
      }).join(' ');

      const logEntry = this.createElement('div', { classNames: [`log-entry`, `log-${level.toLowerCase()}`] }, this.logsContentDiv);
      logEntry.textContent = `[${new Date().toISOString()}] [${level}] ${message}`;
      this.logsContentDiv.scrollTop = this.logsContentDiv.scrollHeight;
    }
  }

  protected renderModalContent(state: AppStateData): void { // state not directly used for content structure
    this.modalContent.innerHTML = ''; // Clear previous
    this.logsContentDiv = this.createElement('div', { classNames: ['logs-content'] }, this.modalContent);
    this.logMessage("INFO", "Logs modal initialized. Captured logs will appear here.");


    const footer = this.createElement('div', { classNames: ['modal-footer'] }, this.modalContent.parentElement!);

    const runTestsButton = this.createElement('button', { textContent: 'Run Basic Tests', classNames: ['secondary'] }, footer);
    runTestsButton.addEventListener('click', () => {
        this.logMessage("INFO", "--- Running Basic Tests ---");
        this.dispatchEvent('run-basic-tests'); // App.ts will listen for this
    });

    const copyLogsButton = this.createElement('button', { textContent: 'Copy Logs' }, footer);
    copyLogsButton.addEventListener('click', () => {
      navigator.clipboard.writeText(this.logsContentDiv.innerText)
        .then(() => this.logMessage("INFO",'Logs copied to clipboard.'))
        .catch(err => this.logMessage("ERROR",'Failed to copy logs:', err));
    });
  }

  render(state: AppStateData): void {
    if (state.isLogsModalOpen) {
      this.show();
    } else {
      this.hide();
    }
  }
  
  close(): void {
    this.appState.closeLogsModal();
  }

  // Restore original console functions when modal/app is destroyed (optional, if needed)
  destroy(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.info = this.originalConsoleInfo;
    // Remove global error listeners if added by this instance specifically
    super.destroy();
  }
}

// --- Confirmation Modal ---
export class ConfirmModal extends Modal<{ message: string, onConfirm: () => void }> {
  private messageElement!: HTMLParagraphElement;
  private confirmAction: (() => void) | null = null;

  constructor(appState: AppState) {
    super(appState, 'confirm-modal', 'Confirm Action');
    // Content is dynamic, so renderModalContent will be called by render when shown
  }
  
  protected renderModalContent(state: AppStateData): void {
    this.modalContent.innerHTML = ''; // Clear previous

    this.messageElement = this.createElement('p', {textContent: state.confirmModalMessage}, this.modalContent);

    const footer = this.createElement('div', { classNames: ['modal-footer'] }, this.modalContent.parentElement!);
    
    const cancelButton = this.createElement('button', { textContent: 'Cancel', classNames: ['secondary'] }, footer);
    cancelButton.addEventListener('click', () => this.close());

    const confirmButton = this.createElement('button', { textContent: 'Confirm' }, footer);
    confirmButton.addEventListener('click', () => {
      if (this.confirmAction) {
        this.confirmAction();
      }
      this.close();
    });
  }

  render(state: AppStateData): void {
    if (state.isConfirmModalOpen) {
      this.confirmAction = state.confirmModalAction; // Capture the action
      // It's crucial to update the content *before* showing if it's dynamic like this
      if(this.messageElement) this.messageElement.textContent = state.confirmModalMessage;
      else this.renderModalContent(state); // Build content if not already built
      this.show();
    } else {
      this.hide();
    }
  }
  
  close(): void {
    this.appState.closeConfirmModal();
  }
}

// --- Edit Message Modal ---
export class EditModal extends Modal {
  private textarea!: HTMLTextAreaElement;
  private editingMessage: ChatMessage | null = null;
  // We might not need image editing for simplicity, focusing on text.
  // If image editing was required, it would add complexity here.

  constructor(appState: AppState) {
    super(appState, 'edit-modal', 'Edit Message');
  }

  protected renderModalContent(state: AppStateData): void {
    this.modalContent.innerHTML = ''; // Clear previous

    this.editingMessage = state.editingMessage; // Capture the message being edited

    const textContent = this.editingMessage?.content.find(p => p.type === 'text')?.data || '';
    this.textarea = this.createElement('textarea', { textContent }, this.modalContent) as HTMLTextAreaElement;
    // Auto-grow similar to chat input
    this.textarea.addEventListener('input', () => {
        this.textarea.style.height = 'auto';
        this.textarea.style.height = `${this.textarea.scrollHeight}px`;
    });
    // Set initial height
    setTimeout(() => { // Needs a tick for scrollHeight to be correct
        this.textarea.style.height = 'auto';
        this.textarea.style.height = `${this.textarea.scrollHeight}px`;
    }, 0);


    const footer = this.createElement('div', { classNames: ['modal-footer'] }, this.modalContent.parentElement!);
    
    const cancelButton = this.createElement('button', { textContent: 'Cancel', classNames: ['secondary'] }, footer);
    cancelButton.addEventListener('click', () => this.close());

    const saveButton = this.createElement('button', { textContent: 'Save Changes' }, footer);
    saveButton.addEventListener('click', () => {
      if (this.editingMessage) {
        const newText = this.textarea.value.trim();
        // For simplicity, we assume only text part is editable.
        // If there are multiple text parts or image parts, logic would be more complex.
        const newContent: UserMessageContentPart[] = [
            { type: 'text', data: newText }
            // Preserve other parts if any, e.g., image (though this example doesn't handle editing images)
        ];
         if (newText) { // Only dispatch if there's new text
            this.dispatchEvent('edit-message-request', {
                messageId: this.editingMessage.id,
                newContent: newContent,
            });
        }
      }
      this.close();
    });
  }

  render(state: AppStateData): void {
    if (state.isEditModalOpen && state.editingMessage) {
      if (!this.textarea || this.editingMessage?.id !== state.editingMessage.id) {
        // If textarea not created OR if the message to edit has changed, rebuild content
        this.renderModalContent(state);
      } else {
        // Just update textarea value if modal was already open for the same message (less common)
        const textContent = state.editingMessage.content.find(p => p.type === 'text')?.data || '';
        this.textarea.value = textContent;
      }
      this.show();
    } else {
      this.hide();
    }
  }
  
  close(): void {
    this.appState.closeEditModal();
  }
}
