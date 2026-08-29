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