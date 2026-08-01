import { parseTimeInput, formatDuration, getTimeUntil } from '../src/utils/timeParser.ts';

describe('timeParser - parseTimeInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should parse "1h" correctly', () => {
    const result = parseTimeInput('1h');
    const expectedTime = Date.now() + 60 * 60 * 1000;
    expect(result.expiresAt).toBe(expectedTime);
    expect(result.originalInput).toBe('1h');
  });

  test('should parse "30m" correctly', () => {
    const result = parseTimeInput('30m');
    const expectedTime = Date.now() + 30 * 60 * 1000;
    expect(result.expiresAt).toBe(expectedTime);
  });

  test('should parse "1h 30m" correctly', () => {
    const result = parseTimeInput('1h 30m');
    const expectedTime = Date.now() + (60 * 60 * 1000) + (30 * 60 * 1000);
    expect(result.expiresAt).toBe(expectedTime);
  });

  test('should parse "2d" as 2 dakika', () => {
    const result = parseTimeInput('2d');
    const expectedTime = Date.now() + 2 * 60 * 1000;
    expect(result.expiresAt).toBe(expectedTime);
    expect(result.totalMs).toBe(2 * 60 * 1000);
  });

  test('should parse "2day" as 2 gün', () => {
    const result = parseTimeInput('2day');
    const expectedTime = Date.now() + 2 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt).toBe(expectedTime);
    expect(result.totalMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  test('should parse date format "2024-12-31 23:59"', () => {
    const result = parseTimeInput('2024-12-31 23:59');
    const expectedTime = new Date(2024, 11, 31, 23, 59, 0, 0).getTime();
    expect(result.expiresAt).toBe(expectedTime);
  });

  test('should parse date format "2024-12-31" (00:00 default)', () => {
    const result = parseTimeInput('2024-12-31');
    const expectedTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
    expect(result.expiresAt).toBe(expectedTime);
  });

  test('should throw error for past date', () => {
    expect(() => parseTimeInput('2023-01-01')).toThrow('Geçmiş bir tarih giremezsiniz');
  });

  test('should throw error for invalid format', () => {
    expect(() => parseTimeInput('abc')).toThrow('Geçersiz zaman');
  });

  test('should throw error for empty input', () => {
    expect(() => parseTimeInput('')).toThrow('Geçerli bir zaman');
  });

  test('should throw error for zero duration', () => {
    expect(() => parseTimeInput('0h')).toThrow('Süre 0 olamaz');
  });
});

describe('timeParser - formatDuration', () => {
  test('should format milliseconds correctly', () => {
    const oneHour = 60 * 60 * 1000;
    expect(formatDuration(oneHour)).toMatch(/1s/);

    const oneDay = 24 * 60 * 60 * 1000;
    expect(formatDuration(oneDay)).toMatch(/1g/);

    const fiveMin = 5 * 60 * 1000;
    expect(formatDuration(fiveMin)).toMatch(/5dk/);
  });

  test('should return "Süre doldu" for 0 or negative', () => {
    expect(formatDuration(0)).toBe('Süre doldu');
    expect(formatDuration(-1000)).toBe('Süre doldu');
  });
});

describe('timeParser - getTimeUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should return remaining time', () => {
    const future = Date.now() + 60 * 60 * 1000; // 1 hour
    const result = getTimeUntil(future);
    expect(result).toBe(60 * 60 * 1000);
  });

  test('should return 0 for past time', () => {
    const past = Date.now() - 1000;
    const result = getTimeUntil(past);
    expect(result).toBe(0);
  });
});