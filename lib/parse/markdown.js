'use strict';

/**
 * parse/markdown.js — the markdown → HTML converter.
 *
 * Hand-rolled and deliberately small. It covers paragraphs, headings, bold,
 * italic, links, inline code, fenced code blocks, blockquotes, horizontal rules
 * and unordered lists — which is the entire vocabulary the site's content
 * actually uses.
 *
 * It is a line-oriented scanner rather than a real parser: it walks the source
 * top to bottom deciding what each line starts, and `inlineFormat` handles the
 * span-level markup within a line. That means it has no concept of nesting
 * beyond what the line shape implies, which is a limitation worth knowing about
 * before reaching for something clever in a content file.
 */

function parseMarkdown(md) {
  const lines = md.split('\n');
  const output = [];
  let inBlockquote = false;
  let inList = false;

  function htmlEscape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fenced code block. Opening ``` (optionally followed by a language
    // tag) starts a block; everything up to the closing ``` is captured
    // verbatim and HTML-escaped, then emitted inside <pre><code>. No
    // syntax highlighting — just the mono + tinted background CSS.
    const fenceMatch = line.match(/^```\s*([\w-]*)\s*$/);
    if (fenceMatch) {
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      if (inList) { output.push('</ul>'); inList = false; }
      const lang = fenceMatch[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      const langAttr = lang ? ' class="language-' + lang + '"' : '';
      output.push('<pre><code' + langAttr + '>' + htmlEscape(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // Blank line, close open blocks
    if (line.trim() === '') {
      if (inBlockquote) { output.push('</blockquote>'); inBlockquote = false; }
      if (inList) { output.push('</ul>'); inList = false; }
      continue;
    }

    // Headings, slugify to an id so TOC anchors work
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text.toLowerCase()
        .replace(/<[^>]+>/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      output.push('<h' + level + ' id="' + id + '">' + inlineFormat(text) + '</h' + level + '>');
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      output.push('<hr>');
      continue;
    }

    // Raw HTML / JSX component tag at the start of a line, emit as-is so
    // block-level elements (Pullquote, Dropcap, MarginaliaPin, manual <div>)
    // are not wrapped in <p>. Matches lines that begin with `<TagName` where
    // TagName starts with a letter.
    if (/^\s*<[A-Za-z][\w-]*/.test(line)) {
      output.push(line);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (!inBlockquote) { output.push('<blockquote>'); inBlockquote = true; }
      output.push('<p>' + inlineFormat(line.slice(2)) + '</p>');
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { output.push('<ul>'); inList = true; }
      output.push('<li>' + inlineFormat(line.replace(/^[-*]\s+/, '')) + '</li>');
      continue;
    }

    // Paragraph
    output.push('<p>' + inlineFormat(line) + '</p>');
  }

  if (inBlockquote) output.push('</blockquote>');
  if (inList) output.push('</ul>');

  return output.join('\n');
}

function inlineFormat(text) {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  // Links
  text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  return text;
}


module.exports = { parseMarkdown, inlineFormat };
