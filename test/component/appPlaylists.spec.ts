import { test, expect } from './fixtures';
// Real Chromium business component; remote lookup/audio are explicit mocks in the probe.
for (const action of ['External replace entries', 'External replace and release']) {
    test(`same ID entries change invalidates pending playback: ${action}`, async ({ mount, page }) => {
        const component = await mount('appPlaylists');
        await component.getByRole('button', { name: 'Application lists', exact: true }).click();
        const dialog = component.getByRole('dialog');
        await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('A');
        await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
        await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
        await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
        const id = await dialog.getByRole('combobox').inputValue();
        await component.getByRole('button', { name: 'Hold lookup', exact: true }).click({ force: true });
        await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
        await expect(component.getByTestId('pending-lookups')).toHaveText('1');
        await component.getByRole('button', { name: action, exact: true }).click({ force: true });
        await expect(component.getByTestId('external-changes')).toHaveText('1');
        await expect(dialog.getByRole('combobox')).toHaveValue(id);
        await expect(dialog.getByTestId('playlist-entry')).toContainText('Local-1');
        if (action === 'External replace entries') {
            await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled({ timeout: 1000 });
            await component.getByRole('button', { name: 'Release lookup', exact: true }).click({ force: true });
        }
        await expect(component.getByTestId('pending-lookups')).toHaveText('0');
        await page.waitForTimeout(300); // Allow erroneous real onPlay/queue commits to surface.
        await expect(component.getByTestId('play-calls')).toHaveText('0', { timeout: 1000 });
        await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['online:netease:1', 'online:kugou:1', 'local:file-1', 'navidrome:remote-1']);
        await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled({ timeout: 1000 });
        await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
        await expect(component.getByTestId('play-calls')).toHaveText('1');
        await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['local:file-1']);
    });
}
test('same ID rename and equivalent store refresh do not cancel pending playback', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('A');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    await component.getByRole('button', { name: 'Hold lookup', exact: true }).click({ force: true });
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(component.getByTestId('pending-lookups')).toHaveText('1');
    for (const [index, action] of ['External rename', 'External refresh'].entries()) {
        await component.getByRole('button', { name: action, exact: true }).click({ force: true });
        await expect(component.getByTestId('external-changes')).toHaveText(String(index + 1));
        await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeDisabled();
    }
    await component.getByRole('button', { name: 'Release lookup', exact: true }).click({ force: true });
    await expect(component.getByTestId('play-calls')).toHaveText('1');
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['online:netease:1']);
    await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled();
});
test('closed A resolves after reopened B without replacing its real playback queue', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('A');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    const a = await dialog.getByRole('combobox').inputValue();
    await component.getByRole('button', { name: 'Use local queue', exact: true }).click({ force: true });
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('B');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toContainText('Local-1');
    const b = await dialog.getByRole('combobox').inputValue();
    await dialog.getByRole('combobox').selectOption(a);
    await component.getByRole('button', { name: 'Hold lookup', exact: true }).click({ force: true });
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(component.getByTestId('pending-lookups')).toHaveText('1');
    await dialog.getByRole('button', { name: 'Close lists', exact: true }).click();
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    await dialog.getByRole('combobox').selectOption(b);
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['local:file-1']);
    await component.getByRole('button', { name: 'Release lookup', exact: true }).click({ force: true });
    await expect(component.getByTestId('pending-lookups')).toHaveText('0');
    await page.waitForTimeout(300); // Allow the real async queue controller to commit an erroneous late play.
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['local:file-1']);
    await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled({ timeout: 1000 });
});
test('server configuration change invalidates pending playback and restores UI without store rerender', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Pending');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    await component.getByRole('button', { name: 'Hold lookup', exact: true }).click({ force: true });
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(component.getByTestId('pending-lookups')).toHaveText('1');
    await component.getByRole('button', { name: 'Config only B', exact: true }).click({ force: true });
    await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled({ timeout: 1000 });
    await component.getByRole('button', { name: 'Release lookup', exact: true }).click({ force: true });
    await expect(component.getByTestId('pending-lookups')).toHaveText('0');
    await page.waitForTimeout(300); // Allow the real async queue controller to commit an erroneous late play.
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['online:netease:1', 'online:kugou:1', 'local:file-1', 'navidrome:remote-1']);
});
test('hanging lookup times out as unknown, restores controls and permits subsequent local playback', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Timeout');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    await component.getByRole('button', { name: 'Hold lookup', exact: true }).click({ force: true });
    await page.clock.install();
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(component.getByTestId('pending-lookups')).toHaveText('1');
    await page.clock.fastForward(5000);
    await expect(dialog.getByRole('status')).toContainText('Availability unknown: 1');
    await expect(dialog.getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    await component.getByRole('button', { name: 'Use local queue', exact: true }).click({ force: true });
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Local after timeout');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toContainText('Local-1');
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['local:file-1']);
    await component.getByRole('button', { name: 'Release lookup', exact: true }).click({ force: true });
    await page.clock.runFor(300);
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['local:file-1']);
});
test('server switch preserves A ownership for current, queue and search saves; restore never plays B same ID', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Switch server B', exact: true }).click();
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('A songs');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Save mixed queue', exact: true }).click();
    await dialog.getByText('Search results', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Add to list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const data = JSON.parse(await dialog.getByRole('textbox', { name: 'Reference JSON', exact: true }).inputValue());
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].navidromeRef.serverUrl).toBe('https://navi.fixture');
    await dialog.getByRole('button', { name: 'Import as new list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('Unavailable references retained: 1');
    await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
});
test('offline/deleted vs transient unknown are visible and references survive', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Status');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add current song', exact: true }).click();
    for (const [action, message] of [['Provider offline', 'Unavailable references retained: 1'], ['Provider temporary failure', 'Availability unknown: 1'], ['Song deleted', 'Unavailable references retained: 1']]) {
        await component.getByRole('button', { name: action, exact: true }).click({ force: true });
        await dialog.getByRole('button', { name: 'Play whole list', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText(message);
        await expect(dialog.getByTestId('playlist-entry')).toHaveCount(1);
    }
});
test('create/add/rename/order/remove/import/export/restart/delete and whole mixed queue', async ({ mount, page }) => {
    let component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = () => component.getByRole('dialog');
    await dialog().getByRole('textbox', { name: 'List name', exact: true }).fill('Mix');
    await dialog().getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(dialog().getByRole('combobox')).toHaveValue(/.+/);
    await dialog().getByRole('button', { name: 'Add current song', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(1);
    await dialog().getByRole('button', { name: 'Save mixed queue', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(4);
    await dialog().getByText('Search results', { exact: true }).click();
    await dialog().getByRole('button', { name: 'Add to list', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(5);
    await dialog().getByRole('textbox', { name: 'List name', exact: true }).fill('Renamed');
    await dialog().getByRole('button', { name: 'Rename list', exact: true }).click();
    await expect(dialog().getByRole('combobox').locator('option')).toHaveText(['Renamed']);
    await dialog().getByTestId('playlist-entry').nth(1).getByRole('button', { name: 'Move up', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry').first()).toContainText('kugou-1');
    await dialog().getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue).toEqual(['online:kugou:1', 'online:netease:1', 'local:file-1', 'navidrome:remote-1', 'online:qq:1']);
    await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).current).toBe('online:kugou:1');
    // Start from local and Navidrome too: real controller must pass the entire mixed unifiedQueue.
    for (const name of ['Local-1', 'Navi-1']) {
        let row = dialog().getByTestId('playlist-entry').filter({ hasText: name });
        for (let i = 0; i < (name === 'Local-1' ? 2 : 3); i++) {
            await row.getByRole('button', { name: 'Move up', exact: true }).click();
            await expect(dialog().getByRole('button', { name: 'Play whole list', exact: true })).toBeEnabled();
        }
        await dialog().getByRole('button', { name: 'Play whole list', exact: true }).click();
        await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue[0]).toBe(name === 'Local-1' ? 'local:file-1' : 'navidrome:remote-1');
        await expect.poll(async () => JSON.parse((await component.getByTestId('business').textContent())!).queue.length).toBe(5);
    }
    await dialog().getByTestId('playlist-entry').last().getByRole('button', { name: 'Remove song', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(4);
    await dialog().getByRole('button', { name: 'Export JSON', exact: true }).click();
    const json = await dialog().getByRole('textbox', { name: 'Reference JSON', exact: true }).inputValue();
    expect(JSON.parse(json).entries).toHaveLength(4);
    expect(json).not.toMatch(/streamUrl|audioSrc|passwordHash|cookie|fixture.invalid/);
    await dialog().getByRole('button', { name: 'Import as new list', exact: true }).click();
    await expect(dialog().getByRole('combobox').locator('option')).toHaveCount(2);
    await page.reload();
    component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    await expect(dialog().getByRole('combobox').locator('option')).toHaveCount(2);
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(4);
    page.once('dialog', prompt => prompt.accept());
    await dialog().getByRole('button', { name: 'Delete list', exact: true }).click();
    await expect(dialog().getByRole('combobox').locator('option')).toHaveCount(1);
});
test('Chromium rejects an uncommitted write and keeps the durable list unchanged', async ({ mount, page }) => {
    const component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = component.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Original');
    await dialog.getByRole('button', { name: 'Create list', exact: true }).click();
    await expect(dialog.getByRole('combobox').locator('option')).toHaveText(['Original']);
    // Inject failure at the actual IndexedDB request boundary, not the service/store.
    await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException('disk-full', 'QuotaExceededError'); }; });
    await dialog.getByRole('textbox', { name: 'List name', exact: true }).fill('Unsaved');
    await dialog.getByRole('button', { name: 'Rename list', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('disk-full');
    await expect(dialog.getByRole('combobox').locator('option')).toHaveText(['Original']);
});
test('invalid import is visible and missing local references survive playback and reload', async ({ mount, page }) => {
    let component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    const dialog = () => component.getByRole('dialog');
    await dialog().getByRole('textbox', { name: 'Reference JSON', exact: true }).fill('{');
    await dialog().getByRole('button', { name: 'Import as new list', exact: true }).click();
    await expect(dialog().getByRole('alert')).toContainText('Action failed');
    const json = JSON.stringify({ format: 'folia-app-playlist', version: 1, name: 'Missing', entries: [{ key: 'local:missing', sourceRef: { kind: 'local', mediaId: 'missing' }, localRef: { songId: 'missing' }, snapshot: { id: 1, name: 'Missing file', artists: [], album: { id: 1, name: '' }, durationMs: 100 } }] });
    await dialog().getByRole('textbox', { name: 'Reference JSON', exact: true }).fill(json);
    await dialog().getByRole('button', { name: 'Import as new list', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(1);
    await dialog().getByRole('button', { name: 'Play whole list', exact: true }).click();
    await expect(dialog().getByRole('status')).toContainText('Unavailable references retained: 1');
    await expect(dialog().getByTestId('playlist-entry')).toHaveCount(1);
    await page.reload(); component = await mount('appPlaylists');
    await component.getByRole('button', { name: 'Application lists', exact: true }).click();
    await expect(dialog().getByTestId('playlist-entry')).toContainText('Missing file');
});
