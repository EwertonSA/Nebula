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

test("uses a larger, nested radius for the outer shell", async () => {
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

    const shellGeometry = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const box = new window.THREE.Box3();
      const vertex = new window.THREE.Vector3();

      const measure = (shell) => {
        const shellBox = box.setFromObject(shell);
        const center = shellBox.getCenter(new window.THREE.Vector3());
        let maxRadius = 0;

        shell.traverse((object) => {
          const positions = object.geometry?.getAttribute?.('position');
          if (!object.isMesh || !positions) return;
          for (let index = 0; index < positions.count; index += 1) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
            maxRadius = Math.max(maxRadius, vertex.distanceTo(center));
          }
        });

        return { center: center.toArray(), maxRadius };
      };

      return {
        inner: measure(window.innerShell),
        outer: measure(window.outerShell),
      };
    });

    expect(shellGeometry.outer.maxRadius)
      .toBeGreaterThan(shellGeometry.inner.maxRadius);

    const centerDistance = Math.sqrt(
      shellGeometry.outer.center.reduce(
        (sum, coordinate, axis) => sum + (coordinate - shellGeometry.inner.center[axis]) ** 2,
        0,
      ),
    );
    expect(centerDistance).toBeLessThan(shellGeometry.outer.maxRadius / 2);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
