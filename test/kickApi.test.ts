import {
  fetchKickChannel,
  getKickApiMode,
  isKickConfigured,
  isValidKickSlug,
  normalizeKickSlug,
  parseKickDate,
  KickAuthError,
  KickNotFoundError,
  KickRateLimitError,
  __resetKickTokenCache
} from '../src/utils/kickApi.ts';

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

const OFFICIAL_LIVE = {
  data: [{
    broadcaster_user_id: 668,
    slug: 'testci',
    stream_title: 'Yayındayız!',
    channel_description: '',
    banner_picture: 'https://files.kick.com/banner.png',
    category: { id: 15, name: 'Just Chatting', thumbnail: 'https://files.kick.com/cat.png' },
    stream: {
      is_live: true,
      viewer_count: 150,
      start_time: '2026-10-01T22:00:00Z',
      language: 'en',
      thumbnail: 'https://files.kick.com/thumb.png',
      is_mature: false
    }
  }],
  message: 'OK'
};

const OFFICIAL_OFFLINE = {
  data: [{
    broadcaster_user_id: 668,
    slug: 'testci',
    stream_title: '',
    category: { id: 0, name: '', thumbnail: '' },
    stream: {
      is_live: false,
      viewer_count: 0,
      start_time: '0001-01-01T00:00:00Z',
      thumbnail: ''
    }
  }],
  message: 'OK'
};

const V2_LIVE = {
  id: 668,
  slug: 'testci',
  livestream: {
    id: 103692434,
    session_title: 'Yayındayız!',
    is_live: true,
    viewer_count: 99,
    start_time: '2026-04-06 05:03:57',
    thumbnail: 'https://files.kick.com/v2-thumb.png',
    categories: [{ name: 'Just Chatting' }]
  },
  recent_categories: [{ name: 'Just Chatting' }]
};

const V2_OFFLINE = { id: 668, slug: 'testci', livestream: null, recent_categories: [{ name: 'Just Chatting' }] };

function mockFetch(handler: (url: string, init?: RequestInit) => Response): jest.Mock {
  const fn = jest.fn(async (url: string, init?: RequestInit) => handler(url, init));
  (global as any).fetch = fn;
  return fn as unknown as jest.Mock;
}

describe('kickApi slug', () => {
  test('normalizeKickSlug çeşitli formatları temizler', () => {
    expect(normalizeKickSlug('xqc')).toBe('xqc');
    expect(normalizeKickSlug('  XQC  ')).toBe('xqc');
    expect(normalizeKickSlug('https://kick.com/xqc')).toBe('xqc');
    expect(normalizeKickSlug('http://www.kick.com/xqc')).toBe('xqc');
    expect(normalizeKickSlug('kick.com/xqc')).toBe('xqc');
    expect(normalizeKickSlug('https://kick.com/xqc/chat')).toBe('xqc');
    expect(normalizeKickSlug('https://kick.com/xqc?tab=followers')).toBe('xqc');
  });

  test('isValidKickSlug', () => {
    expect(isValidKickSlug('xqc')).toBe(true);
    expect(isValidKickSlug('streamer-123')).toBe(true);
    expect(isValidKickSlug('')).toBe(false);
    expect(isValidKickSlug('a')).toBe(false);
    expect(isValidKickSlug('cok_uzun_bir_kanal_ismi_fazla')).toBe(false);
    expect(isValidKickSlug('-baslangic')).toBe(false);
    expect(isValidKickSlug('boşluklu slug')).toBe(false);
  });
});

describe('kickApi parseKickDate', () => {
  test('ISO-8601 (resmi API)', () => {
    expect(parseKickDate('2026-10-01T22:00:00Z')).toBe(Date.UTC(2026, 9, 1, 22, 0, 0));
  });

  test('boşluklu format (v2 API, ISO değil)', () => {
    expect(parseKickDate('2026-04-06 05:03:57')).toBe(Date.UTC(2026, 3, 6, 5, 3, 57));
  });

  test('placeholder ve geçersiz değerler 0 döner', () => {
    expect(parseKickDate('0001-01-01T00:00:00Z')).toBe(0);
    expect(parseKickDate('')).toBe(0);
    expect(parseKickDate(null)).toBe(0);
    expect(parseKickDate(undefined)).toBe(0);
    expect(parseKickDate('   ')).toBe(0);
    expect(parseKickDate('hicbir sey degil')).toBe(0);
  });
});

