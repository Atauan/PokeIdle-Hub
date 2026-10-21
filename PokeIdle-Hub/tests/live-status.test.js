'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLiveStatusService } = require('../live-status');

function response({ ok = true, json, text } = {}) {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => json,
    text: async () => text,
  };
}

test('Twitch discovery deduplicates channels and preserves the existing batch size of 30', async () => {
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === 'https://www.twitch.tv/') {
      return response({ text: '<script>clientId = "public123"</script>' });
    }

    assert.equal(url, 'https://gql.twitch.tv/gql');
    const body = JSON.parse(options.body);
    const data = {};
    for (const [key, channel] of Object.entries(body.variables)) {
      const index = Number(key.slice('login'.length));
      data[`u${index}`] = {
        login: channel,
        stream: index % 2 === 0 ? { id: `stream-${index}`, type: 'live' } : null,
      };
    }
    return response({ json: { data } });
  };

  const service = createLiveStatusService(fetch);
  const channels = Array.from({ length: 31 }, (_, index) => `chan${String(index).padStart(2, '0')}`);
  const statuses = await service.check('twitch', [...channels, channels[0]]);

  assert.equal(requests.filter(({ url }) => url === 'https://gql.twitch.tv/gql').length, 2);
  assert.equal(requests[1].options.body && Object.keys(JSON.parse(requests[1].options.body).variables).length, 30);
  assert.equal(Object.keys(statuses).length, 31);
  assert.equal(statuses.chan00, 'online');
  assert.equal(statuses.chan01, 'offline');
});

test('concurrent identical Twitch discovery calls share the in-flight result', async () => {
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push(url);
    if (url === 'https://www.twitch.tv/') {
      return response({ text: '<script>clientId = "public123"</script>' });
    }

    const body = JSON.parse(options.body);
    return response({ json: { data: { u0: { login: body.variables.login0, stream: null } } } });
  };
  const service = createLiveStatusService(fetch);

  const [first, second] = await Promise.all([
    service.check('twitch', ['channel'] ),
    service.check('twitch', ['channel']),
  ]);

  assert.deepEqual(first, { channel: 'offline' });
  assert.deepEqual(second, first);
  assert.equal(requests.filter((url) => url === 'https://gql.twitch.tv/gql').length, 1);
  assert.equal(requests.filter((url) => url === 'https://www.twitch.tv/').length, 1);
});

test('Kick status lookup handles channels in groups of four and normalizes offline results', async () => {
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    const slug = new URL(url).pathname.split('/').at(-1);
    return response({ json: {
      slug,
      livestream: slug === 'channel4' ? null : { is_live: true },
    } });
  };
  const service = createLiveStatusService(fetch);

  const statuses = await service.check('kick', ['channel1', 'channel2', 'channel3', 'channel4', 'channel5']);

  assert.equal(requests.length, 5);
  assert.equal(statuses.channel1, 'online');
  assert.equal(statuses.channel4, 'offline');
  assert.equal(statuses.channel5, 'online');
});

test('empty, invalid, and unsupported live-status requests make no network calls', async () => {
  let calls = 0;
  const service = createLiveStatusService(async () => {
    calls++;
    throw new Error('unexpected network request');
  });

  assert.deepEqual(await service.check('twitch', []), {});
  assert.deepEqual(await service.check('other', ['channel']), {});
  assert.deepEqual(await service.check('kick', ['x', 'bad channel']), {});
  assert.equal(calls, 0);
});
