'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.platform !== 'win32') {
  process.stdout.write('Helper de working set ignorado fora do Windows.\n');
  process.exit(0);
}

const windowsDirectory = process.env.WINDIR || 'C:\\Windows';
const compilerCandidates = [
  path.join(windowsDirectory, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(windowsDirectory, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
];
const compilerPath = compilerCandidates.find(candidate => fs.existsSync(candidate));
if (!compilerPath) {
  process.stderr.write('Não encontrei o compilador C# do .NET Framework necessário para preparar o helper Windows.\n');
  process.exit(1);
}

const projectDirectory = path.resolve(__dirname, '..');
const outputDirectory = path.join(projectDirectory, 'build');
const outputPath = path.join(outputDirectory, 'win-memory-trimmer.exe');
const sourcePath = path.join(__dirname, 'win-memory-trimmer.cs');
fs.mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(compilerPath, [
  '/nologo',
  '/target:exe',
  '/optimize+',
  `/out:${outputPath}`,
  sourcePath,
], { cwd: projectDirectory, stdio: 'inherit', windowsHide: true });

if (result.error) {
  process.stderr.write(`Falha ao iniciar o compilador C#: ${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
process.stdout.write('Helper Windows de working set compilado.\n');
