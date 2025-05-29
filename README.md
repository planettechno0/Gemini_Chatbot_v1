# Gemini Chatbot

This is a feature-rich web application that serves as a chat client for the Google Gemini API. It's built with TypeScript and Vite, adhering to a maximum of 10 source files.

## Features

-   Multi-turn conversation context
-   Markdown rendering for AI responses
-   Responsive design
-   Image attachments with previews
-   Edit user messages (truncates and resubmits)
-   Regenerate AI response
-   Copy AI response to clipboard
-   Settings modal for API Key, Model selection, and Custom Instructions
-   Persistent state for settings and current conversation (`localStorage`)
-   New chat options: "Clear & New" or "Save & New" (archives to `localStorage`)
-   Debugging logs window with API tests

## Setup and Usage

1.  **Get a Gemini API Key:**
    *   Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to obtain your API key.

2.  **Clone the repository (or create the files as per the structure).**

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

5.  **Configure the application:**
    *   Open the settings modal in the app.
    *   Enter your Gemini API Key.
    *   Optionally, select a model and add custom instructions.

```
