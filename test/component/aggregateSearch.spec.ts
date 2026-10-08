import { test, expect } from './fixtures';
// Real Chromium component interactions against the existing StrictMode probe gallery.
test('aggregate selection, progressive results, retry, independent more and playback events', async ({ mount }) => {
    const component = await mount('aggregateSearch');
    await component.getByRole('button', { name: 'All online sources', exact: true }).click();
    await expect(component.getByRole('button', { name: 'netease track 1', exact: true })).toBeVisible();
    const kugou = component.locator('[data-search-provider="kugou"]');
    await expect(kugou.getByText('Searching', { exact: true })).toBeVisible();
    await expect(kugou.getByRole('button', { name: 'Retry' })).toBeVisible();
    await kugou.getByRole('button', { name: 'Retry' }).click();
    await expect(component.getByRole('button', { name: 'kugou track 1', exact: true })).toBeVisible();
    const netease = component.locator('[data-search-provider="netease"]');
    await netease.getByRole('button', { name: 'Load More', exact: true }).click();
    await expect(component.getByRole('button', { name: 'netease track 2', exact: true })).toBeVisible();
    await expect(kugou.getByText('1 tracks', { exact: true })).toBeVisible();
    await component.getByRole('button', { name: 'kugou track 1', exact: true }).click();
    await expect(component.getByTestId('playback-event')).toHaveText('play:kugou:1');
    const row = component.getByRole('button', { name: 'kugou track 1', exact: true }).locator('..').locator('..').locator('..');
    await row.hover();
    await row.getByTitle('Add to Queue', { exact: true }).click();
    await expect(component.getByTestId('playback-event')).toHaveText('queue:kugou:1');
});
