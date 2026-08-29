const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

jest.setTimeout(90000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--allow-file-access-from-files',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
});

afterAll(async () => {
  if (browser) await browser.close();
});

test('drifts the camera framing between the default view and default plus time', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.THREE) && Boolean(window.camera));

    const deltas = await page.evaluate(async () => {
      const initialPosition = window.camera.position.clone();
      const initialRotation = window.camera.rotation.clone();
      const duration = 1500;

      await new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
          if (now - start >= duration) {
            resolve();
            return;
          }
          window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      });

      const finalPosition = window.camera.position;
      const finalRotation = window.camera.rotation;
      return {
        posDelta: finalPosition.distanceTo(initialPosition),
        rotDelta: Math.hypot(
          finalRotation.x - initialRotation.x,
          finalRotation.y - initialRotation.y,
          finalRotation.z - initialRotation.z,
        ),
      };
    });

    expect(deltas.posDelta > 0.01 || deltas.rotDelta > 0.001).toBe(true);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
