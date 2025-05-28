import { escapeHtml } from './helpers.js';

/**
 * Converts a basic Markdown string to HTML.
 * Supports:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 * - Inline code: `code`
 * - Code blocks: ```lang
code
``` (lang is optional)
 * - Unordered lists: - item or * item or + item
 * - Ordered lists: 1. item
 * - Basic links: [text](url) (simple implementation)
 * - Blockquotes: > quote
 *
 * Note: This is a simplified parser. For complex Markdown, a library like Marked.js or Showdown.js would be better.
 * @param markdownText The Markdown string to convert.
 * @returns The HTML representation of the Markdown.
 */
export function basicMarkdownToHtml(markdownText: string): string {
    if (typeof markdownText !== 'string' || markdownText === null || markdownText === undefined) {
        return ''; // Return empty string for non-string or null/undefined input
    }

    let html = escapeHtml(markdownText);

    // Block elements first

    // Code blocks (```lang
code
```) - ensure it handles Windows and Unix line endings
    html = html.replace(/```(\w*)?
([\s\S]*?)?
```/g, (match, lang, code) => {
        const languageClass = lang ? `language-${lang}` : 'language-plaintext';
        // Code needs to be escaped again *after* this block is identified,
        // because our initial escapeHtml would have turned '>' in code to '&gt;'
        // but here we want the raw code content to pass to a syntax highlighter or pre tag.
        // However, for basic display, the initial escapeHtml is sufficient.
        // If using a client-side highlighter that expects unescaped content, adjust here.
        return `<pre><code class="${languageClass}">${code.trim()}</code></pre>`;
    });
    
    // Blockquotes (> quote)
    html = html.replace(/^&gt;\s+(.*)/gm, (match, content) => {
        return `<blockquote>${content.replace(/<br>/g, '
').trim()}</blockquote>`; // Convert <br> back to 
 for processing, then trim
    });
    // Need to re-process blockquotes if they contain line breaks that became <br>
    // This is tricky with regex alone. A line-by-line parser would be more robust.
    // For now, this handles single-line blockquotes well. Multi-line will be a single blockquote.

    // Unordered lists (- item, * item, + item)
    // Normalize list markers to '-'
    html = html.replace(/^[\s]*[\-*+]\s+(.*)/gm, (match, item) => `<li>${item.trim()}</li>`);
    html = html.replace(/^(<li>.*<\/li>\s*)+/gm, (match) => `<ul>
${match.trim()}
</ul>
`);
    
    // Ordered lists (1. item)
    html = html.replace(/^[\s]*\d+\.\s+(.*)/gm, (match, item) => `<li>${item.trim()}</li>`);
    html = html.replace(/^(<li>.*<\/li>\s*)+/gm, (match, p1, offset, string) => {
         // Check if previous significant content was already part of an OL/UL to avoid re-wrapping.
        const preContent = string.substring(0, offset).trim();
        if (preContent.endsWith('</ol>') || preContent.endsWith('</ul>')) {
            return match; // Already wrapped or should be separate
        }
        // Heuristic: if it starts with <li> and wasn't preceded by an ol/ul, wrap it in <ol>
        if(match.startsWith("<li>")) return `<ol>
${match.trim()}
</ol>
`;
        return match;
    });

    // Clean up adjacent list tags that might have been created by separate paragraph-like list items
    html = html.replace(/<\/ul>
\s*<ul>/g, '');
    html = html.replace(/<\/ol>
\s*<ol>/g, '');


    // Inline elements

    // Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
    // Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
    // Strikethrough (~~text~~)
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Inline code (`code`)
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    // Basic links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        // Basic validation for URL to prevent XSS if escapeHtml was bypassed or insufficient
        if (url.startsWith('javascript:')) {
            return `[${text}](invalid_url)`;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Paragraphs (handle newlines that are not part of other block elements)
    // This is a very basic paragraph handling. It wraps non-list, non-pre, non-blockquote lines with <p>
    // More robust would be to split by 

 then process each block.
    html = html.split(/?
/).map(line => {
        line = line.trim();
        if (line.length === 0) return '';
        if (line.startsWith('<pre>') || line.startsWith('<ul>') || line.startsWith('<ol>') || line.startsWith('<blockquote>') || line.startsWith('<li>')) {
            return line; // Already handled block elements
        }
        if (line.endsWith('</pre>') || line.endsWith('</ul>') || line.endsWith('</ol>') || line.endsWith('</blockquote>')) {
            return line;
        }
        // if (line.match(/^<h[1-6]>/)) return line; // Example if you add headers
        return `<p>${line}</p>`;
    }).join('');
    
    // Replace <br> tags that might be inside <pre><code> blocks if not handled correctly
    // This is a bit of a hack; ideally, code inside pre shouldn't be processed for <br> by earlier steps.
    html = html.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, codeContent) => {
        return `<pre><code class="${match.match(/class="([^"]*)"/)?.[1] || ''}">${codeContent.replace(/<br\s*\/?>/gi, '
')}</code></pre>`;
    });
    
    // Remove <p> tags around block elements like <ul>, <ol>, <pre>, <blockquote>
    html = html.replace(/<p>\s*(<(ul|ol|pre|blockquote|h[1-6])[^>]*>[\s\S]*?<\/>)\s*<\/p>/gi, '$1');
    // Remove empty <p> tags
    html = html.replace(/<p>\s*<\/p>/gi, '');
    // Convert actual newlines (that weren't part of block structures like lists or code) to <br>
    // This should happen after paragraph wrapping for content within paragraphs.
    // The current paragraph logic doesn't quite allow for this well.
    // For now, the original logic of replacing 
 with <br> at the end for non-block text is simpler:
    // html = html.replace(/
/g, '<br>'); // This was in original, but problematic.

    // Instead of the above 
 to <br>, rely on the paragraph logic or CSS for line breaks.
    // If <p> tags are used, they handle block spacing. For inline text needing forced breaks,
    // it's usually better to have explicit <br> or rely on CSS white-space properties.

    return html.trim();
}
