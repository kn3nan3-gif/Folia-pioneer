import { test, expect } from './fixtures';
// Chromium uses the same real controller/navigation harness as the jsdom regression.
for (const command of ['Command', 'Command failure']) {
    test(`real search command retains pending more/retry: ${command}`, async ({ mount }) => {
        const component = await mount('aggregateSearchController');
        const state = () => component.getByTestId('state').textContent().then(text => JSON.parse(text!));
        await component.getByRole('button', { name: command, exact: true }).click();
        await expect.poll(async () => (await state()).history.search).toEqual({ query: 'race', sourceTab: 'all-online', returnView: 'player' });
        await expect.poll(async () => (await state()).sources.netease.loading).toBe(false);
        await component.getByRole('button', { name: 'More or retry', exact: true }).click();
        await expect.poll(async () => (await state()).sources.netease.loading).toBe(true);
        await component.getByRole('button', { name: 'Finish slow', exact: true }).click();
        await expect.poll(async () => (await state()).sources.kugou.loading).toBe(false);
        await expect.poll(async () => (await state()).sources.netease.loading).toBe(true);
        await component.getByRole('button', { name: 'Finish page', exact: true }).click();
        await expect.poll(async () => (await state()).results).toContain('netease-2');
        await expect.poll(async () => (await state()).sources.netease.nextOffset).toBe(2);
    });
}
for (const action of ['Close', 'New command']) {
    test(`real search command cannot navigate after ${action}`, async ({ mount }) => {
        const component = await mount('aggregateSearchController');
        const state = () => component.getByTestId('state').textContent().then(text => JSON.parse(text!));
        await component.getByRole('button', { name: 'Command', exact: true }).click();
        await expect.poll(async () => (await state()).results).toContain('netease-1');
        await component.getByRole('button', { name: action, exact: true }).click();
        const history = (await state()).history;
        await component.getByRole('button', { name: action === 'Close' ? 'Finish slow' : 'Finish previous', exact: true }).click();
        await expect.poll(async () => (await state()).history).toEqual(history);
        if (action === 'Close') await expect.poll(async () => (await state()).open).toBe(false);
        else await expect.poll(async () => (await state()).query).toBe('new');
    });
}
test('controller retains pending more through slow source and writes provider-aware queue', async ({ mount }) => {
    const component = await mount('aggregateSearchController');
    const state = () => component.getByTestId('state').textContent().then(text => JSON.parse(text!));
    await component.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect.poll(async () => (await state()).results).toContain('netease-1');
    await component.getByRole('button', { name: 'More or retry', exact: true }).click();
    await expect.poll(async () => (await state()).sources.netease.loading).toBe(true);
    await component.getByRole('button', { name: 'Finish slow', exact: true }).click();
    await expect.poll(async () => (await state()).history.search.sourceTab).toBe('all-online');
    await component.getByRole('button', { name: 'Finish page', exact: true }).click();
    await expect.poll(async () => (await state()).results).toContain('netease-2');
    await component.getByRole('button', { name: 'Queue netease', exact: true }).click();
    await component.getByRole('button', { name: 'Queue kugou', exact: true }).click();
    await component.getByRole('button', { name: 'Queue netease', exact: true }).click();
    await expect.poll(async () => (await state()).queue).toHaveLength(2);
    await expect.poll(async () => (await state()).queue.map((s: any) => s.providerId).sort()).toEqual(['kugou', 'netease']);
});
test('controller retains pending retry through slow source completion', async ({ mount }) => {
    const component = await mount('aggregateSearchController');
    const state = () => component.getByTestId('state').textContent().then(text => JSON.parse(text!));
    await component.getByRole('button', { name: 'Submit failure', exact: true }).click();
    await expect.poll(async () => (await state()).sources.netease.error).toBe('fast failure');
    await component.getByRole('button', { name: 'More or retry', exact: true }).click();
    await component.getByRole('button', { name: 'Finish slow', exact: true }).click();
    await component.getByRole('button', { name: 'Finish page', exact: true }).click();
    await expect.poll(async () => (await state()).results).toContain('netease-2');
});
