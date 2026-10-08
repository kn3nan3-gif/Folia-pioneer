import { test, expect } from './fixtures';
// Real Chromium UI, explicit main IPC mock in the probe; no claim of native-dialog coverage.
for (const [event, reason] of [['late fatal', 'LX realm: native script error'], ['destroyed', 'LX: realm destroyed'], ['renderer gone', 'LX: renderer gone']]) {
test(`open panel follows ${event} without reopening`, async ({ mount }) => {
    const root = await mount('lxSources');
    await root.getByRole('button', { name: 'LX custom sources', exact: true }).click();
    await root.getByRole('button', { name: 'Import local .js' }).click();
    await root.getByRole('checkbox').check();
    await root.getByRole('button', { name: 'Authorize & enable' }).click();
    await expect(root.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    await root.getByRole('button', { name: `Probe ${event}`, exact: true }).click();
    await expect(root.getByText('Owned.js · Disabled', { exact: true })).toBeVisible();
    await expect(root.getByRole('alert')).toContainText(reason);
    await expect(root.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
    await root.getByRole('checkbox').check();
    await expect(root.getByRole('button', { name: 'Authorize & enable' })).toBeEnabled();
});
}
test('late failure wins over an in-flight enable response', async ({ mount }) => {
    const root = await mount('lxSources');
    await root.getByRole('button', { name: 'LX custom sources', exact: true }).click();
    await root.getByRole('button', { name: 'Import local .js' }).click();
    await root.getByRole('checkbox').check();
    await root.getByRole('button', { name: 'Probe delay enable', exact: true }).click();
    await root.getByRole('button', { name: 'Authorize & enable' }).click();
    await root.getByRole('button', { name: 'Probe destroyed', exact: true }).click();
    await root.getByRole('button', { name: 'Probe finish enable', exact: true }).click();
    await expect(root.getByText('Owned.js · Disabled', { exact: true })).toBeVisible();
    await expect(root.getByRole('alert')).toContainText('LX: realm destroyed');
    await root.getByRole('checkbox').check();
    await expect(root.getByRole('button', { name: 'Authorize & enable' })).toBeEnabled();
});
test('local import needs digest-bound approval and persists management state', async ({ mount, page }) => {
    const root = await mount('lxSources');
    await root.getByRole('button', { name: 'LX custom sources', exact: true }).click();
    await root.getByRole('button', {name:'Import local .js'}).click();
    const enable = root.getByRole('button',{name:'Authorize & enable'});
    await expect(enable).toBeDisabled();
    await expect(root.getByText(/NOT an untrusted-code sandbox/)).toBeVisible();
    await expect(root.getByText(/lexical-1/)).toBeVisible();
    await root.getByRole('textbox').fill('owned.example');
    await root.getByRole('checkbox').check(); await expect(enable).toBeEnabled(); await enable.click();
    await expect(root.getByRole('button',{name:'Disable',exact:true})).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lx-probe-approval') || '{}'))).toEqual({digest:'a'.repeat(64),reviewVersion:'lexical-1',riskVersion:'browser-webrtc-1',acknowledged:true});
    const persisted = await page.evaluate(() => localStorage.getItem('lx-probe-records'));
    await page.addInitScript(value => { if (value) localStorage.setItem('lx-probe-records', value); }, persisted);
    await mount('lxSources');
    await page.getByRole('button',{name:'LX custom sources',exact:true}).click();
    await expect(page.getByRole('textbox')).toHaveValue('owned.example');
    await page.getByRole('button',{name:'Disable',exact:true}).click();
    await expect(page.getByRole('button',{name:'Authorize & enable'})).toBeDisabled();
    page.once('dialog', d=>d.accept()); await page.getByRole('button',{name:'Remove',exact:true}).click();
    await expect(page.getByText('Owned.js · Disabled')).toHaveCount(0);
});
