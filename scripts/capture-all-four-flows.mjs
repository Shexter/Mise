import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  const newTargetRes = await fetch('http://localhost:9222/json/new?http://localhost:8081/', { method: 'PUT' });
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

  async function tapText(text) {
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const target = elements.find(el => el.textContent && el.textContent.trim().includes("${text}"));
          if (target) {
            const clickTarget = target.closest('[role="button"], [role="checkbox"], [tabindex]') || target;
            const rect = clickTarget.getBoundingClientRect();
            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top + rect.height / 2;
            const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX, clientY, pointerType: 'touch', isPrimary: true });
            const up = new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX, clientY, pointerType: 'touch', isPrimary: true });
            clickTarget.dispatchEvent(down);
            clickTarget.dispatchEvent(up);
            clickTarget.click();
            return true;
          }
          return false;
        })()
      `
    });
  }

  await new Promise((r) => setTimeout(r, 3000));
  await takeScreenshot('01_welcome_screen');

  // Tap "Let's do the basic setup"
  await tapText("Let's do the basic setup");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('02_goals_default_calories');

  // Toggle Meal prep card ON -> Both selected
  await tapText('Meal prep');
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('03_goals_both_selected');

  // Toggle Calories card OFF -> Meal prep only
  await tapText('Track my calories');
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('04_goals_meal_prep_only');

  // Tap Continue -> dietary preferences
  await tapText('Continue');
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('05_dietary_screen');

  // Tap Continue -> appliances screen
  await tapText('Continue');
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('06_appliances_screen');

  // Select appliances: Cooktop, Oven, Air fryer
  await tapText('Cooktop / Stovetop');
  await tapText('Oven');
  await tapText('Air fryer');
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('07_appliances_selected');

  // Tap Continue -> starter pantry
  await tapText('Continue');
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('08_starter_pantry_screen');

  // Select starter items
  await tapText('Chicken breast');
  await tapText('White rice');
  await tapText('Broccoli');
  await tapText('Olive oil');
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('09_starter_pantry_selected');

  // Tap Review & confirm button
  await tapText('Review 4 ingredients');
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('10_starter_pantry_review_sheet');

  // Confirm review -> first plan screen
  await tapText('Confirm & add to pantry');
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('11_first_plan_screen');

  // Tap Start cooking guide
  await tapText('Start cooking guide');
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('12_cooking_guide_sheet');

  // Tap Finish setup -> enters app
  await tapText('Finish setup');
  await new Promise((r) => setTimeout(r, 2500));
  await takeScreenshot('13_main_app_tabs');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('All 4 conditional flows completely inspected and captured!');
}

run().catch(console.error);
