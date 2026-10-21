'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isAdditionalPartition } = require('./account-partition');

const PRIMARY_PARTITION = 'persist:pokeidlehub';
const PARTITIONS_DIRECTORY = 'Partitions';
const MARKER_NAME = 'provider-storage-cleanup-v1.json';
const MARKER_VERSION = 1;
const PROVIDER_ORIGINS = Object.freeze([
  'https://www.twitch.tv',
  'https://passport.twitch.tv',
  'https://kick.com',
  'https://web.kick.com',
]);
const PROVIDER_DATA_TYPES = Object.freeze([
  'backgroundFetch',
  'cache',
  'cookies',
  'fileSystems',
  'indexedDB',
  'localStorage',
  'serviceWorkers',
  'webSQL',
]);

function readMarker(markerPath) {
  let stats;
  try {
    stats = fs.lstatSync(markerPath);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('Marcador de limpeza de sessões de streaming inválido.');
  }
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch (error) {
    throw new Error('Não foi possível validar o marcador de limpeza de sessões de streaming.', { cause: error });
  }
  if (marker?.version !== MARKER_VERSION || marker?.state !== 'complete') {
    throw new Error('Marcador de limpeza de sessões de streaming não suportado.');
  }
  return true;
}

function listAccountPartitions(userDataPath) {
  const partitionsPath = path.join(userDataPath, PARTITIONS_DIRECTORY);
  let stats;
  try {
    stats = fs.lstatSync(partitionsPath);
  } catch (error) {
    if (error.code === 'ENOENT') return [PRIMARY_PARTITION];
    throw error;
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('A pasta de partições persistentes está redirecionada ou não é uma pasta.');
  }

  const partitions = new Set([PRIMARY_PARTITION]);
  for (const entry of fs.readdirSync(partitionsPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const partition = `persist:${entry.name}`;
    if (isAdditionalPartition(partition)) partitions.add(partition);
  }
  return [...partitions].sort((left, right) => (
    left === PRIMARY_PARTITION ? -1 : right === PRIMARY_PARTITION ? 1 : left.localeCompare(right)
  ));
}

function writeMarker(markerPath) {
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify({ version: MARKER_VERSION, state: 'complete' }), {
      encoding: 'utf8',
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, markerPath);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch (_) { /* mantém o erro original */ }
    throw error;
  }
}

function createProviderSessionCleanup({ session }) {
  async function clearStaleProviderData(userDataPath) {
    if (typeof userDataPath !== 'string' || !path.isAbsolute(userDataPath)) {
      throw new Error('O diretório de dados do aplicativo precisa ser absoluto.');
    }
    const markerPath = path.join(userDataPath, MARKER_NAME);
    if (readMarker(markerPath)) return { cleared: false, partitions: [] };

    const partitions = listAccountPartitions(userDataPath);
    for (const partition of partitions) {
      const currentSession = session.fromPartition(partition);
      if (typeof currentSession.clearData !== 'function') {
        throw new Error('A sessão não oferece suporte à limpeza seletiva de dados.');
      }
      await currentSession.clearData({
        origins: [...PROVIDER_ORIGINS],
        dataTypes: [...PROVIDER_DATA_TYPES],
        originMatchingMode: 'origin-in-all-contexts',
      });
    }
    writeMarker(markerPath);
    return { cleared: true, partitions };
  }

  return Object.freeze({ clearStaleProviderData });
}

module.exports = { createProviderSessionCleanup };
