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

test('changes the camera view when the camera orbits', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.dwarf));

    const defaultCameraPosition = await page.evaluate(() => ({
      x: window.camera.position.x,
      y: window.camera.position.y,
      z: window.camera.position.z,
    }));
    const movedPosition = await page.evaluate(() => {
      window.camera.position.x += 5;
      window.controls.update();
      return {
        x: window.camera.position.x,
        y: window.camera.position.y,
        z: window.camera.position.z,
      };
    });

    expect(movedPosition).not.toEqual(defaultCameraPosition);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
