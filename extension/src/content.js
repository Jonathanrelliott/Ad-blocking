/*
 * Bootstrap: resolves the site rule for this hostname, merges it with the
 * defaults, and drives the layout engine from a debounced MutationObserver.
 */
(() => {
  'use strict';

  const RR = globalThis.ReaderRestore;
  if (!RR || RR.engine) return;

  function resolveSite(hostname) {
    const host = hostname.replace(/^www\./, '');
    return (
      (RR.SITES || []).find((s) =>
        (s.domains || []).some((d) => host === d || host.endsWith('.' + d)),
      ) || {}
    );
  }

  function buildConfig(base, site) {
    return {
      ...base,
      adSelectors: [...base.AD_SELECTORS, ...(site.hide || [])],
      articleSelectors: [...(site.article || []), ...base.ARTICLE_SELECTORS],
      railSelectors: site.rails || [],
    };
  }

  function injectSiteCss(site) {
    const rules = [];
    if (site.hide && site.hide.length) {
      rules.push(`${site.hide.join(',\n')} { display: none !important; }`);
    }
    if (site.css) rules.push(site.css);
    if (!rules.length) return;
    const style = document.createElement('style');
    style.dataset.readerRestore = 'site';
    style.textContent = rules.join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function looksLikeArticle(site, engine) {
    if (site.forceArticle) return true;
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType && /article/i.test(ogType.content)) return true;
    if (document.querySelector('[itemprop="articleBody"], article')) return true;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (/"@type"\s*:\s*"(News|Blog)?Article"/.test(s.textContent || '')) return true;
    }
    return Boolean(engine.findArticle());
  }

  const site = resolveSite(location.hostname);
  const cfg = buildConfig(RR.config, site);
  const engine = (RR.engine = RR.createEngine(cfg, site));
  const detector = RR.createDetector(cfg);

  injectSiteCss(site);

  let isArticle = looksLikeArticle(site, engine);
  let observer = null;
  let scheduled = false;

  function pass() {
    scheduled = false;
    // Pages that hydrate late can turn into articles after the first check.
    if (!isArticle) isArticle = looksLikeArticle(site, engine);
    // Tag static banners first so the engine reclaims them in the same pass.
    detector.run(isArticle ? engine.findArticle() : null);
    engine.run({ article: isArticle });
    // Drop the mutation records our own style writes just produced.
    if (observer) observer.takeRecords();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    setTimeout(() => idle(pass, { timeout: 1000 }), cfg.MUTATION_DEBOUNCE_MS);
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'data-ad-status'],
  });

  pass();
  for (const ms of cfg.LATE_PASSES_MS) setTimeout(schedule, ms);
})();
