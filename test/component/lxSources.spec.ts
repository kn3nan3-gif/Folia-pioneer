import { test, expect } from './fixtures';
// Real Chromium UI, explicit main IPC mock in the probe; no claim of native-dialog coverage.
test('local import needs digest-bound approval and persists management state', async ({ mount, page }) => {
    const root = await mount('lxSources');
    await root.getByRole('button', { name: 'LX custom sources', exact: true }).click();
    await root.getByRole('button', {name:'Import local .js'}).click();
    const enable = root.getByRole('button',{name:'Authorize & enable'});
    await expect(enable).toBeDisabled();
    await root.getByRole('textbox').fill('owned.example');
    await root.getByRole('checkbox').check(); await expect(enable).toBeEnabled(); await enable.click();
    await expect(root.getByRole('button',{name:'Disable',exact:true})).toBeVisible();
    const persisted = await page.evaluate(() => localStorage.getItem('lx-probe-records'));
    await page.addInitScript(value => { if (value) localStorage.setItem('lx-probe-records', value); }, persisted);
    await page.reload(); await mount('lxSources');
    await page.getByRole('button',{name:'LX custom sources',exact:true}).click();
    await expect(page.getByRole('textbox')).toHaveValue('owned.example');
    await page.getByRole('button',{name:'Disable',exact:true}).click();
    await expect(page.getByRole('button',{name:'Authorize & enable'})).toBeDisabled();
    page.once('dialog', d=>d.accept()); await page.getByRole('button',{name:'Remove',exact:true}).click();
    await expect(page.getByText('Owned.js · Disabled')).toHaveCount(0);
});
