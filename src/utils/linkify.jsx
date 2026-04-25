/**
 * Utility to render text with clickable URL hyperlinks
 */

// URL regex pattern - matches http, https, and www URLs
const URL_REGEX = /(\bhttps?:\/\/[^\s<>[\]()]+|\bwww\.[^\s<>[\]()]+)/gi;

/**
 * Convert URLs in text to clickable links (React component)
 * @param {string} text - The text to process
 * @returns {React.ReactNode[]} Array of text and link elements
 */
export function linkifyText(text) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the URL as a link
    let url = match[0];
    // Add protocol if missing (for www. URLs)
    const href = url.startsWith('www.') ? `https://${url}` : url;

    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Convert URLs in text to HTML anchor tags (for dangerouslySetInnerHTML)
 * @param {string} text - The text to process
 * @returns {string} HTML string with anchor tags
 */
export function linkifyHTML(text) {
  if (!text) return '';

  return text.replace(URL_REGEX, (url) => {
    const href = url.startsWith('www.') ? `https://${url}` : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline" onclick="event.stopPropagation()">${url}</a>`;
  });
}

/**
 * React component that renders text with clickable links
 */
export function LinkifiedText({ text, className = '' }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex}>
          {linkifyText(line)}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      ))}
    </span>
  );
}
