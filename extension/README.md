# Reader Restore (MV3)

A Manifest V3 Chromium extension that blocks first-party ad scripts, hides ad
slots, and reflows news articles into the space the ads leave behind. It is
meant to run alongside AdGuard (e.g. AdGuard Home as DNS over Tailscale):
AdGuard kills ad *domains* at DNS, which leaves empty slots on the page; this
extension blocks same-origin ad scripts AdGuard can't see and then reclaims
those empty slots.

## Layout

```
extension/
  manifest.json      MV3 manifest, update_url for the self-hosted store
  rules.json         declarativeNetRequest: block ads.js / pagead.js
  cosmetic.css       static ad-slot hiding (document_start, all frames)
  src/config.js      default selectors and engine tuning
  src/sites.js       per-domain rules  <- edit this to add sites
  src/layout.js      layout restructuring engine
  src/content.js     bootstrap + MutationObserver
```

## How the layout engine works

On article-looking pages (`og:type=article`, `<article>`, `articleBody`,
NewsArticle JSON-LD, or a paragraph-dense block), for each dead ad slot
(hidden, zero-size, unfilled, or empty apart from an "Advertisement" label):

1. Collapses the slot and every ancestor wrapper that holds nothing but dead
   ads, placeholders or empty spacers.
2. Strips `min-height`, `min-width` and inline `height` from wrappers that
   still hold real content (the classic 250/600px reservations).
3. If a whole column next to the article died: collapses a CSS grid to one
   `minmax(0, 1fr)` track, un-floats the article branch, drops the one-sided
   gutter margin, and widens the article chain to `width: 100%; max-width: none`.
   With `EXPAND.pageWrappers` on (default), page containers above it lose
   their `max-width` too.

In-article ads are collapsed but never trigger widening. A column that still
has live content (e.g. a "Most read" box) is kept; only its ad reservations
are removed. All changes are inline `!important` styles, recorded so that
`ReaderRestore.engine.restore()` undoes them (run it in the content-script
console context). Set `debug: true` in `src/config.js` to log decisions.

## Adding a site

Append an entry to `RR.SITES` in `src/sites.js`:

```js
{
  domains: ['example-news.com'],
  hide: ['.promo-rail-ad', '#leaderboard'], // hidden and reclaimed
  article: ['.story__content'],             // tried before the defaults
  rails: ['.story__sidebar'],               // collapse once its ads are dead
  css: '.story__grid { gap: 0 !important; }',
  layout(ctx) {                             // runs after each pass
    const grid = document.querySelector('.story__grid');
    if (grid) ctx.setStyle(grid, { 'grid-template-columns': '1fr' });
  },
}
```

Global selectors go in both `cosmetic.css` and `AD_SELECTORS` in
`src/config.js`. New network rules go in `rules.json` with a fresh `id`.

## Network rules

`rules.json` uses `regexFilter` rather than a plain `ads.js` substring so the
file name has to start at a path/query boundary: `/ads.js`, `/js/pagead.js?v=2`
and `?f=ads.js` are blocked, `threads.js` and `uploads.js` are not.

## Packaging for the force-install pipeline

`update_url` is set to `https://extention.lab.editgenlx.com/updates.xml`.

- Chrome only honours a non-Web-Store `update_url` for extensions installed
  by policy (`ExtensionInstallForcelist`, entry `<id>;https://extention.lab.editgenlx.com/updates.xml`)
  on managed devices (domain-joined Windows, MDM-enrolled macOS, or Linux
  with policy files). Loading it unpacked ignores `update_url`.
- The extension ID comes from the CRX signing key. Sign every release with
  the same `.pem`, or add a `"key"` (public key) field to `manifest.json` to
  pin the ID. Keep the `.pem` out of git.
- Bump `version` for each release; `updates.xml` must advertise that version
  and the CRX URL under the same `appid`.
- Vivaldi is Chromium-based, so MV3, `declarativeNetRequest` and
  `ExtensionInstallForcelist` behave the same. It reads policy from its own
  location rather than Chrome's (e.g. `HKLM\\SOFTWARE\\Policies\\Vivaldi` on
  Windows, `/etc/vivaldi/policies/managed/` on Linux,
  `com.vivaldi.Vivaldi` on macOS). Check `vivaldi://policy` to confirm the
  forcelist entry was picked up.
- Pack: `chrome --pack-extension=extension --pack-extension-key=reader-restore.pem`.

## Permissions

`declarativeNetRequest` for `rules.json`, `<all_urls>` host access for the
content scripts, and `scripting`, which is declared for future programmatic
injection (e.g. per-site CSS via `chrome.scripting`) and is unused today.
