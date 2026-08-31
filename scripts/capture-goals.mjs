import { writeFileSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots';

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

  await new Promise((r) => setTimeout(r, 3000));
  await takeScreenshot('screen_01_welcome');

  // Click "Let's do the basic setup"
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.includes("Let's do the basic setup"));
        if (btn) {
          (btn.closest('[role="button"]') || btn).click();
        }
      })()
    `
  });

  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('screen_02_goals_default');

  // Click "Meal prep" card
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const mealPrepCard = Array.from(document.querySelectorAll('*')).find(el => el.textContent === "Meal prep");
        if (mealPrepCard) {
          (mealPrepCard.closest('[role="checkbox"]') || mealPrepCard).click();
        }
      })()
    `
  });

  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('screen_03_goals_both');

  // Toggle "Track my calories" off
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const calCard = Array.from(document.querySelectorAll('*')).find(el => el.textContent === "Track my calories");
        if (calCard) {
          (calCard.closest('[role="checkbox"]') || calCard).click();
        }
      })()
    `
  });

  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('screen_04_goals_meal_prep_only');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('Goals flow captured!');
}

run().catch(console.error);
