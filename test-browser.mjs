import { writeFileSync } from 'fs';

async function main() {
  const versionRes = await fetch('http://localhost:9222/json/version');
  const versionData = await versionRes.json();
  console.log('Chrome version:', versionData.Browser);

  const targetsRes = await fetch('http://localhost:9222/json/list');
  const targets = await targetsRes.json();
  console.log('Targets:', targets.length);

  // Create a new target / page
  const newTargetRes = await fetch('http://localhost:9222/json/new?http://localhost:8081/onboarding/welcome', { method: 'PUT' });
  const target = await newTargetRes.json();
  console.log('Target created:', target.id);

  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    const msgId = id++;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    } else if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[Console]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error('[Exception]', data.params.exceptionDetails);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  console.log('Connected to CDP');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Navigate to welcome
  console.log('Navigating to welcome...');
  await send('Page.navigate', { url: 'http://localhost:8081/onboarding/welcome' });

  // Wait 4 seconds for bundling & DB initialization
  await new Promise((r) => setTimeout(r, 4000));

  // Take screenshot
  const screenshot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots/flow_welcome.png', Buffer.from(screenshot1.data, 'base64'));
  console.log('Saved flow_welcome.png');

  // Close page
  await fetch(`http://localhost:9222/json/close/${target.id}`);
}

main().catch(console.error);
