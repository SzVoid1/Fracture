import * as fs from 'fs';
import {
  getAnnouncements,
  saveAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  removeAnnouncement,
  getAnnouncement,
  getGuildSettings,
  setGuildSettings,
  addAllowedRole,
  removeAllowedRole,
  __clearAnnouncementsCache
} from '../src/utils/storage.ts';

jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Storage - Announcements', () => {
  const mockAnnouncement = {
    id: 'ann_test123',
    guildId: 'guild1',
    channelId: 'channel1',
    messageId: 'msg1',
    roleId: 'role1',
    title: 'Test Duyuru',
    description: 'Test açıklama',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    totalMs: 3600000,
    seenBy: [],
    halfwayNotified: false,
    finalDmNotified: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __clearAnnouncementsCache();
  });

  test('addAnnouncement should store announcement', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');

    addAnnouncement(mockAnnouncement);

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1] as string);
    expect(writtenData).toHaveLength(1);
    expect(writtenData[0].id).toBe('ann_test123');
  });

  test('getAnnouncements should return empty array when no file', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = getAnnouncements();
    expect(result).toEqual([]);
  });

  test('updateAnnouncement should modify existing announcement', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([mockAnnouncement]));

    const result = updateAnnouncement('ann_test123', { seenBy: ['user1'] });
    expect(result).toBe(true);

    const lastCall = mockedFs.writeFileSync.mock.calls[mockedFs.writeFileSync.mock.calls.length - 1];
    const writtenData = JSON.parse(lastCall[1] as string);
    expect(writtenData[0].seenBy).toContain('user1');
  });

  test('removeAnnouncement should delete existing announcement', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([mockAnnouncement]));

    const result = removeAnnouncement('ann_test123');
    expect(result).toBe(true);

    const lastCall = mockedFs.writeFileSync.mock.calls[mockedFs.writeFileSync.mock.calls.length - 1];
    const writtenData = JSON.parse(lastCall[1] as string);
    expect(writtenData).toHaveLength(0);
  });

  test('getAnnouncement should find by id', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([mockAnnouncement]));

    const result = getAnnouncement('ann_test123');
    expect(result).toBeDefined();
    expect(result!.id).toBe('ann_test123');
  });

  test('getAnnouncement should return undefined for missing id', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([mockAnnouncement]));

    const result = getAnnouncement('nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('Storage - Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('setGuildSettings should save settings', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');

    setGuildSettings({
      guildId: 'guild1',
      announcementChannelId: 'channel1',
      allowedRoles: ['role1']
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  test('addAllowedRole should add role to allowed list', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([{
      guildId: 'guild1',
      announcementChannelId: '',
      allowedRoles: []
    }]));

    addAllowedRole('guild1', 'role_admin');

    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1] as string);
    expect(writtenData[0].allowedRoles).toContain('role_admin');
  });

  test('removeAllowedRole should remove role from allowed list', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([{
      guildId: 'guild1',
      announcementChannelId: '',
      allowedRoles: ['role_admin', 'role_mod']
    }]));

    removeAllowedRole('guild1', 'role_admin');

    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1] as string);
    expect(writtenData[0].allowedRoles).not.toContain('role_admin');
    expect(writtenData[0].allowedRoles).toContain('role_mod');
  });

  test('addAllowedRole duplicate eklemez', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([{
      guildId: 'guild1',
      announcementChannelId: '',
      allowedRoles: ['role_admin']
    }]));
    addAllowedRole('guild1', 'role_admin');
    const written = mockedFs.writeFileSync.mock.calls.length === 0 || JSON.parse(mockedFs.writeFileSync.mock.calls[0]?.[1] as string || '[]');
    // duplicate eklenmemeli, ya hiç yazmamalı ya da aynı uzunlukta
    if (mockedFs.writeFileSync.mock.calls.length > 0) {
      const data = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
      expect(data[0].allowedRoles.filter((r: string) => r === 'role_admin')).toHaveLength(1);
    }
  });

  test('getGuildSettings undefined için', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([]));
    expect(getGuildSettings('nonexistent')).toBeUndefined();
  });
});

describe('Storage - Migration & Cache', () => {
  beforeEach(() => { jest.clearAllMocks(); __clearAnnouncementsCache(); });

  test('eski duyuru migrate: eksik authorId/totalMs doldurur', () => {
    const oldAnn: any = {
      id: 'ann_old',
      guildId: 'g1',
      channelId: 'ch1',
      messageId: 'm1',
      roleId: 'r1',
      title: 'Eski',
      description: 'desc',
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 100000,
      seenBy: undefined,
      halfwayNotified: undefined
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([oldAnn]));
    const result = getAnnouncements();
    expect(result[0].seenBy).toEqual([]);
    expect(result[0].authorId).toBe('unknown');
    expect(result[0].totalMs).toBeGreaterThan(0);
    expect(mockedFs.writeFileSync).toHaveBeenCalled(); // migrate yazdı
  });

  test('cache 5sn içinde disk okumaz (aynı referans değil ama içerik aynı)', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([]));
    const a1 = getAnnouncements();
    const a2 = getAnnouncements();
    expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1); // ikinci cache’ten
    expect(a1).toEqual(a2);
  });
});

