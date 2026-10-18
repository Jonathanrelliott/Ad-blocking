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
  fallback-rules.json  ad-network domains, only on while AdGuard is unreachable
  popup/             toolbar popup: AdGuard status, dashboard link, URL setting
  src/background.js  AdGuard reachability check, toggles the fallback rules
  cosmetic.css       static ad-slot hiding (document_start, all frames)
  src/config.js      default selectors and engine tuning
  src/sites.js       per-domain rules  <- edit this to add sites
  src/detect.js      static banner detector (tags data-rr-ad)
  src/layout.js      layout restructuring engine
  src/content.js     bootstrap + MutationObserver
```

## Working alongside AdGuard on Tailscale

The service worker checks the AdGuard Home dashboard
(`https://ad.lab.editgenlx.com/` by default) every 2 minutes, and whenever
the popup is opened.

- **Reachable** (on the tailnet): ad domains are left to AdGuard's DNS
  filtering. Only `rules.json` and the cosmetic/layout scripts run, so the two
  never block the same thing twice.
- **Unreachable** (Tailscale off, or the AdGuard container down): the
  `adguard_fallback` ruleset (`fallback-rules.json`) is switched on so the big
  ad networks are still blocked, the badge shows `OFF`, and the popup says so.
  It switches off again on the next check that reaches AdGuard.

"Reachable" means the dashboard host answered, not that the browser is
actually resolving through AdGuard. The URL can be changed in the popup if
AdGuard moves.

### Vivaldi notes

- **Turn off Vivaldi's own DNS-over-HTTPS** (Settings > Privacy and Security >
  "Use DNS over HTTPS"), or point it at AdGuard. With DoH on, Vivaldi resolves
  names itself and bypasses AdGuard's DNS filtering on the tailnet entirely.
- In the Tailscale admin console, AdGuard's Tailscale IP should be a global
  nameserver with "Override local DNS" on, so every device on the tailnet uses it.
- Vivaldi's built-in Tracker and Ad Blocker can stay on; overlapping with it
  is harmless. Turn it off if a site breaks, to see which blocker is
  responsible.
- To try a build without the force-install pipeline: `vivaldi://extensions`,
  enable Developer mode, then "Load unpacked" and pick the `extension/` folder.

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

## Static ads

Plain `<a><img></a>` banners and first-party iframes have no script to block
and often no known class. `src/detect.js` tags them with `data-rr-ad` (hidden
by `cosmetic.css`, then reclaimed by the layout engine) when a small,
text-light element has a strong signal (src/href on an `AD_HOSTS` domain, or
an ad class/id token like `ad-`, `sponsored`, `mpu`) or an IAB ad size
(728x90, 300x250, 300x600, ...) plus a weak one (ad-looking URL path, ad
alt text, or an "Advertisement" label beside it). Tune `AD_HOSTS`,
`AD_URL_PATTERN`, `AD_TOKEN_PATTERN` and `AD_SIZES` in `src/config.js`.

## Network rules

`rules.json` uses `regexFilter` rather than a plain `ads.js` substring so the
file name has to start at a path/query boundary: `/ads.js`, `/js/pagead.js?v=2`
and `?f=ads.js` are blocked, `threads.js` and `uploads.js` are not.

Ad-network domains (the `AD_HOSTS` networks and a few more) live in
`fallback-rules.json`, not here. That ruleset is only switched on while
AdGuard is unreachable, so the extension doesn't duplicate AdGuard's DNS
blocking on the tailnet (see "Working alongside AdGuard on Tailscale").

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
  location rather than Chrome's (e.g. `HKLM\SOFTWARE\Policies\Vivaldi` on
  Windows, `/etc/vivaldi/policies/managed/` on Linux,
  `com.vivaldi.Vivaldi` on macOS). Check `vivaldi://policy` to confirm the
  forcelist entry was picked up.
- Pack: `chrome --pack-extension=extension --pack-extension-key=reader-restore.pem`.

## Permissions

`declarativeNetRequest` for `rules.json` and `fallback-rules.json`,
`<all_urls>` host access for the content scripts, `storage` and `alarms` for
the AdGuard check and its URL setting, and `scripting`, which is declared for future programmatic
injection (e.g. per-site CSS via `chrome.scripting`) and is unused today.
