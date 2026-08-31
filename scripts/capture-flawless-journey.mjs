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

  async function takeScreenshot(name, waitMs = 1200) {
    await new Promise((r) => setTimeout(r, waitMs));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const filepath = join(SCREENSHOT_DIR, `${name}.png`);
    writeFileSync(filepath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  }

  async function clickText(text) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const target = elements.find(el => {
            const aria = el.getAttribute('aria-label') || '';
            const t = el.textContent || '';
            return aria.includes("${text}") || t.trim() === "${text}" || (el.children.length === 0 && t.includes("${text}"));
          });
          if (target) {
            const btn = target.closest('[role="button"], [role="checkbox"], [tabindex]') || target;
            btn.scrollIntoView({ block: 'center' });
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
      console.log('Clicking text/aria:', text, coords);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      return true;
    }
    console.warn('Could not find element for:', text);
    return false;
  }

  await new Promise((r) => setTimeout(r, 2500));

  // 1. Welcome
  await takeScreenshot('screen_01_welcome');

  // Navigate to Goals
  await clickText("Let's do the basic setup");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('screen_02_goals_default_calories');

  // Toggle Meal Prep -> Flow 3 (Both)
  await clickText("Meal prep");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('screen_03_goals_both_selected');

  // Toggle Calories off -> Flow 2 (Meal Prep Only)
  await clickText("Track my calories");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('screen_04_goals_meal_prep_only');

  // Click Continue -> Dietary
  await clickText("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('screen_05_dietary');

  // Click Continue on Dietary -> Appliances
  await clickText("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('screen_06_appliances');

  // Select appliances
  await clickText("Cooktop / Stovetop");
  await clickText("Oven");
  await clickText("Air fryer");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('screen_07_appliances_selected');

  // Continue -> Starter Pantry
  await clickText("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('screen_08_starter_pantry');

  // Select starter ingredients
  await clickText("Chicken breast");
  await clickText("White rice");
  await clickText("Eggs");
  await clickText("Olive oil");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('screen_09_starter_pantry_selected');

  // Click Review button
  await clickText("Review 4 ingredients");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('screen_10_starter_pantry_review_sheet');

  // Click Confirm -> First Plan
  await clickText("Confirm & add to pantry");
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('screen_11_first_plan');

  // Click Start cooking guide
  await clickText("Start cooking guide");
  await new Promise((r) => setTimeout(r, 1200));
  await takeScreenshot('screen_12_first_plan_cooking_guide_sheet');

  // Close guide modal / Click Finish setup
  await send('Page.navigate', { url: 'http://localhost:8081/onboarding/first-plan' });
  await new Promise((r) => setTimeout(r, 1200));
  await clickText("Finish setup");
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('screen_13_main_app_tabs');

  // Calorie Results Screen (for Flow 1 & Flow 3)
  await send('Page.navigate', { url: 'http://localhost:8081/onboarding/results' });
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('screen_14_calorie_results');

  // Deferred Meal Prep state & Settings
  await send('Page.navigate', { url: 'http://localhost:8081/settings' });
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('screen_15_settings');

  // Open Kitchen Appliances Sheet
  await clickText("Kitchen appliances");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('screen_16_settings_appliances_sheet');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('FLAWLESS WALKTHROUGH FINISHED!');
}

run().catch(console.error);
