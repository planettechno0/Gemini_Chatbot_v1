/**
 * Generates a unique ID for messages or other elements.
 * Combines timestamp with a random string.
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param unsafe The string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        console.warn('[escapeHtml] Input is not a string, returning as is:', unsafe);
        return String(unsafe); // Attempt to convert to string if not already
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Copies text to the clipboard.
 * Creates a temporary textarea element to achieve this.
 * @param text The text to copy.
 * @returns Promise<void> Resolves if copy is successful, rejects otherwise.
 */
export async function copyToClipboard(text: string): Promise<void> {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        // Fallback for older browsers or insecure contexts (e.g. http)
        console.warn('[copyToClipboard] navigator.clipboard.writeText not available. Using fallback.');
        return new Promise((resolve, reject) => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; // Make it invisible
            textArea.style.left = "-9999px";
            textArea.style.top = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    console.info('[copyToClipboard] Text copied to clipboard (fallback).');
                    resolve();
                } else {
                    console.error('[copyToClipboard] Fallback copy command failed.');
                    reject(new Error('Fallback copy command failed.'));
                }
            } catch (err) {
                console.error('[copyToClipboard] Error during fallback copy:', err);
                reject(err);
            } finally {
                document.body.removeChild(textArea);
            }
        });
    }

    try {
        await navigator.clipboard.writeText(text);
        console.info('[copyToClipboard] Text copied to clipboard via Clipboard API.');
    } catch (error) {
        console.error('[copyToClipboard] Failed to copy text using Clipboard API:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

// Debounce function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}


// Potentially add other generic helpers as identified.
