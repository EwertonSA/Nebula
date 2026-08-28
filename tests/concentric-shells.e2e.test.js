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

test('renders distinct concentric inner and outer shells around the white dwarf', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });

    await page.waitForFunction(() => (
      Boolean(window.dwarf) &&
      Boolean(window.innerShell) &&
      Boolean(window.outerShell) &&
      Boolean(window.THREE) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const geometry = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const box = new window.THREE.Box3();
      const measure = (object) => {
        const objectBox = box.setFromObject(object);
        return {
          center: objectBox.getCenter(new window.THREE.Vector3()).toArray(),
          size: objectBox.getSize(new window.THREE.Vector3()).toArray(),
        };
      };

      return {
        dwarf: measure(window.dwarf),
        inner: measure(window.innerShell),
        outer: measure(window.outerShell),
      };
    });

    for (const axis of [0, 1, 2]) {
      expect(Math.abs(geometry.dwarf.center[axis] - geometry.inner.center[axis]))
        .toBeLessThan(0.5);
      expect(Math.abs(geometry.dwarf.center[axis] - geometry.outer.center[axis]))
        .toBeLessThan(0.5);
    }

    const innerDiameter = Math.max(...geometry.inner.size);
    const outerDiameter = Math.max(...geometry.outer.size);
    expect(outerDiameter).toBeGreaterThan(innerDiameter);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
