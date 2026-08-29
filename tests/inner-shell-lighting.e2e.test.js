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

test('configures the inner shell for directional volumetric glow', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });

    await page.waitForFunction(() => (
      Boolean(window.THREE) &&
      Boolean(window.innerShell) &&
      Boolean(window.dwarf) &&
      window.innerShell.userData.loaded === true
    ));

    const materials = await page.evaluate(() => {
      const found = [];
      window.innerShell.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const assigned = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of assigned) {
          if (!material) continue;
          found.push({
            isShaderMaterial: material.isShaderMaterial === true,
            transparent: material.transparent === true,
            opacity: material.opacity,
            blending: material.blending,
            intensity: material.uniforms?.uIntensity?.value,
          });
        }
      });
      return {
        materials: found,
        additiveBlending: window.THREE.AdditiveBlending,
      };
    });

    expect(materials.materials.length).toBeGreaterThan(0);
    for (const material of materials.materials) {
      expect(material.isShaderMaterial).toBe(true);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(1);
      expect(material.blending).toBe(materials.additiveBlending);
      expect(material.intensity).toBeGreaterThan(0);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
