export interface MessageData {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  isError?: boolean;
}

export interface AppStateData {
  apiKey: string;
  selectedModel: string;
  customInstructions: string;
  conversation: MessageData[];
  // Potentially add other app-wide state properties here later
  // e.g., isLoading, currentTheme, etc.
}

export interface ArchivedChat {
  id: string;
  name: string;
  timestamp: string; // ISO string format recommended
  model: string;
  customInstructions: string;
  conversation: MessageData[];
}

// You can also add other shared types or enums here if needed.
// For example:
// export enum LogLevel {
//   INFO = 'info',
//   WARN = 'warn',
//   ERROR = 'error',
// }
//
// export interface LogEntry {
//   timestamp: string;
//   type: LogLevel;
//   message: string;
// }
