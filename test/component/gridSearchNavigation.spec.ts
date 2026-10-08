import { test, expect } from './fixtures';
// test/component/gridSearchNavigation.spec.ts
// Submit the shipped Grid3D form, not a replacement business handler.
for (const action of ['Close grid search', 'Edit query', 'Aggregate next', 'Aggregate failure']) {
    test(`Grid3D late completion does not navigate after ${action}`, async ({ mount, page }) => {
        const component = await mount('gridSearchNavigation');
        const input = component.locator('input').first();
        await expect(input).toBeVisible();
        await input.fill('  race  ');
        await input.press('Enter');
        const state = async () => JSON.parse((await component.getByTestId('grid-state').textContent())!);
        await expect.poll(async () => (await state()).open).toBe(true);
        expect((await state()).query).toBe('race');
        await expect.poll(() => page.evaluate(() => history.state?.search)).toEqual({ query: 'race', sourceTab: 'probe-a', returnView: 'home' });
        await component.getByRole('button', { name: action, exact: true }).click();
        if (action.startsWith('Aggregate')) {
            await expect.poll(async () => (await state()).sources.netease.loading).toBe(false);
            await component.getByRole('button', { name: 'More retry', exact: true }).click();
            await expect.poll(async () => (await state()).sources.netease.loading).toBe(true);
        }
        const before = await page.evaluate(() => history.state);
        const requestId = (await state()).requestId;
        await component.getByRole('button', { name: 'Finish grid', exact: true }).click();
        await expect.poll(() => page.evaluate(() => history.state)).toEqual(before);
        expect((await state()).requestId).toBe(requestId);
        if (action === 'Close grid search') expect((await state()).open).toBe(false);
        else if (action === 'Edit query') expect((await state()).query).toBe('new');
        else {
            await component.getByRole('button', { name: 'Finish aggregate slow', exact: true }).click();
            await expect.poll(async () => (await state()).sources.kugou.loading).toBe(false);
            expect((await state()).sources.netease.loading).toBe(true);
            await component.getByRole('button', { name: 'Finish more', exact: true }).click();
            await expect.poll(async () => (await state()).results).toContain('netease-2');
        }
    });
}
test('Grid3D empty query does not navigate or execute search', async ({ mount, page }) => {
    const component = await mount('gridSearchNavigation');
    const input = component.locator('input').first();
    await expect(input).toBeVisible();
    const before = await page.evaluate(() => history.state);
    await input.fill('   ');
    await input.press('Enter');
    await component.getByRole('button', { name: 'Finish grid', exact: true }).click();
    expect(await page.evaluate(() => history.state)).toEqual(before);
    expect(JSON.parse((await component.getByTestId('grid-state').textContent())!).open).toBe(false);
});
