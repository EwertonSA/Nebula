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

test('places the white dwarf at the geometric center of both shells', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });

    await page.waitForFunction(() => (
      Boolean(window.scene) &&
      Boolean(window.THREE) &&
      Boolean(window.dwarf) &&
      Boolean(window.innerShell) &&
      Boolean(window.outerShell) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const centers = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const box = new window.THREE.Box3();
      const center = (object) => box.setFromObject(object).getCenter(new window.THREE.Vector3());
      const dwarfCenter = center(window.dwarf);
      const innerCenter = center(window.innerShell);
      const outerCenter = center(window.outerShell);

      return {
        dwarf: dwarfCenter.toArray(),
        inner: innerCenter.toArray(),
        outer: outerCenter.toArray(),
      };
    });

    for (const axis of [0, 1, 2]) {
      expect(Math.abs(centers.dwarf[axis] - centers.inner[axis])).toBeLessThan(0.5);
      expect(Math.abs(centers.dwarf[axis] - centers.outer[axis])).toBeLessThan(0.5);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
