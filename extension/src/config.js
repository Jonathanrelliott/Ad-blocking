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
      'amp-ad', 'amp-embed', 'a[href*="doubleclick.net"]', 'a[href*="/aclk?"]',
      'a[href*="googleadservices.com"]',
      // Set by src/detect.js on static banners it recognises.
      '[data-rr-ad]',
    ],

    // Ad-serving hosts. A static image, iframe or link pointing here is an ad.
    // rules.json blocks the same list at the network level.
    AD_HOSTS: [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'adnxs.com', 'amazon-adsystem.com', 'taboola.com', 'outbrain.com',
      'criteo.com', 'criteo.net', 'pubmatic.com', 'rubiconproject.com',
      'openx.net', 'adsrvr.org', 'moatads.com', 'media.net', 'teads.tv',
      'smartadserver.com', 'adform.net', 'casalemedia.com', '3lift.com',
      'revcontent.com', 'mgid.com', 'zergnet.com', 'sharethrough.com',
      'yieldmo.com', 'adroll.com', 'bidswitch.net', 'serving-sys.com',
    ],

    // URL fragments that mark a first-party static ad (image src or link href).
    AD_URL_PATTERN: /\/(ads?|adserver|adimages?|adbanners?|advert(s|ising)?|sponsors?|sponsored|banner[-_]?ads?|dfp|aclk|adclick|clickserve)(\/|\?|\.|-|_|$)|[?&](ad_?unit|ad_?id|creative_?id|adzone|campaign_?id)=/i,

    // Class/id tokens that mark an ad container (matched per token, so
    // "header" or "download" never count).
    AD_TOKEN_PATTERN: /(^|[-_])(ads?|advert(isement)?s?|sponsor(ed)?|adslot|adunit|adbox|adzone|adspace|adbanner|mpu|skyscraper|dfp)([-_]|\d|$)/i,

    // Standard IAB display sizes (w x h), with a few px of slack when matched.
    AD_SIZES: [
      [728, 90], [970, 90], [970, 250], [300, 250], [336, 280], [300, 600],
      [160, 600], [120, 600], [320, 50], [320, 100], [300, 50], [468, 60],
      [250, 250], [200, 200], [180, 150], [234, 60], [300, 100],
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
    PLACEHOLDER_TEXT: /^(advertisement|advertisements|advert|ad|ads|sponsored|sponsored content|paid content|promoted|ad feedback|report this ad|story continues below( advertisement)?|continue reading below|scroll to continue( with content)?)$/i,

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
