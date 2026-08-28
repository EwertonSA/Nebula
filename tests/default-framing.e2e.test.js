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

test('keeps both shells and the white dwarf inside the default camera frame', async () => {
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
      Boolean(window.innerShell) &&
      Boolean(window.outerShell) &&
      Boolean(window.dwarf) &&
      window.innerShell.userData.loaded === true &&
      window.outerShell.userData.loaded === true
    ));

    const frameStatus = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      window.camera.updateMatrixWorld(true);
      window.camera.updateProjectionMatrix();

      const projectionView = new window.THREE.Matrix4().multiplyMatrices(
        window.camera.projectionMatrix,
        window.camera.matrixWorldInverse,
      );
      const frustum = new window.THREE.Frustum().setFromProjectionMatrix(projectionView);
      const box = new window.THREE.Box3();
      const corner = new window.THREE.Vector3();

      const cornersInsideFrustum = (object) => {
        box.setFromObject(object);
        const { min, max } = box;
        const corners = [
          [min.x, min.y, min.z], [min.x, min.y, max.z],
          [min.x, max.y, min.z], [min.x, max.y, max.z],
          [max.x, min.y, min.z], [max.x, min.y, max.z],
          [max.x, max.y, min.z], [max.x, max.y, max.z],
        ];

        return corners.every(([x, y, z]) => (
          frustum.containsPoint(corner.set(x, y, z))
        ));
      };

      return {
        innerShell: cornersInsideFrustum(window.innerShell),
        outerShell: cornersInsideFrustum(window.outerShell),
        dwarf: cornersInsideFrustum(window.dwarf),
      };
    });

    expect(frameStatus.innerShell).toBe(true);
    expect(frameStatus.outerShell).toBe(true);
    expect(frameStatus.dwarf).toBe(true);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
