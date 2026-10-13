/*
 * AdGuard companion: keeps this extension from duplicating AdGuard's work.
 *
 * While the AdGuard Home dashboard answers (i.e. the browser is on the
 * tailnet and AdGuard is the DNS resolver), ad *domains* are left to AdGuard
 * and only rules.json + the cosmetic/layout scripts run. When the dashboard
 * stops answering (Tailscale off, AdGuard container down), the bundled
 * fallback-rules.json domain list is switched on so the main ad networks are
 * still blocked, and switched off again once AdGuard is back.
 */
'use strict';

const DEFAULTS = { adguardUrl: 'https://ad.lab.editgenlx.com/' };
const FALLBACK_RULESET = 'adguard_fallback';
const ALARM = 'adguard-check';
const CHECK_PERIOD_MIN = 2;
const TIMEOUT_MS = 5000;

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
}

// Any HTTP answer at all (even a login page or an opaque response) means the
// host resolved and was reachable; a DNS failure or timeout throws.
async function isReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function setFallback(on) {
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  if (enabled.includes(FALLBACK_RULESET) === on) return;
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    on ? { enableRulesetIds: [FALLBACK_RULESET] } : { disableRulesetIds: [FALLBACK_RULESET] },
  );
}

async function check() {
  const { adguardUrl } = await getSettings();
  const reachable = await isReachable(adguardUrl);
  await setFallback(!reachable);

  const status = { reachable, adguardUrl, checkedAt: Date.now() };
  await chrome.storage.local.set({ adguardStatus: status });
  await chrome.action.setBadgeText({ text: reachable ? '' : 'OFF' });
  await chrome.action.setBadgeBackgroundColor({ color: '#c62828' });
  await chrome.action.setTitle({
    title: reachable
      ? 'AdGuard reachable: domain blocking left to AdGuard'
      : 'AdGuard unreachable: fallback domain blocking on',
  });
  return status;
}

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: CHECK_PERIOD_MIN });
  check();
}

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) check();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.adguardUrl) check();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'adguard-check') {
    check().then(sendResponse);
    return true;
  }
  return false;
});
