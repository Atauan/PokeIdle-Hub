'use strict';

const path = require('path');
const fs = require('fs');

function migrateLegacySessions({ userDataPath, portableExecutableDir } = {}) {
  try {
    const currentDataDir = userDataPath;
    const parentDir = path.dirname(currentDataDir);
    const partitionsDir = path.join(currentDataDir, 'Partitions');

    const candidateDirs = [];
    if (portableExecutableDir) candidateDirs.push(path.join(portableExecutableDir, 'data'));
    candidateDirs.push(
      path.join(parentDir, 'PokeFarm'),
      path.join(parentDir, 'pokefarm'),
      path.join(parentDir, 'PokeFarm-Hub')
    );

    for (const legacyDir of candidateDirs) {
      if (!fs.existsSync(legacyDir)) continue;

      const currentLocalStorage = path.join(currentDataDir, 'Local Storage');
      const legacyLocalStorage = path.join(legacyDir, 'Local Storage');
      const currentLevelDb = path.join(currentLocalStorage, 'leveldb');
      const hasCurrentLevelDb = fs.existsSync(currentLevelDb) && fs.readdirSync(currentLevelDb).length > 2;

      if (!hasCurrentLevelDb && fs.existsSync(legacyLocalStorage)) {
        try {
          if (!fs.existsSync(currentLocalStorage)) fs.mkdirSync(currentLocalStorage, { recursive: true });
          fs.cpSync(legacyLocalStorage, currentLocalStorage, { recursive: true });
        } catch (_) { /* mantém a inicialização mesmo se a cópia de preferências falhar */ }
      }

      const legacyPartitions = path.join(legacyDir, 'Partitions');
      if (fs.existsSync(legacyPartitions)) {
        try {
          if (!fs.existsSync(partitionsDir)) fs.mkdirSync(partitionsDir, { recursive: true });
          const legacyEntries = fs.readdirSync(legacyPartitions, { withFileTypes: true });
          for (const entry of legacyEntries) {
            if (!entry.isDirectory()) continue;
            let destinationName = null;
            if (entry.name === 'pokefarm' || entry.name === 'pokeidlehub') {
              destinationName = 'pokeidlehub';
            } else if (entry.name.startsWith('pokefarm-acc-')) {
              const suffix = entry.name.slice('pokefarm-acc-'.length);
              destinationName = `pokeidlehub-acc-${suffix}`;
            } else if (entry.name.startsWith('pokeidlehub-acc-')) {
              destinationName = entry.name;
            }
            if (destinationName) {
              const destinationPath = path.join(partitionsDir, destinationName);
              if (!fs.existsSync(destinationPath)) {
                fs.cpSync(path.join(legacyPartitions, entry.name), destinationPath, { recursive: true });
              }
            }
          }
        } catch (_) { /* mantém a inicialização mesmo se a cópia das sessões falhar */ }
      }

      break;
    }

    if (fs.existsSync(partitionsDir)) {
      const entries = fs.readdirSync(partitionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'pokefarm') {
          const destination = path.join(partitionsDir, 'pokeidlehub');
          if (!fs.existsSync(destination)) {
            fs.cpSync(path.join(partitionsDir, entry.name), destination, { recursive: true });
          }
        }
        if (entry.name.startsWith('pokefarm-acc-')) {
          const suffix = entry.name.slice('pokefarm-acc-'.length);
          const destination = path.join(partitionsDir, `pokeidlehub-acc-${suffix}`);
          if (!fs.existsSync(destination)) {
            fs.cpSync(path.join(partitionsDir, entry.name), destination, { recursive: true });
          }
        }
      }
    }
  } catch (_) { /* ignora erro de migração para não bloquear a inicialização */ }
}

module.exports = { migrateLegacySessions };
