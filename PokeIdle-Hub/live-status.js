'use strict';

// Consultas de leitura aos sites, sem guardar tokens de login ou carregar players.
// Estes endpoints do frontend podem mudar; respostas inesperadas são "unknown".
function createLiveStatusService(fetch) {
  const REQUEST_TIMEOUT_MS = 15000;
  const pending = new Map();
  let twitchClient = null;
  let clientExpires = 0;
  let clientRequest = null;

  function errorCategory(error) {
    const message = String(error?.message || '');
    const http = message.match(/^HTTP (\d{3})$/);
    if (http) return `HTTP_${http[1]}`;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'TIMEOUT';
    if (error instanceof TypeError) return 'NETWORK';
    if (/Twitch GraphQL/.test(message)) return 'GRAPHQL';
    if (/Twitch client unavailable/.test(message)) return 'CLIENT_ID';
    if (error instanceof SyntaxError) return 'INVALID_RESPONSE';
    return 'UNKNOWN';
  }

  async function request(url, options = {}) {
    const { timeout, ...requestOptions } = options;
    const response = await fetch(url, {
      ...requestOptions,
      signal: AbortSignal.timeout(Number.isFinite(timeout) ? timeout : REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }

  async function getTwitchClient() {
    if (twitchClient && Date.now() < clientExpires) return twitchClient;
    if (!clientRequest) {
      clientRequest = (async () => {
        const html = await (await request('https://www.twitch.tv/')).text();
        // Identificador público servido pelo próprio site, não uma credencial do usuário.
        const match = html.match(/\bclientId\s*=\s*["']([a-z0-9]+)["']/i);
        if (!match) throw new Error('Twitch client unavailable');
        twitchClient = match[1];
        clientExpires = Date.now() + 6 * 60 * 60 * 1000;
        return twitchClient;
      })().finally(() => { clientRequest = null; });
    }
    return clientRequest;
  }

  async function lookupKick(channel) {
    const body = await (await request(`https://kick.com/api/v2/channels/${channel}`)).json();
    if (body?.slug?.toLowerCase() !== channel) return 'unknown';
    if (body.livestream === null) return 'offline';
    if (body.livestream?.is_live === true) return 'online';
    if (body.livestream?.is_live === false) return 'offline';
    return 'unknown';
  }

  async function lookupTwitch(channels) {
    const out = Object.fromEntries(channels.map(channel => [channel, 'unknown']));
    const client = await getTwitchClient();
    const variables = Object.fromEntries(channels.map((channel, index) => [`login${index}`, channel]));
    const declarations = channels.map((_, index) => `$login${index}: String!`).join(', ');
    const fields = channels.map((_, index) => `u${index}: user(login: $login${index}) { login stream { id type } }`).join(' ');
    const body = await (await request('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': client, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query(${declarations}) { ${fields} }`, variables,
      }),
    })).json();
    if (body?.errors?.length) {
      clientExpires = 0;
      throw new Error('Twitch GraphQL retornou erro na consulta de status');
    }
    channels.forEach((channel, index) => {
      const user = body?.data?.[`u${index}`];
      if (user?.login?.toLowerCase() !== channel) return;
      if (user.stream === null) out[channel] = 'offline';
      else if (user.stream?.id && user.stream.type === 'live') out[channel] = 'online';
    });
    return out;
  }

  async function checkTwitchBatch(channels, out) {
    try {
      Object.assign(out, await lookupTwitch(channels));
    } catch (error) {
      if (error?.message === 'HTTP 400' && channels.length > 1) {
        const middle = Math.ceil(channels.length / 2);
        await checkTwitchBatch(channels.slice(0, middle), out);
        await checkTwitchBatch(channels.slice(middle), out);
        return;
      }
      out.$error = errorCategory(error);
    }
  }

  return {
    async check(platform, channels) {
      if (!['kick', 'twitch'].includes(platform) || !Array.isArray(channels)) return {};
      const names = [...new Set(channels.slice(0, 200).filter(channel => typeof channel === 'string' &&
        /^[a-z0-9_-]{2,40}$/.test(channel)))].sort();
      if (!names.length) return {};
      const key = `${platform}:${names.join(',')}`;
      if (!pending.has(key)) {
        const work = (async () => {
          const out = Object.fromEntries(names.map(channel => [channel, 'unknown']));
          const size = platform === 'twitch' ? 15 : 4;
          for (let offset = 0; offset < names.length; offset += size) {
            const batch = names.slice(offset, offset + size);
            if (platform === 'twitch') {
              await checkTwitchBatch(batch, out);
            } else {
              await Promise.all(batch.map(async channel => {
                try { out[channel] = await lookupKick(channel); }
                catch (error) { out.$error = errorCategory(error); }
              }));
            }
          }
          return out;
        })().finally(() => pending.delete(key));
        pending.set(key, work);
      }
      return pending.get(key);
    },
  };
}

module.exports = { createLiveStatusService };
