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

test('reads as a ring face-on and a flattened lens edge-on', async () => {
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

    const profiles = await page.evaluate(() => {
      window.scene.updateMatrixWorld(true);
      const box = new window.THREE.Box3();
      const measure = (object) => {
        const bounds = box.setFromObject(object);
        const size = bounds.getSize(new window.THREE.Vector3());
        return {
          // Face-on looks along Y, so its visible profile is X by Z.
          faceOn: { width: size.x, height: size.z },
          // Edge-on looks along Z, so its visible profile is X by Y.
          edgeOn: { width: size.x, height: size.y },
        };
      };

      return {
        innerShell: measure(window.innerShell),
        outerShell: measure(window.outerShell),
      };
    });

    for (const profile of Object.values(profiles)) {
      const faceRatio = profile.faceOn.width / profile.faceOn.height;
      const edgeRatio = profile.edgeOn.width / profile.edgeOn.height;

      expect(faceRatio).toBeGreaterThan(0.5);
      expect(faceRatio).toBeLessThan(2.0);
      expect(edgeRatio).toBeGreaterThan(1.5);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
});