describe('kickApi mod seçimi', () => {
  beforeEach(() => {
    __resetKickTokenCache();
    delete process.env.KICK_CLIENT_ID;
    delete process.env.KICK_CLIENT_SECRET;
    delete process.env.KICK_API_MODE;
  });
  afterAll(() => { process.env = { ...ORIGINAL_ENV }; });

  test('credentials yoksa public-v2', () => {
    expect(isKickConfigured()).toBe(false);
    expect(getKickApiMode()).toBe('public-v2');
  });

  test('credentials varsa official', () => {
    process.env.KICK_CLIENT_ID = 'id';
    process.env.KICK_CLIENT_SECRET = 'secret';
    expect(isKickConfigured()).toBe(true);
    expect(getKickApiMode()).toBe('official');
  });

  test('KICK_API_MODE=public-v2 credentials olsa bile v2 seçer', () => {
    process.env.KICK_CLIENT_ID = 'id';
    process.env.KICK_CLIENT_SECRET = 'secret';
    process.env.KICK_API_MODE = 'public-v2';
    expect(getKickApiMode()).toBe('public-v2');
  });

  test('KICK_API_MODE=official credentials yoksa v2ye düşer', () => {
    process.env.KICK_API_MODE = 'official';
    expect(getKickApiMode()).toBe('public-v2');
  });
});

