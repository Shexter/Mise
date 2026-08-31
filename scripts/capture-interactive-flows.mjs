import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/timothylauw/.gemini/antigravity-cli/brain/d1ecf864-9acf-4eca-9c0d-8da7718349f2/screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  const newTargetRes = await fetch('http://localhost:9222/json/new?http://localhost:8081/', { method: 'PUT' });
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
      console.log('[App Log]', data.params.args.map(a => a.value || a.description).join(' '));
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

  async function clickByText(text) {
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const target = elements.find(el => el.children.length === 0 && (el.textContent || '').trim().includes("${text}"));
          if (target) {
            target.closest('button, [role="button"], [role="checkbox"], [tabindex], div')?.click() || target.click();
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  console.log('Navigating to root...');
  await send('Page.navigate', { url: 'http://localhost:8081/' });
  await new Promise((r) => setTimeout(r, 4000));

  // --- FLOW 1: Welcome Screen ---
  await takeScreenshot('flow1_01_welcome');

  // Click "Let's do the basic setup" -> goes to /onboarding/goals
  console.log('Navigating to goals...');
  await evaluate(`
    window.location.href = '/onboarding/goals';
  `);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow1_02_goals_default');

  // Toggle "Meal prep" card on
  console.log('Toggling meal prep...');
  await clickByText('Meal prep');
  await takeScreenshot('flow3_01_goals_both_selected');

  // Toggle "Track my calories" off -> Meal-prep only
  console.log('Toggling calories off...');
  await clickByText('Track my calories');
  await takeScreenshot('flow2_01_goals_meal_prep_only');

  // Click Continue -> goes to /onboarding/dietary
  console.log('Continuing to dietary...');
  await evaluate(`window.location.href = '/onboarding/dietary'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow2_02_dietary');

  // Navigate to appliances -> /onboarding/appliances
  console.log('Continuing to appliances...');
  await evaluate(`window.location.href = '/onboarding/appliances'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow2_03_appliances_default');

  // Select appliances: Oven, Air Fryer, Rice Cooker
  await clickByText('Oven');
  await clickByText('Air fryer');
  await clickByText('Rice cooker');
  await takeScreenshot('flow2_04_appliances_selected');

  // Navigate to starter pantry -> /onboarding/starter-pantry
  console.log('Continuing to starter pantry...');
  await evaluate(`window.location.href = '/onboarding/starter-pantry'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow2_05_starter_pantry_chips');

  // Pick starter items: Chicken breast, White rice, Eggs, Olive oil
  await clickByText('Chicken breast');
  await clickByText('White rice');
  await clickByText('Eggs');
  await clickByText('Olive oil');
  await takeScreenshot('flow2_06_starter_pantry_selected');

  // Navigate to first plan -> /onboarding/first-plan
  console.log('Continuing to first plan...');
  await evaluate(`window.location.href = '/onboarding/first-plan'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow2_07_first_plan');

  // Open Cooking Guide
  console.log('Opening cooking guide...');
  await clickByText('Start cooking guide');
  await takeScreenshot('flow2_08_cooking_guide_sheet');

  // Calorie Results Screen (Flow 1 & 3)
  console.log('Navigating to calorie results...');
  await evaluate(`window.location.href = '/onboarding/results'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow1_03_calorie_results');

  // In-App Tab Screens (Pantry with deferred resume banner & Settings with appliances sheet)
  console.log('Navigating to Pantry Tab...');
  await evaluate(`window.location.href = '/pantry'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow4_01_pantry_deferred_banner');

  console.log('Navigating to Settings Tab...');
  await evaluate(`window.location.href = '/settings'`);
  await new Promise((r) => setTimeout(r, 2000));
  await takeScreenshot('flow4_02_settings_tab');

  await fetch(`http://localhost:9222/json/close/${target.id}`);
  console.log('Done capturing all interactive onboarding flows!');
}

run().catch(console.error);
