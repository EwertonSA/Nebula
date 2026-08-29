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

test('renders the inner shell brighter or more opaque than the outer shell', async () => {
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
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const shellStrength = await page.evaluate(() => {
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

      const measure = (shell) => {
        let maxLuminance = 0;
        let maxOpacity = 0;
        shell.traverse((object) => {
          if (!object.isMesh || !object.material) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (!material) continue;
            maxOpacity = Math.max(maxOpacity, material.opacity ?? 1);
            const values = [material.color, material.emissive];
            if (material.uniforms) values.push(...Object.values(material.uniforms));
            for (const value of values) {
              const rgb = rgbFrom(value);
              if (!rgb) continue;
              const [r, g, b] = rgb;
              maxLuminance = Math.max(maxLuminance, 0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
          }
        });
        return { maxLuminance, opacity: maxOpacity };
      };

      return {
        inner: measure(window.innerShell),
        outer: measure(window.outerShell),
      };
    });

    expect(
      shellStrength.inner.maxLuminance > shellStrength.outer.maxLuminance ||
      shellStrength.inner.opacity > shellStrength.outer.opacity,
    ).toBe(true);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
