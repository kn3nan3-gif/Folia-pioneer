const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
// Independent desktop identity and updater boundary regression tests (no installed dependencies).
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('desktop packaging has a separate identity and no release publisher', () => {
  assert.equal(pkg.name, 'folia-pioneer');
  assert.equal(pkg.productName, 'Folia-pioneer');
  assert.equal(pkg.build.productName, pkg.productName);
  assert.equal(pkg.build.appId, 'local.folia.pioneer');
  assert.equal(pkg.desktopName, 'folia-pioneer.desktop');
  assert.equal(pkg.build.linux.executableName, pkg.name);
  assert.equal(pkg.build.linux.desktop.entry.StartupWMClass, pkg.name);
  assert.deepEqual(pkg.build.publish, []);
  assert.deepEqual(pkg.build.linux.publish, []);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(pkg.author.name, 'chthollyphile');
  assert.equal(pkg.license, 'AGPL-3.0');
});

test('desktop data is isolated before stores open', () => {
  const { configurePioneerIdentity } = require('../electron/pioneerIdentity.cjs');
  const paths = { appData: '/profiles', userData: '/profiles/Folia', sessionData: '/profiles/Folia' };
  let name;
  let created;
  configurePioneerIdentity({ setName: value => { name = value; }, getPath: key => paths[key], setPath: (key, value) => { assert.equal(created, value); paths[key] = value; } }, { mkdirSync: value => { created = value; } });
  assert.equal(name, 'Folia-pioneer');
  assert.equal(paths.userData, path.join('/profiles', 'Folia-pioneer'));
  assert.equal(paths.sessionData, paths.userData);
  const main = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');
  assert.ok(main.indexOf('configurePioneerIdentity(app);') < main.indexOf('const store = new Store'));
  assert.match(main, /new Store\(\{ projectName: 'Folia-pioneer' \}/);
});

test('manual, automatic, preview and download update paths cannot reach upstream', async () => {
  const main = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');
  const updaterCode = main.slice(main.indexOf('function getUpdateCheckEnabled()'), main.indexOf('function getGeminiResponseSchema()'));
  const channels = require('../electron/updateChannels.cjs');
  for (const channel of ['realeco', 'limo', 'cielo', 'internal']) {
    const context = { ...channels, app: { getVersion: () => '0.7.13', isPackaged: true },
      store: { get: () => channel, set: () => {} }, process: { platform: 'win32', env: { ELECTRON_DEV: 'true', FOLIA_DEV_UPDATE_PREVIEW: 'true' } },
      ENABLE_UPDATE_CHECK_SETTING_KEY: 'check', ENABLE_AUTO_UPDATE_SETTING_KEY: 'auto', UPDATE_CHANNEL_SETTING_KEY: 'lane', LAST_SEEN_UPDATE_VERSION_SETTING_KEY: 'seen',
      FOLIA_RELEASES_URL: null, FOLIA_GITHUB_REPOSITORY: null, mainWindow: null, autoUpdater: null,
      require: () => { throw new Error('updater must never load'); },
      session: { fromPartition: () => { throw new Error('network must never open'); } },
      shell: { openExternal: () => { throw new Error('release URL must never open'); } }, console, setTimeout: () => { throw new Error('no update timer'); } };
    vm.createContext(context);
    vm.runInContext(updaterCode, context);
    assert.equal(context.isUpdateCheckSupported(), false);
    assert.equal(context.isDevUpdatePreviewEnabled(), false);
    assert.equal(context.ensureAutoUpdater(), null);
    assert.equal((await context.checkForUpdates({ manual: true })).status, 'unsupported');
    assert.equal((await context.downloadAvailableUpdate()).status, 'unsupported');
    assert.equal((await context.checkForManualUpdateAvailability()).status, 'unsupported');
    assert.equal(await context.openUpdateReleasePage('999.0.0'), false);
    context.scheduleStartupUpdateCheck();
  }
});
