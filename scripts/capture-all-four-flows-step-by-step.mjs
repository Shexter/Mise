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

  async function clickByAria(label) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('[aria-label*="${label}"]');
          if (el) {
            el.scrollIntoView({ block: 'center' });
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

  async function navigate(url, wait = 1800) {
    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url: `http://localhost:8081${url}` });
    await new Promise((r) => setTimeout(r, wait));
  }

  // 1. Welcome Screen
  await navigate('/onboarding/welcome');
  await takeScreenshot('flow1_01_welcome');

  // 2. Goal Selection Screen (Calories default)
  await clickByAria("basic setup");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('flow1_02_goals_default_calories');

  // 3. Goal Selection Screen (Both selected)
  await clickByAria("Meal prep");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow3_01_goals_both_selected');

  // 4. Goal Selection Screen (Meal prep only selected)
  await clickByAria("Track my calories");
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('flow2_01_goals_meal_prep_only');

  // 5. Dietary Screen
  await navigate('/onboarding/dietary');
  await takeScreenshot('flow2_02_dietary');

  // 6. Appliances Screen (Default)
  await navigate('/onboarding/appliances');
  await takeScreenshot('flow2_03_appliances_default');

  // 7. Appliances Screen (Selected)
  await clickByAria("Cooktop");
  await clickByAria("Oven");
  await clickByAria("Air fryer");
  await takeScreenshot('flow2_04_appliances_selected');

  // 8. Starter Pantry Screen (Default)
  await navigate('/onboarding/starter-pantry');
  await takeScreenshot('flow2_05_starter_pantry_chips');

  // 9. Starter Pantry Screen (Selected)
  await clickByAria("Chicken breast");
  await clickByAria("White rice");
  await clickByAria("Broccoli");
  await clickByAria("Olive oil");
  await takeScreenshot('flow2_06_starter_pantry_selected');

  // 10. Starter Pantry Review Sheet
  await clickByAria("Review");
  await takeScreenshot('flow2_07_starter_pantry_review_sheet');

  // 11. First Plan Screen
  await navigate('/onboarding/first-plan');
  await takeScreenshot('flow2_08_first_plan_presentation');

  // 12. First Plan Cooking Guide Modal
  await clickByAria("cooking guide");
  await takeScreenshot('flow2_09_first_plan_cooking_guide_sheet');

  // 13. Calorie Results Screen (Flow 1 & Flow 3)
  await navigate('/onboarding/results');
  await takeScreenshot('flow1_03_calorie_results');

  // 14. In-App Pantry Tab (Showing deferred banner when meal-prep is deferred/uncompleted)
  await navigate('/pantry');
  await takeScreenshot('flow4_01_pantry_tab_deferred_banner');

  // 15. In-App Settings Tab (Showing Kitchen & Meal Prep section with 0 owned appliances)
  await navigate('/settings');
  await takeScreenshot('flow4_02_settings_tab');

  // 16. In-App Settings Appliances Sheet
  await clickByAria("Kitchen appliances");
  await takeScreenshot('flow4_03_settings_appliances_sheet');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('ALL FLOW SCREENSHOTS COMPLETE!');
}

run().catch(console.error);
