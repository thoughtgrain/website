'use strict';

/**
 * pages/writing.js — /essays/ and /studies/.
 *
 * Both routes are the same shape (index + tag pages + readers), so this module
 * is mostly copy: the machinery lives in render/writing.js. The `kind` field in
 * an article's frontmatter is what routes it here rather than to /build/.
 */

const { buildWritingIndex, buildWritingReader } = require('../render/writing');

module.exports = {
  id: 'writing',
  label: '/essays/ and /studies/, with tag pages and readers',

  run: function (ctx) {
    const { essays, studies } = ctx.content;

    buildWritingIndex(ctx, 'essays', essays, {
      kicker: 'Essays',
      heading: 'Essays',
      dek: 'Long-form writing. Published slowly, revised often. The ones I’d still send to a friend.',
      empty: 'No essays yet.',
      kindLabel: 'essays',
    });
    buildWritingReader(ctx, 'essays', essays, { backLabel: 'All essays' });

    buildWritingIndex(ctx, 'studies', studies, {
      kicker: 'Studies',
      heading: 'Studies',
      dek: 'Short, investigated pieces. Each one answers a specific question, usually with a small data set and a stronger opinion than the data deserves.',
      empty: 'No studies yet.',
      kindLabel: 'studies',
    });
    buildWritingReader(ctx, 'studies', studies, { backLabel: 'All studies' });
  },
};
