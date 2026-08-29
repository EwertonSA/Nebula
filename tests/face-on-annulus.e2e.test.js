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

test('reads as a hollow annulus from the face-on direction', async () => {
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
      Boolean(window.innerShell) &&
      Boolean(window.outerShell) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const rings = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const bounds = new window.THREE.Box3();
      const vertex = new window.THREE.Vector3();

      const percentile = (values, fraction) => {
        const index = Math.floor((values.length - 1) * fraction);
        return values[index];
      };

      const measureShell = (shell) => {
        const center = bounds.setFromObject(shell).getCenter(new window.THREE.Vector3());
        const radii = [];

        shell.traverse((object) => {
          const positions = object.geometry?.getAttribute?.('position');
          if (!object.isMesh || !positions) return;
          for (let index = 0; index < positions.count; index += 1) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
            radii.push(Math.hypot(vertex.x - center.x, vertex.z - center.z));
          }
        });

        radii.sort((a, b) => a - b);
        const innerRadius = percentile(radii, 0.05);
        const outerRadius = percentile(radii, 0.95);
        return {
          innerRadius,
          outerRadius,
          holeRatio: innerRadius / outerRadius,
          hasRingThickness: (outerRadius - innerRadius) / outerRadius,
        };
      };

      return {
        innerShell: measureShell(window.innerShell),
        outerShell: measureShell(window.outerShell),
      };
    });

    for (const shell of Object.values(rings)) {
      expect(shell.holeRatio).toBeGreaterThan(0.20);
      expect(shell.hasRingThickness).toBeGreaterThan(0.20);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
