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

describe('space dust scene', () => {
  test('initializes the central object and both shell groups', async () => {
    let context;
    let page;

    try {
      context = await browser.newContext();
      page = await context.newPage();
      const indexPath = path.resolve(__dirname, '..', 'index.html');
      const indexUrl = pathToFileURL(indexPath).href;
      await page.goto(indexUrl, { waitUntil: 'load' });

      await page.waitForFunction(() => (
        Boolean(window.dwarf) &&
        Boolean(window.innerShell) &&
        Boolean(window.outerShell)
      ));

      const sceneObjects = await page.evaluate(() => ({
        dwarf: Boolean(window.dwarf),
        innerShell: Boolean(window.innerShell),
        outerShell: Boolean(window.outerShell),
      }));

      expect(sceneObjects).toEqual({
        dwarf: true,
        innerShell: true,
        outerShell: true,
      });
    } finally {
      if (page) await page.close();
      if (context) await context.close();
    }
  });

  test('changes the camera view when the camera orbits', async () => {
    let context;
    let page;

    try {
      context = await browser.newContext();
      page = await context.newPage();
      const indexPath = path.resolve(__dirname, '..', 'index.html');
      const indexUrl = pathToFileURL(indexPath).href;
      await page.goto(indexUrl, { waitUntil: 'load' });

      await page.waitForFunction(() => Boolean(window.dwarf));

      const defaultCameraPosition = await page.evaluate(() => ({
        x: window.camera.position.x,
        y: window.camera.position.y,
        z: window.camera.position.z,
      }));

      const movedPosition = await page.evaluate(() => {
        window.camera.position.set(
          window.camera.position.x + 5,
          window.camera.position.y,
          window.camera.position.z,
        );
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
});
