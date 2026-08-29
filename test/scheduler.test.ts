import { formatDuration, getTimeUntil } from '../src/utils/timeParser.ts';

describe('scheduler helpers via timeParser', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  test('getTimeUntil future', () => {
    const future = Date.now() + 5000;
    expect(getTimeUntil(future)).toBe(5000);
  });

  test('getTimeUntil past -> 0', () => {
    expect(getTimeUntil(Date.now() - 1000)).toBe(0);
  });

  test('formatDuration 0 -> Süre doldu', () => {
    expect(formatDuration(0)).toBe('Süre doldu');
    expect(formatDuration(-1)).toBe('Süre doldu');
  });

  test('formatDuration 1sn', () => {
    expect(formatDuration(1000)).toBe('1sn');
    expect(formatDuration(59000)).toBe('59sn');
  });

  test('formatDuration dakikalar', () => {
    expect(formatDuration(65 * 1000)).toBe('1dk 5sn');
    expect(formatDuration(5 * 60 * 1000)).toBe('5dk 0sn');
  });

  test('formatDuration saatler', () => {
    expect(formatDuration(60 * 60 * 1000)).toMatch(/1s/);
    expect(formatDuration(2 * 60 * 60 * 1000 + 30 * 60 * 1000)).toMatch(/2s/);
  });

  test('formatDuration günler', () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toMatch(/1g/);
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toMatch(/3g/);
  });

  test('elapsed %50 threshold', () => {
    const totalMs = 100000;
    const timeLeft = 50000;
    const elapsed = totalMs - timeLeft;
    expect(elapsed).toBe(50000);
    expect(elapsed >= totalMs * 0.5).toBe(true);
    expect(elapsed >= totalMs * 0.75).toBe(false);
  });

  test('elapsed %75 threshold', () => {
    const totalMs = 100000;
    const timeLeft = 20000;
    const elapsed = totalMs - timeLeft;
    expect(elapsed >= totalMs * 0.75).toBe(true);
  });

  test('expired timeLeft <=0', () => {
    const past = Date.now() - 1000;
    expect(getTimeUntil(past)).toBe(0);
  });

  test('progress pct 40% -> bar 4/10', () => {
    const totalMs = 100000;
    const timeLeft = 60000;
    const elapsed = totalMs - timeLeft;
    const pct = Math.round((elapsed / totalMs) * 100);
    expect(pct).toBe(40);
    const filled = Math.round(pct / 10);
    expect(filled).toBe(4);
    const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
    expect(bar).toBe('▰▰▰▰▱▱▱▱▱▱');
  });
});
