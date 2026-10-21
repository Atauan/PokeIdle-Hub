'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PROFILE_DIRECTORY = 'PokeIdle Hub QA Isolado';
const MARKER_NAME = '.pokeidle-hub-qa-profile.json';
const PROFILE_ID = 'pokeidle-hub-qa';
const FORMAT_VERSION = 1;
const PROFILE_PATH_SWITCHES = [
  '--user-data-dir',
  '--disk-cache-dir',
  '--crash-dumps-dir',
  '--log-file',
  '--log-net-log',
  '--trace-to-file',
];

function normalizePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function validateDirectory(directoryPath, label, { create = false } = {}) {
  let stats;
  try {
    stats = fs.lstatSync(directoryPath);
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    fs.mkdirSync(directoryPath);
    stats = fs.lstatSync(directoryPath);
  }

  if (!stats.isDirectory() || stats.isSymbolicLink()
    || normalizePath(fs.realpathSync(directoryPath)) !== normalizePath(directoryPath)) {
    throw new Error(`O diretório ${label} está redirecionado ou não é uma pasta.`);
  }
}

function resolvePaths(appDataPath) {
  if (typeof appDataPath !== 'string' || !path.isAbsolute(appDataPath)) {
    throw new Error('O diretório de dados do sistema precisa ser um caminho absoluto.');
  }

  const appData = path.resolve(appDataPath);
  const root = path.join(appData, PROFILE_DIRECTORY);
  return { appData, root, marker: path.join(root, MARKER_NAME) };
}

function ensureProfile(appDataPath) {
  const paths = resolvePaths(appDataPath);
  validateDirectory(paths.appData, 'do sistema');
  validateDirectory(paths.root, 'QA', { create: true });

  let markerExists = true;
  try {
    const markerStats = fs.lstatSync(paths.marker);
    if (!markerStats.isFile() || markerStats.isSymbolicLink()) {
      throw new Error('O marcador do perfil QA é inválido.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    markerExists = false;
  }

  if (markerExists) {
    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(paths.marker, 'utf8'));
    } catch (error) {
      throw new Error('Não foi possível validar o marcador do perfil QA.', { cause: error });
    }
    if (marker?.profile !== PROFILE_ID || marker?.format !== FORMAT_VERSION || marker?.state !== 'ready') {
      throw new Error('O marcador não corresponde ao perfil QA deste aplicativo.');
    }
  } else {
    if (fs.readdirSync(paths.root).length > 0) {
      throw new Error('O diretório QA não vazio não tem marcador válido; nada foi alterado.');
    }
    const temporaryPath = path.join(paths.root, `${MARKER_NAME}.${process.pid}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify({
        profile: PROFILE_ID, format: FORMAT_VERSION, state: 'ready',
      }), { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temporaryPath, paths.marker);
    } catch (error) {
      try { fs.rmSync(temporaryPath, { force: true }); } catch (_) { /* mantém o erro original */ }
      throw error;
    }
  }

  const sessionDataPath = path.join(paths.root, 'Session Data');
  validateDirectory(sessionDataPath, 'de sessões QA', { create: true });
  return { ...paths, sessionDataPath, markerName: MARKER_NAME };
}

function initializeQaProfile(app, { reset = false, argv = process.argv } = {}) {
  if (!app?.isPackaged) throw new Error('O perfil QA só pode ser usado pelo build empacotado.');
  if (reset) throw new Error('O reset de dev não pode ser executado pelo build QA.');

  const hasPathArgument = argv.some(argument => PROFILE_PATH_SWITCHES.some(name => (
    argument === name || argument.startsWith(`${name}=`)
  )));
  const hasPathSwitch = PROFILE_PATH_SWITCHES.some(name => app.commandLine?.hasSwitch?.(name.slice(2)));
  if (hasPathArgument || hasPathSwitch) {
    throw new Error('Opções que redirecionam perfil, cache ou arquivos de diagnóstico não são aceitas.');
  }

  const profile = ensureProfile(app.getPath('appData'));
  app.setName(PROFILE_DIRECTORY);
  app.setPath('userData', profile.root);
  app.setPath('sessionData', profile.sessionDataPath);
  const lockAcquired = app.requestSingleInstanceLock();
  return { ...profile, lockAcquired };
}

module.exports = { ensureProfile, initializeQaProfile };