describe('kickApi public-v2 fetch', () => {
  beforeEach(() => {
    __resetKickTokenCache();
    process.env.KICK_API_MODE = 'public-v2';
    delete process.env.KICK_CLIENT_ID;
    delete process.env.KICK_CLIENT_SECRET;
  });
  afterAll(() => { process.env = { ...ORIGINAL_ENV }; });

  test('yayındayken bilgileri normalize eder', async () => {
    mockFetch(() => jsonResponse(V2_LIVE));

    const info = await fetchKickChannel('testci');

    expect(info.isLive).toBe(true);
    expect(info.title).toBe('Yayındayız!');
    expect(info.category).toBe('Just Chatting');
    expect(info.thumbnail).toBe('https://files.kick.com/v2-thumb.png');
    expect(info.viewerCount).toBe(99);
    expect(info.startedAt).toBe(Date.UTC(2026, 3, 6, 5, 3, 57));
    expect(info.sessionKey).toBe('103692434');
  });

  test('yayında değilken boş bilgi döner', async () => {
    mockFetch(() => jsonResponse(V2_OFFLINE));

    const info = await fetchKickChannel('testci');

    expect(info.isLive).toBe(false);
    expect(info.title).toBe('');
    expect(info.thumbnail).toBe('');
    expect(info.sessionKey).toBe('');
    expect(info.startedAt).toBe(0);
  });

  test('livestream thumbnail boşsa kanal banner\'ı fallback olur', async () => {
    mockFetch(() => jsonResponse({
      ...V2_LIVE,
      livestream: { ...V2_LIVE.livestream, thumbnail: '' },
      banner_image: { url: 'https://files.kick.com/banner.png' }
    }));

    const info = await fetchKickChannel('testci');
    expect(info.thumbnail).toBe('https://files.kick.com/banner.png');
  });

  test('livestream thumbnail varsa banner kullanılmaz', async () => {
    mockFetch(() => jsonResponse({
      ...V2_LIVE,
      banner_image: { url: 'https://files.kick.com/banner.png' }
    }));

    const info = await fetchKickChannel('testci');
    expect(info.thumbnail).toBe('https://files.kick.com/v2-thumb.png');
  });

  test('v2 auth kullanmaz', async () => {    const fn = mockFetch(() => jsonResponse(V2_OFFLINE));
    await fetchKickChannel('testci');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(String(fn.mock.calls[0][0])).toBe('https://kick.com/api/v2/channels/testci');
  });

  test('404 -> KickNotFoundError', async () => {
    mockFetch(() => jsonResponse({}, 404));
    await expect(fetchKickChannel('yok')).rejects.toBeInstanceOf(KickNotFoundError);
  });

  test('429 -> KickRateLimitError', async () => {
    mockFetch(() => jsonResponse({}, 429));
    await expect(fetchKickChannel('testci')).rejects.toBeInstanceOf(KickRateLimitError);
  });

  test('fetch reject -> KickNetworkError', async () => {
    mockFetch(() => { throw new Error('socket hang up'); });
    await expect(fetchKickChannel('testci')).rejects.toBeInstanceOf(Error);
  });

  test('boş slug -> KickNotFoundError, istek atılmaz', async () => {
    const fn = mockFetch(() => jsonResponse(V2_LIVE));
    await expect(fetchKickChannel('   ')).rejects.toBeInstanceOf(KickNotFoundError);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('kickApi official fetch + token cache', () => {
  beforeEach(() => {
    __resetKickTokenCache();
    process.env.KICK_API_MODE = 'official';
    process.env.KICK_CLIENT_ID = 'client-id';
    process.env.KICK_CLIENT_SECRET = 'client-secret';
  });
  afterAll(() => { process.env = { ...ORIGINAL_ENV }; });

  function tokenAndChannelResponse(calls: string[]): (url: string) => Response {
    return (url: string) => {
      calls.push(url);
      if (url.includes('id.kick.com/oauth/token')) {
        return jsonResponse({ access_token: 'app-token', expires_in: 3600, token_type: 'Bearer' });
      }
      return jsonResponse(OFFICIAL_LIVE);
    };
  }

  test('token endpoint client_credentials ile çağrılır', async () => {
    const calls: string[] = [];
    const fn = mockFetch(url => tokenAndChannelResponse(calls)(url));

    await fetchKickChannel('testci');

    const tokenCall = fn.mock.calls.find(c => String(c[0]).includes('oauth/token'));
    expect(String(tokenCall![0])).toBe('https://id.kick.com/oauth/token');
    expect(String(tokenCall![1]?.method)).toBe('POST');
    const body = String(tokenCall![1]?.body);
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=client-id');
    expect(body).toContain('client_secret=client-secret');
  });

  test('Authorization: Bearer header gönderilir', async () => {
    const fn = mockFetch(url => tokenAndChannelResponse([])(url));
    await fetchKickChannel('testci');
    const channelCall = fn.mock.calls.find(c => String(c[0]).includes('api.kick.com'));
    const headers = channelCall![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer app-token');
  });

  test('token cache: iki çağrıda tek token isteği', async () => {
    const fn = mockFetch(url => tokenAndChannelResponse([])(url));

    await fetchKickChannel('testci');
    await fetchKickChannel('testci');
    await fetchKickChannel('testci');

    const tokenCalls = fn.mock.calls.filter(c => String(c[0]).includes('oauth/token'));
    expect(tokenCalls).toHaveLength(1);
    expect(fn.mock.calls.filter(c => String(c[0]).includes('api.kick.com'))).toHaveLength(3);
  });

  test('süresi dolan token yenilenir', async () => {
    let issued = 0;
    const fn = mockFetch(url => {
      if (String(url).includes('oauth/token')) {
        issued += 1;
        return jsonResponse({ access_token: `token-${issued}`, expires_in: 1 });
      }
      return jsonResponse(OFFICIAL_LIVE);
    });

    await fetchKickChannel('testci');
    expect(issued).toBe(1);

    // expires_in=1 → 60sn yenileme payı dolduğu için hemen yenilenir
    await fetchKickChannel('testci');
    expect(issued).toBe(2);
  });

  test('yayındayken resmi API verisi normalize edilir, sessionKey = start_time', async () => {
    mockFetch(url => tokenAndChannelResponse([])(url));

    const info = await fetchKickChannel('testci');

    expect(info.isLive).toBe(true);
    expect(info.title).toBe('Yayındayız!');
    expect(info.category).toBe('Just Chatting');
    expect(info.viewerCount).toBe(150);
    expect(info.startedAt).toBe(Date.UTC(2026, 9, 1, 22, 0, 0));
    expect(info.sessionKey).toBe('2026-10-01T22:00:00Z');
  });

  test('resmi API offline yanıtı', async () => {
    mockFetch(url => (String(url).includes('oauth/token')
      ? jsonResponse({ access_token: 'app-token', expires_in: 3600 })
      : jsonResponse(OFFICIAL_OFFLINE)));

    const info = await fetchKickChannel('testci');
    expect(info.isLive).toBe(false);
    expect(info.sessionKey).toBe('');
    expect(info.startedAt).toBe(0);
  });

  test('resmi API boş data dizisi dönerse offline sayılır', async () => {
    mockFetch(url => (String(url).includes('oauth/token')
      ? jsonResponse({ access_token: 'app-token', expires_in: 3600 })
      : jsonResponse({ data: [], message: 'OK' })));

    const info = await fetchKickChannel('yokboylekanal');
    expect(info.isLive).toBe(false);
    expect(info.slug).toBe('yokboylekanal');
  });

  test('token 401 alırsa KickAuthError', async () => {
    mockFetch(url => (String(url).includes('oauth/token') ? jsonResponse({}, 401) : jsonResponse(OFFICIAL_LIVE)));
    await expect(fetchKickChannel('testci')).rejects.toBeInstanceOf(KickAuthError);
  });

  test('kanal isteği 401 alırsa token yenilenip tekrar denenir', async () => {
    let tokenCalls = 0;
    let channelCalls = 0;
    mockFetch(url => {
      if (String(url).includes('oauth/token')) {
        tokenCalls += 1;
        return jsonResponse({ access_token: `token-${tokenCalls}`, expires_in: 3600 });
      }
      channelCalls += 1;
      if (channelCalls === 1) return jsonResponse({}, 401);
      return jsonResponse(OFFICIAL_LIVE);
    });

    const info = await fetchKickChannel('testci');

    expect(info.isLive).toBe(true);
    expect(tokenCalls).toBe(2);
    expect(channelCalls).toBe(2);
  });
});
