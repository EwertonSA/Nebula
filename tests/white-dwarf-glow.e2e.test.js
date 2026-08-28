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

test('renders the white dwarf with an active emissive glow', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });

    await page.waitForFunction(() => (
      Boolean(window.dwarf) && Boolean(window.THREE)
    ));

    const materialInfo = await page.evaluate(() => {
      let info = null;

      window.dwarf.traverse((object) => {
        if (info || !object.isMesh || !object.material) return;
        const material = Array.isArray(object.material)
          ? object.material.find(Boolean)
          : object.material;
        if (!material) return;

        info = {
          isMeshBasicMaterial: material.isMeshBasicMaterial === true,
          emissiveIntensity: material.emissiveIntensity ?? 0,
          emissiveHex: material.emissive?.getHex() ?? 0,
          hasEmissiveMap: Boolean(material.emissiveMap),
        };
      });

      return info;
    });

    expect(materialInfo).not.toBeNull();
    expect(
      materialInfo.isMeshBasicMaterial ||
      materialInfo.emissiveIntensity > 0 ||
      materialInfo.emissiveHex !== 0 ||
      materialInfo.hasEmissiveMap,
    ).toBe(true);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
