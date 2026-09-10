'use strict';

/**
 * parse/frontmatter.js — the YAML-lite frontmatter parser.
 *
 * Content files open with a `---` fenced block of key/value pairs. This is not a
 * real YAML parser and doesn't try to be; it handles exactly the shapes the
 * site's content uses:
 *
 *   - plain scalars           title: Something
 *   - quoted scalars          note: "Something, with a comma"
 *   - lists of objects        items:
 *                               - label: A
 *                                 href: /a/
 *
 * Anything more exotic would need a dependency, and the whole point of this
 * project is that it has none.
 */

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = raw.slice(match[0].length).trim();
  const data = {};
  let currentKey = null;
  let currentArray = null;
  let currentObj = null;

  const lines = yamlBlock.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Array item: "  - key: val"
    const arrayItemMatch = line.match(/^  - (\w+):\s*"?(.+?)"?\s*$/);
    if (arrayItemMatch && currentArray) {
      // Start new object in array
      if (currentObj) currentArray.push(currentObj);
      currentObj = {};
      currentObj[arrayItemMatch[1]] = stripQuotes(arrayItemMatch[2]);
      continue;
    }

    // Continuation of array object: "    key: val"
    const arrayContMatch = line.match(/^    (\w+):\s*"?(.+?)"?\s*$/);
    if (arrayContMatch && currentObj) {
      currentObj[arrayContMatch[1]] = stripQuotes(arrayContMatch[2]);
      continue;
    }

    // Top-level key with array value (next lines are array items)
    const arrayKeyMatch = line.match(/^(\w+):\s*$/);
    if (arrayKeyMatch) {
      // Flush previous array
      if (currentArray && currentKey) {
        if (currentObj) currentArray.push(currentObj);
        data[currentKey] = currentArray;
      }
      currentKey = arrayKeyMatch[1];
      currentArray = [];
      currentObj = null;
      continue;
    }

    // Top-level key: value
    const kvMatch = line.match(/^(\w+):\s*"?(.+?)"?\s*$/);
    if (kvMatch) {
      // Flush previous array
      if (currentArray && currentKey) {
        if (currentObj) currentArray.push(currentObj);
        data[currentKey] = currentArray;
        currentArray = null;
        currentObj = null;
        currentKey = null;
      }
      data[kvMatch[1]] = stripQuotes(kvMatch[2]);
      continue;
    }
  }

  // Flush trailing array
  if (currentArray && currentKey) {
    if (currentObj) currentArray.push(currentObj);
    data[currentKey] = currentArray;
  }

  return { data, content };
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}


module.exports = { parseFrontmatter, stripQuotes };
