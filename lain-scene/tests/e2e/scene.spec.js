const { test, expect } = require('@playwright/test');

async function gotoScene(page, query = '') {
  const suffix = query ? `?${query}` : '';
  await page.goto(`/${suffix}`);
  await page.waitForSelector('#renderCanvas');
  await page.waitForFunction(() => Boolean(window.__lainTestApi?.getState));
  await expect
    .poll(async () => page.locator('body').getAttribute('data-asset-state'))
    .toMatch(/ready|fallback-ready/);
}

async function getState(page) {
  return page.evaluate(() => window.__lainTestApi.getState());
}

test('BOOT-01 + WEB-01: scene boots and invalid mode falls back safely', async ({ page }) => {
  await gotoScene(page, 'mode=broken&still=1');

  await expect(page.locator('body')).toHaveAttribute('data-mode', 'awp');
  await expect(page.locator('body')).toHaveAttribute('data-invalid-mode-fallback', 'true');
  await expect(page.locator('#score')).toContainText('score: 0');
});

test('AWP-01 + AWP-02: awp fires and kills the target', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1');

  const didHit = await page.evaluate(() => window.__lainTestApi.fireAtTarget());
  expect(didHit).toBe(true);

  await expect.poll(() => getState(page).then(state => state.weaponState)).toBe('firing');
  await expect.poll(() => getState(page).then(state => state.targetState)).toBe('dead');
  await expect.poll(() => getState(page).then(state => state.score)).toBe(1);
  await page.waitForTimeout(250);
  await expect.poll(() => getState(page).then(state => state.weaponState)).toBe('idle');
});

test('SL-01: slasher hold causes movement and a hit', async ({ page }) => {
  await gotoScene(page, 'mode=slasher&still=1');

  await page.evaluate(() => window.__lainTestApi.holdSlash(1200));

  await expect.poll(() => getState(page).then(state => state.lastAction)).toBe('slash-hit');
  await expect.poll(() => getState(page).then(state => state.targetState)).toBe('dead');
});

test('AUDIO-01 + AUDIO-02 + AUDIO-03: each mode has its own looping music after user action', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1');
  const awpSource = await page.evaluate(() => document.getElementById('bgm').src);
  expect(awpSource).toContain('blob:');
  expect(await page.evaluate(() => document.getElementById('bgm').loop)).toBe(true);

  await page.evaluate(() => window.__lainTestApi.unlockAudio());
  await expect.poll(() => getState(page).then(state => state.audioState)).toMatch(/playing|ready|blocked/);

  await gotoScene(page, 'mode=slasher&still=1');
  const slasherSource = await page.evaluate(() => document.getElementById('bgm').src);
  expect(slasherSource).toContain('blob:');
  expect(slasherSource).not.toBe(awpSource);

  await page.evaluate(() => window.__lainTestApi.unlockAudio());
  await expect.poll(() => getState(page).then(state => state.audioUnlockCount)).toBeGreaterThan(0);
});

test('ASSET-01: broken target image falls back to placeholder without crashing', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1&targetImage=https%3A%2F%2Fexample.invalid%2Fmissing.png');

  await expect(page.locator('body')).toHaveAttribute('data-asset-state', 'fallback-ready');
  await expect(page.locator('#score')).toContainText('score: 0');
});

test('ASSET-02: broken music URL reports error but gameplay still works', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1&awpMusic=https%3A%2F%2Fexample.invalid%2Fmissing.mp3');

  await page.evaluate(() => window.__lainTestApi.unlockAudio());
  await expect.poll(() => getState(page).then(state => state.audioState)).toMatch(/error|blocked/);

  const didHit = await page.evaluate(() => window.__lainTestApi.fireAtTarget());
  expect(didHit).toBe(true);
  await expect.poll(() => getState(page).then(state => state.targetState)).toBe('dead');
});

test('PERF-01: frame pacing stays inside a coarse smoke budget', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1');
  await page.waitForTimeout(1500);

  const state = await getState(page);
  expect(state.frameP95).toBeLessThan(80);
});

test('VISUAL-01: awp scene snapshot stays stable', async ({ page }) => {
  await gotoScene(page, 'mode=awp&still=1');
  await expect(page).toHaveScreenshot('awp-scene.png');
});

test('VISUAL-01: slasher scene snapshot stays stable', async ({ page }) => {
  await gotoScene(page, 'mode=slasher&still=1');
  await expect(page).toHaveScreenshot('slasher-scene.png');
});
