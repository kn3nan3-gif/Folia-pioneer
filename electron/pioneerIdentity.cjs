const path = require('node:path');
const fs = require('node:fs');
// Folia-pioneer desktop identity: set paths before any Electron store or session is opened.
function configurePioneerIdentity(app, fileSystem = fs) {
  app.setName('Folia-pioneer');
  const dataPath = path.join(app.getPath('appData'), 'Folia-pioneer');
  fileSystem.mkdirSync(dataPath, { recursive: true });
  app.setPath('userData', dataPath);
  app.setPath('sessionData', dataPath);
}

module.exports = { configurePioneerIdentity };
