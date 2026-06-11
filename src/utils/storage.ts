import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const COOLDOWNS_FILE = path.join(DATA_DIR, 'cooldowns.json');

interface Announcement {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  roleId: string;
  title: string;
  description: string;
  createdAt: number;
  expiresAt: number;
  totalMs: number;
  seenBy: string[];
  halfwayNotified: boolean;
  finalDmNotified: boolean;
}

interface Settings {
  guildId: string;
  announcementChannelId: string;
  allowedRoles: string[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getAnnouncements(): Announcement[] {
  return readJson<Announcement[]>(ANNOUNCEMENTS_FILE, []);
}

export function saveAnnouncements(announcements: Announcement[]): void {
  writeJson(ANNOUNCEMENTS_FILE, announcements);
}

export function addAnnouncement(announcement: Announcement): void {
  const announcements = getAnnouncements();
  announcements.push(announcement);
  saveAnnouncements(announcements);
}

export function updateAnnouncement(id: string, updates: Partial<Announcement>): boolean {
  const announcements = getAnnouncements();
  const index = announcements.findIndex(a => a.id === id);
  if (index === -1) return false;
  announcements[index] = { ...announcements[index], ...updates };
  saveAnnouncements(announcements);
  return true;
}

export function removeAnnouncement(id: string): boolean {
  const announcements = getAnnouncements();
  const filtered = announcements.filter(a => a.id !== id);
  if (filtered.length === announcements.length) return false;
  saveAnnouncements(filtered);
  return true;
}

export function getAnnouncement(id: string): Announcement | undefined {
  return getAnnouncements().find(a => a.id === id);
}

export function getSettings(): Settings[] {
  return readJson<Settings[]>(SETTINGS_FILE, []);
}

export function saveSettings(settings: Settings[]): void {
  writeJson(SETTINGS_FILE, settings);
}

export function getGuildSettings(guildId: string): Settings | undefined {
  return getSettings().find(s => s.guildId === guildId);
}

export function setGuildSettings(settings: Settings): void {
  const all = getSettings();
  const index = all.findIndex(s => s.guildId === settings.guildId);
  if (index >= 0) {
    all[index] = settings;
  } else {
    all.push(settings);
  }
  saveSettings(all);
}

export function addAllowedRole(guildId: string, roleId: string): void {
  const settings = getGuildSettings(guildId) || { guildId, announcementChannelId: '', allowedRoles: [] };
  if (!settings.allowedRoles.includes(roleId)) {
    settings.allowedRoles.push(roleId);
    setGuildSettings(settings);
  }
}

export function removeAllowedRole(guildId: string, roleId: string): void {
  const settings = getGuildSettings(guildId);
  if (settings) {
    settings.allowedRoles = settings.allowedRoles.filter(r => r !== roleId);
    setGuildSettings(settings);
  }
}

// Cooldown system
interface CooldownEntry {
  userId: string;
  expiresAt: number;
}

function getCooldowns(): CooldownEntry[] {
  return readJson<CooldownEntry[]>(COOLDOWNS_FILE, []);
}

function saveCooldowns(cooldowns: CooldownEntry[]): void {
  writeJson(COOLDOWNS_FILE, cooldowns);
}

export function setCooldown(userId: string, durationMs: number): void {
  const cooldowns = getCooldowns();
  const index = cooldowns.findIndex(c => c.userId === userId);
  const entry = { userId, expiresAt: Date.now() + durationMs };
  if (index >= 0) {
    cooldowns[index] = entry;
  } else {
    cooldowns.push(entry);
  }
  saveCooldowns(cooldowns);
}

export function checkCooldown(userId: string): { onCooldown: boolean; remainingMs: number } {
  const cooldowns = getCooldowns();
  const entry = cooldowns.find(c => c.userId === userId);
  if (!entry) return { onCooldown: false, remainingMs: 0 };

  const remaining = entry.expiresAt - Date.now();
  if (remaining <= 0) {
    saveCooldowns(cooldowns.filter(c => c.userId !== userId));
    return { onCooldown: false, remainingMs: 0 };
  }

  return { onCooldown: true, remainingMs: remaining };
}