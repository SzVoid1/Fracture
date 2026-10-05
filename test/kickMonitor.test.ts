import { resolveKickAction, isKickConfiguredForGuild } from '../src/utils/kickMonitor.ts';
import type { KickChannelInfo } from '../src/utils/kickApi.ts';
import type { KickState } from '../src/utils/kickState.ts';
import type { Settings } from '../src/utils/storage.ts';

function info(overrides: Partial<KickChannelInfo> = {}): KickChannelInfo {
  return {
    slug: 'testci',
    title: 'Yayındayız!',
    category: 'Just Chatting',
    thumbnail: 'https://files.kick.com/thumb.png',
    isLive: true,
    sessionKey: '2026-10-01T22:00:00Z',
    startedAt: Date.UTC(2026, 9, 1, 22, 0, 0),
    viewerCount: 150,
    ...overrides
  };
}

function state(overrides: Partial<KickState> = {}): KickState {
  return {
    guildId: 'g1',
    sessionKey: '2026-10-01T22:00:00Z',
    messageId: '999',
    slug: 'testci',
    title: 'Yayındayız!',
    category: 'Just Chatting',
    thumbnail: 'https://files.kick.com/thumb.png',
    imageSource: 'kick',
    startedAt: Date.UTC(2026, 9, 1, 22, 0, 0),
    lastViewers: 150,
    lastCheckedAt: Date.now(),
    ...overrides
  };
}

describe('resolveKickAction', () => {
  test('ilk yayın → announce', () => {
    expect(resolveKickAction(undefined, info())).toBe('announce');
  });

  test('aynı yayın devam ederken → none (tekrar duyurmaz)', () => {
    expect(resolveKickAction(state(), info())).toBe('none');
  });

  test('bot restart sonrası aynı yayın → none', () => {
    const persisted = state({ lastCheckedAt: 0 });
    expect(resolveKickAction(persisted, info())).toBe('none');
  });

  test('yayın bitti → end', () => {
    expect(resolveKickAction(state(), info({ isLive: false, sessionKey: '', title: '', viewerCount: 0 }))).toBe('end');
  });

  test('state yokken yayın bittiyse → none (mesaj yok, güncellenecek bir şey yok)', () => {
    expect(resolveKickAction(undefined, info({ isLive: false, sessionKey: '', title: '' }))).toBe('none');
  });

  test('yeni yayın başladı (farklı sessionKey) → announce', () => {
    const next = info({ sessionKey: '2026-10-05T10:00:00Z', title: 'Yeni Yayın' });
    expect(resolveKickAction(state(), next)).toBe('announce');
  });

  test('başlık değişti → update', () => {
    expect(resolveKickAction(state(), info({ title: 'Yeni Başlık' }))).toBe('update');
  });

  test('v2 modunda sessionKey id bazlıyken de aynı mantık', () => {
    const v2State = state({ sessionKey: '103692434' });
    const v2Info = info({ sessionKey: '103692434' });
    expect(resolveKickAction(v2State, v2Info)).toBe('none');
    expect(resolveKickAction(v2State, info({ sessionKey: '103692435' }))).toBe('announce');
  });

  test('yayın bitmişken state temizlenmişse yeni yayın → announce', () => {
    expect(resolveKickAction(undefined, info({ sessionKey: 'yeni' }))).toBe('announce');
  });

  test('offline + state.sessionKey boş → none', () => {
    expect(resolveKickAction(state({ sessionKey: '' }), info({ isLive: false, sessionKey: '' }))).toBe('none');
  });

  test('izleyici değişimi tek başına update tetiklemez', () => {
    expect(resolveKickAction(state(), info({ viewerCount: 9999 }))).toBe('none');
  });
});

describe('isKickConfiguredForGuild', () => {
  function settings(overrides: Partial<Settings>): Settings {
    return { guildId: 'g1', announcementChannelId: '', allowedRoles: [], ...overrides };
  }

  test('slug ve kanal ikisi de gerekli', () => {
    expect(isKickConfiguredForGuild(settings({ kickSlug: 'xqc', kickChannelId: '123' }))).toBe(true);
  });

  test('sadece slug yetmez', () => {
    expect(isKickConfiguredForGuild(settings({ kickSlug: 'xqc' }))).toBe(false);
  });

  test('sadece kanal yetmez', () => {
    expect(isKickConfiguredForGuild(settings({ kickChannelId: '123' }))).toBe(false);
  });

  test('settings yok', () => {
    expect(isKickConfiguredForGuild(undefined)).toBe(false);
  });
});
