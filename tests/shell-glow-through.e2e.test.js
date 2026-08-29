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

test('configures both shells to let the white dwarf glow show through', async () => {
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
      Boolean(window.outerShell) &&
      Boolean(window.dwarf) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const shellMaterials = await page.evaluate(() => {
      const materialsFor = (shell) => {
        const materials = [];
        shell.traverse((object) => {
          if (!object.isMesh || !object.material) return;
          const assignedMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of assignedMaterials) {
            if (material) {
              materials.push({
                transparent: material.transparent,
                opacity: material.opacity,
              });
            }
          }
        });
        return materials;
      };

      return {
        inner: materialsFor(window.innerShell),
        outer: materialsFor(window.outerShell),
      };
    });

    expect(shellMaterials.inner.length).toBeGreaterThan(0);
    expect(shellMaterials.outer.length).toBeGreaterThan(0);

    for (const material of [...shellMaterials.inner, ...shellMaterials.outer]) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(1);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
