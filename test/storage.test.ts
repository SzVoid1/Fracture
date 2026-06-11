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
  removeAllowedRole
} from '../src/utils/storage';

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

    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1] as string);
    expect(writtenData[0].seenBy).toContain('user1');
  });

  test('removeAnnouncement should delete existing announcement', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([mockAnnouncement]));

    const result = removeAnnouncement('ann_test123');
    expect(result).toBe(true);

    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1] as string);
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
});