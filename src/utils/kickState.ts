import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KICK_STATE_FILE = path.join(DATA_DIR, 'kickState.json');

export interface KickState {
  guildId: string;
  sessionKey: string;
  messageId: string;
  slug: string;
  title: string;
  category: string;
  thumbnail: string;
  imageSource: 'asset' | 'kick' | '';
  startedAt: number;
  lastViewers: number;
  lastCheckedAt: number;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStates(): KickState[] {
  ensureDataDir();
  if (!fs.existsSync(KICK_STATE_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(KICK_STATE_FILE, 'utf-8')) as KickState[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStates(states: KickState[]): void {
  ensureDataDir();
  fs.writeFileSync(KICK_STATE_FILE, JSON.stringify(states, null, 2));
}

export function getKickState(guildId: string): KickState | undefined {
  return readStates().find(s => s.guildId === guildId);
}

export function getAllKickStates(): KickState[] {
  return readStates();
}

export function setKickState(state: KickState): void {
  const states = readStates();
  const index = states.findIndex(s => s.guildId === state.guildId);
  if (index >= 0) {
    states[index] = state;
  } else {
    states.push(state);
  }
  writeStates(states);
}

export function clearKickState(guildId: string): boolean {
  const states = readStates();
  const filtered = states.filter(s => s.guildId !== guildId);
  if (filtered.length === states.length) return false;
  writeStates(filtered);
  return true;
}
