/*
 * Shared defaults for the layout engine. Loaded first; every other content
 * script reads from globalThis.ReaderRestore.
 */
(() => {
  'use strict';

  const RR = (globalThis.ReaderRestore = globalThis.ReaderRestore || {});

  RR.config = {
    // Log decisions to the page console (filter by "[ReaderRestore]").
    debug: false,

    // Ad slots. Mirror of cosmetic.css; these are what the engine treats as
    // "dead" space to reclaim.
    AD_SELECTORS: [
      '.ad', '.ads', '.ad-slot', '.ad-unit', '.ad-wrapper', '.ad-container',
      '.ad-banner', '.ad-placeholder', '.adsbygoogle', '.advertisement',
      '.sponsored-box', '.sponsored-content', '.dfp-ad', '.gpt-ad', '.native-ad',
      '.taboola', '.outbrain', '.OUTBRAIN',
      '[id^="div-gpt-ad"]', '[id^="google_ads_iframe"]', '[id^="taboola-"]',
      '[id^="ad-slot"]', '[data-ad-slot]', '[data-ad-unit]',
      '[data-google-query-id]', '[aria-label="Advertisement"]',
      'ins.adsbygoogle[data-ad-status="unfilled"]',
      'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
    ],

    // Candidates for the main article body, most specific first.
    ARTICLE_SELECTORS: [
      '[itemprop="articleBody"]',
      '.article-body', '.article__body', '.articleBody', '.story-body',
      '.entry-content', '.post-content', '.article-content',
      'article',
      '[role="main"] article',
      'main',
    ],

    // Text left behind in an empty slot that should still count as empty.
    PLACEHOLDER_TEXT: /^(advertisement|advert|ad|ads|sponsored|story continues below( advertisement)?|continue reading below)$/i,

    // How far up from an ad we'll walk looking for the rail / layout wrapper.
    MAX_ANCESTOR_DEPTH: 12,

    // Width the article branch is expanded to. Set maxWidth to e.g. '80ch'
    // if full-width lines get too long to read comfortably. pageWrappers also
    // lifts max-width on the page containers above the article's grid/row.
    EXPAND: { width: '100%', maxWidth: 'none', pageWrappers: true },

    // Debounce for MutationObserver bursts, in ms.
    MUTATION_DEBOUNCE_MS: 200,

    // Extra passes for ads that fail or collapse late (ms after start).
    LATE_PASSES_MS: [1500, 4000, 10000],
  };
})();
