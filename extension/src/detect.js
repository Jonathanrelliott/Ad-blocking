/*
 * Static ad detector.
 *
 * Script-driven slots are caught by selectors, but plenty of ads are plain
 * <a><img></a> banners or iframes served first-party, with no class a filter
 * list knows about. This pass tags those with data-rr-ad, which cosmetic.css
 * hides and the layout engine then reclaims like any other dead slot.
 *
 * An element is tagged when it is small and text-light (never an article or
 * a big container) and has one strong signal, or an IAB ad size plus a weak
 * one:
 *   strong  src/href on an ad-serving host, or an ad-ish class/id token
 *   weak    ad-looking URL path, ad alt/title text, or an "Advertisement" /
 *           "Sponsored" label right next to it
 */
(() => {
  'use strict';

  const RR = (globalThis.ReaderRestore = globalThis.ReaderRestore || {});

  RR.createDetector = function createDetector(cfg) {
    const MAX_TEXT = 80; // anything chattier than this is content, not a banner
    const hostRe = new RegExp(
      '(^|\\.)(' + cfg.AD_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|') + ')$',
      'i',
    );
    let tagged = 0;

    function isAdHost(url) {
      if (!url) return false;
      try {
        return hostRe.test(new URL(url, location.href).hostname);
      } catch {
        return false;
      }
    }

    function isAdUrl(url) {
      if (!url) return false;
      try {
        const u = new URL(url, location.href);
        return cfg.AD_URL_PATTERN.test(u.pathname + u.search);
      } catch {
        return false;
      }
    }

    function hasAdToken(el) {
      for (const token of el.classList) if (cfg.AD_TOKEN_PATTERN.test(token)) return true;
      return Boolean(el.id) && cfg.AD_TOKEN_PATTERN.test(el.id);
    }

    function isAdSize(el) {
      const r = el.getBoundingClientRect();
      return cfg.AD_SIZES.some(([w, h]) => Math.abs(r.width - w) <= 4 && Math.abs(r.height - h) <= 4);
    }

    function isPlaceholder(text) {
      const t = (text || '').replace(/\s+/g, ' ').trim();
      return t !== '' && cfg.PLACEHOLDER_TEXT.test(t);
    }

    // "Advertisement" label as a sibling, or as the only text in the parent.
    function hasAdLabel(el) {
      for (const sib of [el.previousElementSibling, el.nextElementSibling]) {
        if (sib && isPlaceholder(sib.textContent)) return true;
      }
      const parent = el.parentElement;
      return Boolean(parent) && isPlaceholder(parent.innerText);
    }

    function isSmallAndQuiet(el, article) {
      if (el === document.body || el === document.documentElement) return false;
      if (article && el.contains(article)) return false;
      if (el.querySelector('article, main, p + p')) return false;
      return (el.innerText || '').trim().length <= MAX_TEXT;
    }

    // The unit to hide for a banner image: its link, if the link holds just it.
    function bannerUnit(media) {
      const link = media.closest('a');
      if (link && (link.innerText || '').trim().length <= MAX_TEXT) return link;
      return media;
    }

    function tag(el, why) {
      if (el.hasAttribute('data-rr-ad')) return;
      el.setAttribute('data-rr-ad', why);
      tagged++;
      if (cfg.debug) console.debug('[ReaderRestore] static ad:', why, el);
    }

    function checkMedia(media, article) {
      const src = media.currentSrc || media.getAttribute('src') || '';
      const unit = bannerUnit(media);
      const href = unit.tagName === 'A' ? unit.getAttribute('href') : '';
      if (!isSmallAndQuiet(unit, article)) return;

      if (isAdHost(src) || isAdHost(href)) return tag(unit, 'ad-host');
      if (hasAdToken(media) || (unit !== media && hasAdToken(unit))) return tag(unit, 'ad-class');

      const altText = `${media.getAttribute('alt') || ''} ${media.getAttribute('title') || ''}`;
      const weak = isAdUrl(src) || isAdUrl(href) || isPlaceholder(altText) || hasAdLabel(unit);
      if (weak && isAdSize(media)) tag(unit, 'ad-size');
    }

    function checkContainer(el, article) {
      if (!hasAdToken(el)) return;
      if (!isSmallAndQuiet(el, article)) return;
      // Token alone is enough only for an element that actually renders
      // something ad-shaped: media inside it, an IAB size, or a label.
      if (el.querySelector('img, iframe, video, canvas') || isAdSize(el) || hasAdLabel(el)) {
        tag(el, 'ad-class');
      }
    }

    function run(article) {
      const before = tagged;
      for (const media of document.querySelectorAll('img:not([data-rr-ad]), iframe:not([data-rr-ad])')) {
        if (media.closest('[data-rr-ad]')) continue;
        checkMedia(media, article);
      }
      for (const el of document.querySelectorAll('[class*="ad" i], [id*="ad" i], [class*="sponsor" i], [id*="sponsor" i], [class*="mpu" i]')) {
        if (el.closest('[data-rr-ad]')) continue;
        checkContainer(el, article);
      }
      return tagged - before;
    }

    return { run };
  };
})();
