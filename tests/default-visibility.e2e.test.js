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

test('keeps the white dwarf and both shells visible against the background', async () => {
  let context;
  let page;

  try {
    context = await browser.newContext();
    page = await context.newPage();
    const indexUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(indexUrl, { waitUntil: 'load' });

    await page.waitForFunction(() => (
      Boolean(window.THREE) &&
      Boolean(window.scene) &&
      Boolean(window.camera) &&
      Boolean(window.dwarf) &&
      Boolean(window.innerShell) &&
      Boolean(window.outerShell) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const luminance = await page.evaluate(() => {
      const rgbFrom = (value) => {
        if (!value) return null;
        if (value.value !== undefined && value.r === undefined) return rgbFrom(value.value);
        if (typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number') {
          return [value.r, value.g, value.b];
        }
        if (Array.isArray(value) || ArrayBuffer.isView(value)) {
          return value.length >= 3 ? [value[0], value[1], value[2]] : null;
        }
        return null;
      };

      const materialLuminance = (material) => {
        const colors = [material.color, material.emissive];
        if (material.uniforms) {
          for (const uniform of Object.values(material.uniforms)) colors.push(uniform);
        }

        return Math.max(0, ...colors
          .map(rgbFrom)
          .filter(Boolean)
          .map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b));
      };

      const objectLuminance = (object) => {
        let brightest = 0;
        object.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) brightest = Math.max(brightest, materialLuminance(material));
        });
        return brightest;
      };

      return {
        dwarf: objectLuminance(window.dwarf),
        innerShell: objectLuminance(window.innerShell),
        outerShell: objectLuminance(window.outerShell),
      };
    });

    const minThreshold = 0.02;
    expect(luminance.dwarf).toBeGreaterThan(minThreshold);
    expect(luminance.innerShell).toBeGreaterThan(minThreshold);
    expect(luminance.outerShell).toBeGreaterThan(minThreshold);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
