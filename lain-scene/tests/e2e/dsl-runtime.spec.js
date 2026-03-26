const { test, expect } = require('@playwright/test');

async function getState(page) {
  return page.evaluate(() => window.__lainTestApi.getState());
}

test('DSL-01: runtime loads a SceneDocument and applies a patch', async ({ page }) => {
  await page.goto('/engine/?documentUrl=./examples/demo-scene.json');
  await expect(page.locator('body')).toHaveAttribute('data-runtime-state', 'ready');
  await page.waitForFunction(() => Boolean(window.__lainTestApi?.getState));

  await expect.poll(() => getState(page).then(state => state.sceneId)).toBe('demo-scene');
  await expect.poll(() => getState(page).then(state => state.entityCount)).toBe(3);

  await page.evaluate(() => window.__lainTestApi.applyPatch([
    { op: 'remove', path: '/entities/hero' },
  ]));

  await expect.poll(() => getState(page).then(state => state.entityCount)).toBe(2);
});

