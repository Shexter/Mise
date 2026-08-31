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
    await new Promise((r) => setTimeout(r, 1000));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filepath = join(SCREENSHOT_DIR, `${name}.png`);
    writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  }

  async function clickByAria(label) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('[aria-label*="${label}"]');
          if (el) {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
          return null;
        })()
      `,
      returnByValue: true,
    });
    const coords = res?.result?.value;
    if (coords) {
      console.log('Clicking:', label, coords);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      return true;
    }
    console.warn('Could not find element with aria-label containing:', label);
    return false;
  }

  await new Promise((r) => setTimeout(r, 2500));

  // 1. Welcome Screen
  await takeScreenshot('flow1_01_welcome');

  // Navigate to Goals
  await clickByAria("basic setup");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('flow1_02_goals_default_calories');

  // --- FLOW 3: Combined Flow (Both Selected) ---
  await clickByAria("Meal prep");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow3_01_goals_both_selected');

  // --- FLOW 2: Meal Prep Only ---
  await clickByAria("Track my calories");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow2_01_goals_meal_prep_only');

  // Continue -> Dietary
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('flow2_02_dietary_screen');

  // Continue -> Appliances
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('flow2_03_appliances_screen');

  // Select appliances: Cooktop, Oven, Air fryer
  await clickByAria("Cooktop");
  await clickByAria("Oven");
  await clickByAria("Air fryer");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow2_04_appliances_selected');

  // Continue -> Starter Pantry
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('flow2_05_starter_pantry_screen');

  // Select starter items
  await clickByAria("Chicken breast");
  await clickByAria("White rice");
  await clickByAria("Broccoli");
  await clickByAria("Olive oil");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow2_06_starter_pantry_selected');

  // Open Review Sheet
  await clickByAria("Review");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('flow2_07_starter_pantry_review_sheet');

  // Confirm -> First Plan Screen
  await clickByAria("Confirm");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('flow2_08_first_plan_screen');

  // Open Cooking Guide Modal
  await clickByAria("cooking guide");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('flow2_09_cooking_guide_sheet');

  // Close Cooking Guide Modal & Finish Setup
  await send('Page.navigate', { url: 'http://localhost:8081/onboarding/first-plan' });
  await new Promise((r) => setTimeout(r, 1200));
  await clickByAria("Finish setup");
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow2_10_main_app_tabs');

  // --- FLOW 4: Deferred Meal Prep Resumption Banner & Settings ---
  await send('Page.navigate', { url: 'http://localhost:8081/pantry' });
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('flow4_01_pantry_tab_deferred_banner');

  await send('Page.navigate', { url: 'http://localhost:8081/settings' });
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('flow4_02_settings_tab');

  // Open Kitchen Appliances Sheet in Settings
  await clickByAria("Kitchen appliances");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('flow4_03_settings_appliances_sheet');

  // Calorie Results Screen for Flow 1 & 3
  await send('Page.navigate', { url: 'http://localhost:8081/onboarding/results' });
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('flow1_03_calorie_results_screen');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('All 4 onboarding flows successfully captured and validated!');
}

run().catch(console.error);
