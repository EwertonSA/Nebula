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

test("keeps the white dwarf markedly smaller than either shell", async () => {
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

    const dimensions = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const box = new window.THREE.Box3();
      const size = (object) => box.setFromObject(object).getSize(new window.THREE.Vector3());
      const dwarfSize = size(window.dwarf);
      const innerSize = size(window.innerShell);
      const outerSize = size(window.outerShell);

      return {
        dwarf: dwarfSize.toArray(),
        inner: innerSize.toArray(),
        outer: outerSize.toArray(),
      };
    });

    const dwarfMaxDimension = Math.max(...dimensions.dwarf);
    const innerMaxDimension = Math.max(...dimensions.inner);
    const outerMaxDimension = Math.max(...dimensions.outer);

    expect(dwarfMaxDimension).toBeLessThan(innerMaxDimension * 0.5);
    expect(dwarfMaxDimension).toBeLessThan(outerMaxDimension * 0.5);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
