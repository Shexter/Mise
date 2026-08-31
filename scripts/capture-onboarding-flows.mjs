import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
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
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    mobile: true,
  });

  async function capture(name, url, waitMs = 2500) {
    console.log(`Navigating to ${url} for ${name}...`);
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, waitMs));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filepath = join(SCREENSHOT_DIR, `${name}.png`);
    writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved ${name}.png`);
  }

  // 1. Welcome Screen
  await capture('01_welcome', 'http://localhost:8081/onboarding/welcome');

  // 2. Goal Selection Screen (Two cards: Track calories & Meal prep)
  await capture('02_goals', 'http://localhost:8081/onboarding/goals');

  // 3. Calorie steps (Flow 1 & Flow 3)
  await capture('03_calories_results', 'http://localhost:8081/onboarding/results');

  // 4. Meal prep steps (Flow 2 & Flow 3)
  await capture('04_appliances', 'http://localhost:8081/onboarding/appliances');
  await capture('05_starter_pantry', 'http://localhost:8081/onboarding/starter-pantry');
  await capture('06_first_plan', 'http://localhost:8081/onboarding/first-plan');

  // 5. In-app entry points & deferred resume banner (Flow 4)
  await capture('07_pantry_tab', 'http://localhost:8081/pantry');
  await capture('08_settings_tab', 'http://localhost:8081/settings');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('All flow screenshots captured successfully!');
}

run().catch(console.error);
