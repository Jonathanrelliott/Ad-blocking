/*
 * Per-domain rules. This is the file to edit when a news site needs help.
 *
 * Each entry is merged on top of the defaults in config.js when the page's
 * hostname matches one of `domains` (subdomains match too). Every field is
 * optional except `domains`:
 *
 *   domains           ['example.com']   hostnames this rule applies to
 *   hide              [selector, ...]   extra ad slots: hidden AND reclaimed
 *   article           [selector, ...]   article body, tried before defaults
 *   rails             [selector, ...]   sidebars/columns to collapse once
 *                                       every ad inside them is dead
 *   css               'string'          extra CSS injected as a <style>
 *   forceArticle      true              run the layout engine even if the
 *                                       page doesn't look like an article
 *   layout(ctx)       function          custom JS run after each pass; ctx
 *                                       gives { article, deadAds, setStyle,
 *                                       config, log }
 *
 * Example (copy, edit, and append to SITES):
 *
 *   {
 *     domains: ['example-news.com'],
 *     hide: ['.promo-rail-ad', '#leaderboard'],
 *     article: ['.story__content'],
 *     rails: ['.story__sidebar'],
 *     css: '.story__grid { gap: 0 !important; }',
 *     layout(ctx) {
 *       const grid = document.querySelector('.story__grid');
 *       if (grid) ctx.setStyle(grid, { 'grid-template-columns': '1fr' });
 *     },
 *   },
 */
(() => {
  'use strict';

  const RR = (globalThis.ReaderRestore = globalThis.ReaderRestore || {});

  RR.SITES = [
    // Add domain rules here.
  ];
})();
