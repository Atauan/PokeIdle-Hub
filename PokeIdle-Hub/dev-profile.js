'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PROFILE_DIRECTORY = 'PokeIdle Hub Dev';
const MARKER_NAME = '.pokeidle-hub-dev-profile.json';
const PROFILE_ID = 'pokeidle-hub-dev';
const FORMAT_VERSION = 1;
const RUNTIME_LOCK_FILES = new Set([
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket',
  'lockfile',
]);
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

function resolvePaths(appDataPath) {
  if (typeof appDataPath !== 'string' || !path.isAbsolute(appDataPath)) {
    throw new Error('O diretório de dados do sistema precisa ser um caminho absoluto.');
  }

  const appData = path.resolve(appDataPath);
  const root = path.join(appData, PROFILE_DIRECTORY);
  return { appData, root, marker: path.join(root, MARKER_NAME) };
}

function validateAppData(paths) {
  const appDataStat = fs.lstatSync(paths.appData);
  if (!appDataStat.isDirectory() || appDataStat.isSymbolicLink()) {
    throw new Error('O diretório de dados do sistema está redirecionado ou não é uma pasta.');
  }
  if (normalizePath(fs.realpathSync(paths.appData)) !== normalizePath(paths.appData)) {
    throw new Error('O diretório de dados do sistema foi redirecionado.');
  }
}

function validateRoot(paths, { create = false } = {}) {
  let rootStat;
  try {
    rootStat = fs.lstatSync(paths.root);
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    fs.mkdirSync(paths.root);
    rootStat = fs.lstatSync(paths.root);
  }

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('O perfil dev foi redirecionado por um link simbólico ou não é uma pasta.');
  }
  if (normalizePath(fs.realpathSync(paths.root)) !== normalizePath(paths.root)) {
    throw new Error('O caminho real do perfil dev não corresponde à raiz permitida.');
  }
}

function readMarker(paths, { allowResetting = false } = {}) {
  const markerStat = fs.lstatSync(paths.marker);
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
    throw new Error('O marcador do perfil dev é inválido.');
  }

  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(paths.marker, 'utf8'));
  } catch (error) {
    throw new Error('Não foi possível validar o marcador do perfil dev.', { cause: error });
  }
  if (marker?.profile !== PROFILE_ID || marker?.format !== FORMAT_VERSION
    || !['ready', 'resetting'].includes(marker?.state)) {
    throw new Error('O marcador do perfil dev não corresponde a este aplicativo.');
  }
  if (marker.state === 'resetting' && !allowResetting) {
    throw new Error('O perfil dev tem um reset incompleto; execute dev:reset novamente.');
  }
  return marker;
}

function writeMarker(paths, state) {
  const temporaryPath = path.join(paths.root, `${MARKER_NAME}.${process.pid}.${randomUUID()}.tmp`);
  const contents = JSON.stringify({ profile: PROFILE_ID, format: FORMAT_VERSION, state });
  try {
    fs.writeFileSync(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporaryPath, paths.marker);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch (_) { /* mantém o erro original */ }
    throw error;
  }
}

function ensureDevProfile(appDataPath, { allowResetting = false } = {}) {
  const paths = resolvePaths(appDataPath);
  validateAppData(paths);
  validateRoot(paths, { create: true });

  let markerExists = true;
  try {
    fs.lstatSync(paths.marker);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    markerExists = false;
  }

  if (markerExists) {
    readMarker(paths, { allowResetting });
  } else {
    const entries = fs.readdirSync(paths.root);
    if (entries.length > 0) {
      throw new Error('O diretório dev não vazio não tem um marcador válido; nada foi alterado.');
    }
    writeMarker(paths, 'ready');
  }

  return { root: paths.root, marker: paths.marker, markerName: MARKER_NAME };
}

function resetDevProfile(appDataPath) {
  const paths = resolvePaths(appDataPath);
  validateAppData(paths);
  validateRoot(paths);
  readMarker(paths, { allowResetting: true });
  writeMarker(paths, 'resetting');

  for (const name of fs.readdirSync(paths.root)) {
    if (RUNTIME_LOCK_FILES.has(name)) continue;
    fs.rmSync(path.join(paths.root, name), { recursive: true, force: false, maxRetries: 2 });
  }

  writeMarker(paths, 'ready');
  return { root: paths.root, marker: paths.marker, markerName: MARKER_NAME };
}

function ensureSessionDataDirectory(profileRoot) {
  const sessionDataPath = path.join(profileRoot, 'Session Data');
  try {
    const stats = fs.lstatSync(sessionDataPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()
      || normalizePath(fs.realpathSync(sessionDataPath)) !== normalizePath(sessionDataPath)) {
      throw new Error('O diretório de sessões dev foi redirecionado ou não é uma pasta.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fs.mkdirSync(sessionDataPath);
  }
  return sessionDataPath;
}

function initializeDevProfile(app, { reset = false, argv = process.argv } = {}) {
  const hasPathArgument = argv.some(argument => PROFILE_PATH_SWITCHES.some((name) => (
    argument === name || argument.startsWith(`${name}=`)
  )));
  const hasPathSwitch = PROFILE_PATH_SWITCHES.some(name => app.commandLine?.hasSwitch?.(name.slice(2)));
  if (hasPathArgument || hasPathSwitch) {
    throw new Error('Opções que redirecionam perfil, cache ou arquivos de diagnóstico não são aceitas.');
  }

  if (app.isPackaged) {
    if (reset) throw new Error('O reset de dev não pode ser executado pelo aplicativo empacotado.');
    return null;
  }

  app.setName('PokeIdle Hub Dev');
  const appDataPath = app.getPath('appData');
  const profile = ensureDevProfile(appDataPath, { allowResetting: reset });
  const sessionDataPath = ensureSessionDataDirectory(profile.root);
  app.setPath('userData', profile.root);
  app.setPath('sessionData', sessionDataPath);

  const lockAcquired = app.requestSingleInstanceLock();
  if (!lockAcquired) return { ...profile, sessionDataPath, lockAcquired };

  if (reset) {
    resetDevProfile(appDataPath);
    ensureSessionDataDirectory(profile.root);
  }

  return { ...profile, sessionDataPath, lockAcquired };
}

module.exports = { ensureDevProfile, initializeDevProfile };
