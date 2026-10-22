import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function addAnalytics(root, output, pages) {
  const config = JSON.parse(await readFile(join(root, 'config/analytics.json'), 'utf8'));
  const { endpoint, propertyId, publicToken, policyVersion } = config;
  if (endpoint !== 'https://analytics.unbought.games' || !publicToken || !propertyId || !Number.isSafeInteger(policyVersion) || policyVersion < 1) {
    throw new Error('Invalid public website analytics configuration');
  }
  // Exact published routes retain useful article names without collecting unknown paths.
  const routes = [...new Set(pages.map(page => page.path))];
  if (routes.length > 200) throw new Error('Review analytics route allowlist: SDK limit is 200');
  await copyFile(fileURLToPath(import.meta.resolve('@unbought/analytics')), join(output, 'analytics-sdk.js'));
  const options = { endpoint, propertyId, publicToken, policyVersion, routes,
    profile: config.profile ?? 'minimal', handoffOrigins: config.handoffOrigins ?? {}, environment: 'production', respectPreferenceSignals: true,
    choice: { enabled: true, crossProperty: true, persistentAttribution: true } };
  await writeFile(join(output, 'analytics.js'), `// Public ingestion capability only; never an administration credential.
if (location.origin === 'https://unbought.games' &&
    navigator.globalPrivacyControl !== true &&
    !['1', 'yes'].includes(navigator.doNotTrack || window.doNotTrack)) {
  import('/analytics-sdk.js').then(async ({ init, linkJourneys, takeHandoff }) => {
    takeHandoff(); // Remove unsupported inbound capabilities without sending them anywhere.
    let disabled = false;
    try { disabled = localStorage.getItem('unbought.analytics.disabled') === 'true'; } catch {}
    if (disabled) return;
    const client = init(${JSON.stringify(options)});
    await client.ready;
    linkJourneys(client, Object.keys(${JSON.stringify(config.handoffOrigins ?? {})}));
    window.unboughtAnalytics = { disable() {
      try { localStorage.setItem('unbought.analytics.disabled', 'true'); } catch {}
      client.setCollectionChoice({ enabled: false });
    }, coverage() { return client.getCoverage(); } };
    return undefined;
  }).catch(() => { /* Measurement must never interrupt the website. */ });
}
`);
  for (const { path } of pages) {
    const file = join(output, path, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace('</head>', '<script type="module" src="/analytics.js"></script></head>'));
  }
}
