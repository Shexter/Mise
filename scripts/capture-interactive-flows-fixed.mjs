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
      console.log('Clicking by aria-label:', label, coords);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
      return true;
    }
    console.warn('Could not find element with aria-label containing:', label);
    return false;
  }

  await new Promise((r) => setTimeout(r, 3000));
  await takeScreenshot('final_01_welcome');

  // 1. Click "Let's do the basic setup"
  await clickByAria("basic setup");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_02_goals_default_calories');

  // 2. Toggle "Meal prep" card ON -> Flow 3 (Both)
  await clickByAria("Meal prep");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('final_03_goals_both_selected');

  // 3. Toggle "Track calories" card OFF -> Flow 2 (Meal prep only)
  await clickByAria("Track calories");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('final_04_goals_meal_prep_only');

  // 4. Continue to dietary
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_05_dietary');

  // 5. Continue to appliances
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_06_appliances');

  // 6. Select appliances: Cooktop, Oven, Air fryer
  await clickByAria("Cooktop");
  await clickByAria("Oven");
  await clickByAria("Air fryer");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('final_07_appliances_selected');

  // 7. Continue to starter pantry
  await clickByAria("Continue");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_08_starter_pantry');

  // 8. Select starter items
  await clickByAria("Chicken breast");
  await clickByAria("White rice");
  await clickByAria("Eggs");
  await clickByAria("Olive oil");
  await new Promise((r) => setTimeout(r, 1000));
  await takeScreenshot('final_09_starter_pantry_selected');

  // 9. Review ingredients sheet
  await clickByAria("Review");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_10_starter_pantry_review_sheet');

  // 10. Confirm review sheet -> First Plan screen
  await clickByAria("Confirm");
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('final_11_first_plan');

  // 11. Cooking guide sheet
  await clickByAria("cooking guide");
  await new Promise((r) => setTimeout(r, 1500));
  await takeScreenshot('final_12_cooking_guide_sheet');

  // 12. Finish setup
  await clickByAria("Finish setup");
  await new Promise((r) => setTimeout(r, 2500));
  await takeScreenshot('final_13_main_app_tabs');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('All screens verified and captured!');
}

run().catch(console.error);
