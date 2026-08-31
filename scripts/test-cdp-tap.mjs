import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  const newTargetRes = await fetch('http://localhost:9222/json/new?http://localhost:8081/onboarding/welcome', { method: 'PUT' });
  const target = await newTargetRes.json();

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
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    mobile: true,
  });

  async function takeScreenshot(name) {
    await new Promise((r) => setTimeout(r, 1200));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filepath = join(SCREENSHOT_DIR, `${name}.png`);
    writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  }

  async function clickElementByText(text) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const target = elements.find(el => el.textContent && el.textContent.trim().includes("${text}"));
          if (target) {
            const btn = target.closest('[role="button"], [role="checkbox"], [tabindex]') || target;
            const r = btn.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
          return null;
        })()
      `,
      returnByValue: true,
    });
    const coords = res?.result?.value;
    if (coords) {
      console.log('Clicking at coords for text:', text, coords);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      return true;
    }
    return false;
  }

  await new Promise((r) => setTimeout(r, 3000));
  await takeScreenshot('real_01_welcome');

  // Click "Let's do the basic setup"
  await clickElementByText("Let's do the basic setup");
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('real_02_goals');

  // Toggle "Meal prep" card
  await clickElementByText("Meal prep");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('real_03_goals_both');

  // Toggle "Track my calories" off
  await clickElementByText("Track my calories");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('real_04_goals_meal_prep_only');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('CDP click test done!');
}

run().catch(console.error);