describe('Storage - Cooldown', () => {
  beforeEach(() => jest.clearAllMocks());

  test('setCooldown ve checkCooldown', async () => {
    jest.useFakeTimers();
    const { setCooldown, checkCooldown } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');
    setCooldown('user1', 60000);
    // write sonrası read mock’u güncelle
    const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(written));
    let check = checkCooldown('user1');
    expect(check.onCooldown).toBe(true);
    expect(check.remainingMs).toBeGreaterThan(50000);
    jest.advanceTimersByTime(61000);
    // expire sonrası
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(written));
    check = checkCooldown('user1');
    expect(check.onCooldown).toBe(false);
    jest.useRealTimers();
  });

  test('checkCooldown yoksa false', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');
    const { checkCooldown } = await import('../src/utils/storage.ts');
    expect(checkCooldown('nobody').onCooldown).toBe(false);
  });
});

describe('Storage - Intro Dismissed', () => {
  beforeEach(() => jest.clearAllMocks());

  test('dismissIntro idempotent', async () => {
    const { dismissIntro, isIntroDismissed, getIntroDismissed } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');
    dismissIntro('userX');
    let written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
    expect(written).toContain('userX');
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(written));
    dismissIntro('userX'); // tekrar
    // ikinci yazımda duplicate olmamalı
    const secondWrite = mockedFs.writeFileSync.mock.calls[1];
    if (secondWrite) {
      const data2 = JSON.parse(secondWrite[1] as string);
      expect(data2.filter((x: string) => x === 'userX')).toHaveLength(1);
    }
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(written));
    expect(isIntroDismissed('userX')).toBe(true);
    expect(isIntroDismissed('other')).toBe(false);
    expect(getIntroDismissed()).toContain('userX');
  });
});
describe('Storage - Kick Settings', () => {
  beforeEach(() => jest.clearAllMocks());

  function read(): any[] {
    const written = mockedFs.writeFileSync.mock.calls.at(-1)![1] as string;
    return JSON.parse(written);
  }

  test('updateKickSettings alanları yazar', async () => {
    const { updateKickSettings } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('[]');

    updateKickSettings('g1', { kickSlug: 'xqc', kickChannelId: 'c1' });

    const saved = read();
    expect(saved[0].kickSlug).toBe('xqc');
    expect(saved[0].kickChannelId).toBe('c1');
  });

  test('null değer alanı SİLER — "varsayılana dön" regresyon testi', async () => {
    const { updateKickSettings } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([
      { guildId: 'g1', announcementChannelId: '', allowedRoles: [], kickEndedText: 'eski özel metin' }
    ]));

    updateKickSettings('g1', { kickEndedText: null });

    const saved = read();
    expect(saved[0]).not.toHaveProperty('kickEndedText');
  });

  test('undefined değer de alanı SİLER', async () => {
    const { updateKickSettings } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([
      { guildId: 'g1', announcementChannelId: '', allowedRoles: [], kickLiveText: 'eski' }
    ]));

    updateKickSettings('g1', { kickLiveText: undefined });

    expect(read()[0]).not.toHaveProperty('kickLiveText');
  });

  test('ping modu değişince eski rol id silinir', async () => {
    const { updateKickSettings } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([
      { guildId: 'g1', announcementChannelId: '', allowedRoles: [], kickPingType: 'role', kickPingRoleId: 'r1' }
    ]));

    updateKickSettings('g1', { kickPingType: 'everyone', kickPingRoleId: null });

    const saved = read();
    expect(saved[0].kickPingType).toBe('everyone');
    expect(saved[0]).not.toHaveProperty('kickPingRoleId');
  });

  test('clearKickSettings tüm kick alanlarını siler', async () => {
    const { clearKickSettings } = await import('../src/utils/storage.ts');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([
      {
        guildId: 'g1', announcementChannelId: '', allowedRoles: ['r0'],
        kickSlug: 'xqc', kickChannelId: 'c1', kickPingType: 'role', kickPingRoleId: 'r1',
        kickLiveText: 'a', kickEndedText: 'b'
      }
    ]));

    clearKickSettings('g1');

    const saved = read()[0];
    expect(saved.kickSlug).toBeUndefined();
    expect(saved.kickChannelId).toBeUndefined();
    expect(saved.kickPingType).toBeUndefined();
    expect(saved.kickPingRoleId).toBeUndefined();
    expect(saved.kickLiveText).toBeUndefined();
    expect(saved.kickEndedText).toBeUndefined();
    expect(saved.allowedRoles).toEqual(['r0']);
  });
});
