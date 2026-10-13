'use strict';

const $ = (id) => document.getElementById(id);

function render(status) {
  if (!status) return;
  $('status').className = 'status ' + (status.reachable ? 'ok' : 'bad');
  $('status').textContent = status.reachable
    ? 'AdGuard is reachable'
    : 'AdGuard is unreachable';
  $('detail').textContent = status.reachable
    ? 'Ad domains are left to AdGuard. This extension handles first-party ad scripts and empty slots.'
    : 'Is Tailscale connected? Built-in fallback domain blocking is on until AdGuard answers again.';
  $('dashboard').href = status.adguardUrl;
}

async function recheck() {
  $('status').className = 'status';
  $('status').textContent = 'Checking AdGuard…';
  render(await chrome.runtime.sendMessage({ type: 'adguard-check' }));
}

async function init() {
  const { adguardUrl } = await chrome.storage.sync.get({ adguardUrl: 'https://ad.lab.editgenlx.com/' });
  $('url').value = adguardUrl;
  $('dashboard').href = adguardUrl;
  const { adguardStatus } = await chrome.storage.local.get('adguardStatus');
  render(adguardStatus);
  recheck();
}

$('recheck').addEventListener('click', recheck);
$('settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  await chrome.storage.sync.set({ adguardUrl: $('url').value.trim() });
  recheck();
});

init();
