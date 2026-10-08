import { test, expect } from './fixtures';
// test/component/gridSearchSources.spec.ts
// Real Grid3D form also preserves home source routing and completion history.
for (const source of ['online', 'local', 'navidrome']) {
    test(`Grid3D preserves ${source} source without completion navigation`, async ({ mount, page }) => {
        const component = await mount('gridSearchNavigation');
        const input = component.locator('input').first();
        await expect(input).toBeVisible();
        if (source !== 'online') {
            await component.getByRole('button', { name: source === 'local' ? 'Folder' : 'Navi', exact: true }).click();
        }
        await input.fill('  race  ');
        await input.press('Enter');
        await expect.poll(() => page.evaluate(() => history.state?.search)).toEqual({ query: 'race', sourceTab: source === 'online' ? 'probe-a' : source, returnView: 'home' });
        const before = await page.evaluate(() => history.state);
        await component.getByRole('button', { name: 'Finish grid', exact: true }).click();
        await expect.poll(() => page.evaluate(() => history.state)).toEqual(before);
        expect(JSON.parse((await component.getByTestId('grid-state').textContent())!).query).toBe('race');
    });
}
