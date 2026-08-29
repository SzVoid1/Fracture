import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const COOLDOWNS_FILE = path.join(DATA_DIR, 'cooldowns.json');
const INTRO_FILE = path.join(DATA_DIR, 'introDismissed.json');

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
  authorId?: string;
  authorTag?: string;
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

let announcementsCache: Announcement[] | null = null;
let announcementsCacheAt = 0;
const CACHE_TTL = 5000;

function migrateAnnouncements(list: Announcement[]): Announcement[] {
  let mutated = false;
  for (const ann of list) {
    if (!ann.seenBy) { (ann as any).seenBy = []; mutated = true; }
    if (ann.halfwayNotified === undefined) { ann.halfwayNotified = false; mutated = true; }
    if (ann.finalDmNotified === undefined) { ann.finalDmNotified = false; mutated = true; }
    if (!ann.totalMs || ann.totalMs <= 0) { ann.totalMs = Math.max(1000, ann.expiresAt - ann.createdAt); mutated = true; }
    if (!ann.authorId) { ann.authorId = 'unknown'; mutated = true; }
    if (!ann.authorTag) { ann.authorTag = 'Bilinmeyen'; mutated = true; }
    // Ensure IDs are strings
    if (typeof ann.id !== 'string') { (ann as any).id = String(ann.id); mutated = true; }
  }
  if (mutated) {
    writeJson(ANNOUNCEMENTS_FILE, list);
  }
  return list;
}

export function getAnnouncements(): Announcement[] {
  const now = Date.now();
  if (announcementsCache && (now - announcementsCacheAt) < CACHE_TTL) {
    return [...announcementsCache];
  }
  const list = readJson<Announcement[]>(ANNOUNCEMENTS_FILE, []);
  const migrated = migrateAnnouncements(list);
  announcementsCache = [...migrated];
  announcementsCacheAt = now;
  return [...migrated];
}

function invalidateAnnouncementsCache(): void {
  announcementsCache = null;
}

export function __clearAnnouncementsCache(): void {
  invalidateAnnouncementsCache();
}

export function saveAnnouncements(announcements: Announcement[]): void {
  writeJson(ANNOUNCEMENTS_FILE, announcements);
  invalidateAnnouncementsCache();
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

// Intro dismissed (one-time wizard info)
export function getIntroDismissed(): string[] {
  return readJson<string[]>(INTRO_FILE, []);
}

export function isIntroDismissed(userId: string): boolean {
  return getIntroDismissed().includes(userId);
}

export function dismissIntro(userId: string): void {
  const list = getIntroDismissed();
  if (!list.includes(userId)) {
    list.push(userId);
    writeJson(INTRO_FILE, list);
  }
}