/*
 * Layout restructuring engine.
 *
 * For every dead ad slot (hidden, empty, unfilled, or blocked by the network
 * rules / AdGuard DNS) it:
 *   1. collapses the slot and every wrapper above it that holds nothing else,
 *   2. strips min-height / min-width / fixed height reservations from the
 *      wrappers that still hold other content,
 *   3. if a whole column next to the article died, removes the column's grid
 *      or float space and widens the article branch to fill it.
 *
 * Every style change goes through setStyle(), which records the original
 * value so ReaderRestore.engine.restore() can undo everything.
 */
(() => {
  'use strict';

  const RR = (globalThis.ReaderRestore = globalThis.ReaderRestore || {});

  const MEDIA = 'img, picture, video, canvas, svg, iframe, object, embed';
  const IGNORABLE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE', 'BR']);

  RR.createEngine = function createEngine(cfg, site) {
    const processed = new WeakSet();
    const originals = new Map(); // element -> Map(prop -> [value, priority])
    const adSelector = cfg.adSelectors.join(',');
    const railSelector = cfg.railSelectors.length ? cfg.railSelectors.join(',') : null;

    const log = (...args) => {
      if (cfg.debug) console.debug('[ReaderRestore]', ...args);
    };

    // ---- style helpers -----------------------------------------------------

    function setStyle(el, props) {
      let saved = originals.get(el);
      if (!saved) originals.set(el, (saved = new Map()));
      for (const [prop, value] of Object.entries(props)) {
        if (!saved.has(prop)) {
          saved.set(prop, [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
        }
        el.style.setProperty(prop, value, 'important');
      }
      el.dataset.rrTouched = '';
    }

    function collapse(el) {
      setStyle(el, { display: 'none' });
    }

    function restore() {
      for (const [el, saved] of originals) {
        for (const [prop, [value, priority]] of saved) {
          if (value) el.style.setProperty(prop, value, priority);
          else el.style.removeProperty(prop);
        }
        delete el.dataset.rrTouched;
      }
      originals.clear();
    }

    const px = (v) => parseFloat(v) || 0;

    // ---- dead-slot detection -----------------------------------------------

    function hasVisibleMedia(el) {
      for (const m of el.querySelectorAll(MEDIA)) {
        if (m.tagName === 'IFRAME') {
          const src = m.getAttribute('src') || '';
          if (!src || src === 'about:blank') continue;
        }
        const r = m.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) return true;
      }
      return false;
    }

    function isPlaceholderText(text) {
      const t = text.replace(/\s+/g, ' ').trim();
      return t === '' || cfg.PLACEHOLDER_TEXT.test(t);
    }

    // An ad slot is dead when nothing a reader could see is left in it.
    function isDeadAd(el) {
      if (!el.isConnected) return false;
      if (el.hidden) return true;
      if (el.dataset.adStatus === 'unfilled') return true;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return true;
      return !hasVisibleMedia(el) && isPlaceholderText(el.innerText || '');
    }

    // True when `el` holds nothing but dead ads, placeholders and empty spacers.
    function isReclaimable(el, deadAds) {
      if (deadAds.has(el) || IGNORABLE_TAGS.has(el.tagName)) return true;
      if (getComputedStyle(el).display === 'none') return true;
      if (el.matches(MEDIA)) {
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) return false;
      }
      let ownText = '';
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) ownText += node.textContent;
      }
      if (!isPlaceholderText(ownText)) return false;
      for (const child of el.children) {
        if (!isReclaimable(child, deadAds)) return false;
      }
      return true;
    }

    // ---- article detection -------------------------------------------------

    function paragraphCount(el) {
      return el.querySelectorAll('p').length;
    }

    function findArticle() {
      for (const sel of cfg.articleSelectors) {
        let best = null;
        let bestLen = 0;
        for (const el of document.querySelectorAll(sel)) {
          const len = (el.textContent || '').length;
          if (len > bestLen) {
            best = el;
            bestLen = len;
          }
        }
        if (best && bestLen > 400 && paragraphCount(best) >= 2) return best;
      }
      // Fallback: the element directly holding the most paragraphs.
      const counts = new Map();
      for (const p of document.querySelectorAll('p')) {
        if ((p.textContent || '').trim().length < 40) continue;
        const parent = p.parentElement;
        counts.set(parent, (counts.get(parent) || 0) + 1);
      }
      let best = null;
      let bestCount = 2;
      for (const [el, n] of counts) {
        if (n > bestCount) {
          best = el;
          bestCount = n;
        }
      }
      return best;
    }

    // ---- reclaiming space --------------------------------------------------

    // Remove space a still-populated wrapper reserves for an ad.
    function stripReservations(el) {
      const cs = getComputedStyle(el);
      const props = {};
      if (px(cs.minHeight) > 0) props['min-height'] = '0';
      if (px(cs.minWidth) > 0) props['min-width'] = '0';
      if (el.style.height) props.height = 'auto';
      if (Object.keys(props).length) setStyle(el, props);
    }

    // Widen one element so it fills its parent.
    function widen(el) {
      const cs = getComputedStyle(el);
      const parent = el.parentElement;
      if (!parent || cs.display === 'none') return;
      const pcs = getComputedStyle(parent);
      const parentInner = parent.clientWidth - px(pcs.paddingLeft) - px(pcs.paddingRight);
      const props = {};

      if (cs.maxWidth !== 'none') props['max-width'] = cfg.EXPAND.maxWidth;
      if (px(cs.minWidth) > 0) props['min-width'] = '0';
      if (cs.cssFloat !== 'none') {
        props.float = 'none';
        props.clear = 'both';
      }
      if (el.getBoundingClientRect().width < parentInner - 1) {
        props.width = cfg.EXPAND.width;
        props['box-sizing'] = 'border-box';
      }
      // A one-sided margin is usually the gutter a sidebar used to sit in;
      // equal margins are centring and get left alone.
      const ml = px(cs.marginLeft);
      const mr = px(cs.marginRight);
      if (Math.abs(ml - mr) > 40) {
        props['margin-left'] = '0';
        props['margin-right'] = '0';
      }
      if (pcs.display.includes('flex')) {
        props.flex = '1 1 auto';
      }
      if (Object.keys(props).length) setStyle(el, props);
    }

    // A whole column beside the article is dead: give its space to the article.
    function expandArticle(layoutParent, article) {
      const visibleSiblings = [...layoutParent.children].filter(
        (c) => !IGNORABLE_TAGS.has(c.tagName) && getComputedStyle(c).display !== 'none',
      );
      const branch = visibleSiblings.find((c) => c.contains(article));
      if (!branch) return;

      const pcs = getComputedStyle(layoutParent);
      if (pcs.display.includes('grid') && visibleSiblings.length === 1) {
        setStyle(layoutParent, {
          'grid-template-columns': 'minmax(0, 1fr)',
          'grid-template-areas': 'none',
          'column-gap': '0',
        });
        setStyle(branch, { 'grid-area': 'auto', 'grid-column': '1 / -1' });
      }
      if (pcs.display.includes('grid') || pcs.display.includes('flex')) {
        stripReservations(layoutParent);
      }

      // Article itself up to the column that holds it.
      for (let el = article; el && el !== layoutParent; el = el.parentElement) {
        widen(el);
      }

      // Page-level wrappers that cap the content width.
      if (cfg.EXPAND.pageWrappers) {
        for (let el = layoutParent; el && el !== document.body; el = el.parentElement) {
          if (getComputedStyle(el).maxWidth !== 'none') {
            setStyle(el, { 'max-width': cfg.EXPAND.maxWidth });
          }
        }
      }
      log('expanded article into freed column', article);
    }

    function reclaim(ad, article, deadAds) {
      collapse(ad);

      const inline = article && article.contains(ad);
      const chain = []; // ancestors of the ad, below the element shared with the article
      let layoutParent = null;
      let node = ad;
      for (let i = 0; i < cfg.MAX_ANCESTOR_DEPTH; i++) {
        const parent = node.parentElement;
        if (!parent || parent === document.body || parent === document.documentElement) break;
        if (article && parent.contains(article)) {
          layoutParent = parent;
          break;
        }
        chain.push(parent);
        node = parent;
      }

      // Collapse the tallest run of wrappers that hold nothing but dead ads.
      let collapsedUpTo = -1;
      for (let i = 0; i < chain.length; i++) {
        if (!isReclaimable(chain[i], deadAds)) break;
        collapsedUpTo = i;
      }
      // Site-declared rails go even if they hold other filler (e.g. "most read").
      if (railSelector) {
        const railIdx = chain.findIndex((el) => el.matches(railSelector));
        if (railIdx > collapsedUpTo) collapsedUpTo = railIdx;
      }
      if (collapsedUpTo >= 0) collapse(chain[collapsedUpTo]);

      // Anything above that still has content just loses its reservations.
      for (let i = collapsedUpTo + 1; i < chain.length; i++) stripReservations(chain[i]);

      const wholeColumnDead = chain.length > 0 && collapsedUpTo === chain.length - 1;
      if (!inline && layoutParent && wholeColumnDead) {
        expandArticle(layoutParent, article);
      } else if (!inline && layoutParent && chain.length === 0) {
        // The ad sat directly beside the article.
        expandArticle(layoutParent, article);
      }
    }

    // ---- public pass -------------------------------------------------------

    function run({ article: wantArticle }) {
      const candidates = document.querySelectorAll(adSelector);
      if (!candidates.length) return;

      const deadAds = new Set();
      const fresh = [];
      for (const el of candidates) {
        if (processed.has(el)) {
          deadAds.add(el);
        } else if (isDeadAd(el)) {
          deadAds.add(el);
          fresh.push(el);
        }
      }
      if (!fresh.length) return;

      const article = wantArticle ? findArticle() : null;
      for (const ad of fresh) {
        processed.add(ad);
        // Never touch a match that wraps the page or the article itself.
        if (ad === document.body || ad === document.documentElement) continue;
        if (article && ad.contains(article)) continue;
        try {
          if (article) reclaim(ad, article, deadAds);
          else collapse(ad);
        } catch (err) {
          log('reclaim failed', ad, err);
        }
      }
      log(`reclaimed ${fresh.length} slot(s)`, { article });

      if (article && typeof site.layout === 'function') {
        try {
          site.layout({ article, deadAds: fresh, setStyle, config: cfg, log });
        } catch (err) {
          log('site layout hook failed', err);
        }
      }
    }

    return { run, restore, findArticle, setStyle, log };
  };
})();
