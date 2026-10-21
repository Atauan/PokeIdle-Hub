'use strict';

function registerMarketSampleHandler({ ipcMain, isTrustedSender, getUserDataPath, joinPath, fs, now = () => new Date() }) {
  ipcMain.on('write-sample', (event, message) => {
    if (!isTrustedSender(event) || !message) return;
    const file = joinPath(getUserDataPath(), 'market-samples.jsonl');
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 3_000_000) return;
      const line = JSON.stringify({
        date: now().toISOString(),
        url: String(message.url).slice(0, 500),
        body: String(message.text).slice(0, 30000),
      });
      fs.appendFileSync(file, line + '\n');
    } catch (_) { /* ignora */ }
  });
}

module.exports = { registerMarketSampleHandler };
