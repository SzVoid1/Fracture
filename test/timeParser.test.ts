import { parseColonDuration, parseTimeInput, formatDuration, formatColonPreview, getTimeUntil } from '../src/utils/timeParser.ts';

describe('timeParser - parseColonDuration (GG:HH:MM:SS sağa dayalı)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('2:00 -> 2 dakika', () => {
    const r = parseColonDuration('2:00');
    expect(r.totalMs).toBe(2 * 60 * 1000);
    expect(r.expiresAt).toBe(Date.now() + 2 * 60 * 1000);
  });

  test('2:0:0 -> 2 saat', () => {
    const r = parseColonDuration('2:0:0');
    expect(r.totalMs).toBe(2 * 60 * 60 * 1000);
  });

  test('00:2:00:00 & 0:2:0:0 -> 2 saat', () => {
    expect(parseColonDuration('00:2:00:00').totalMs).toBe(2 * 60 * 60 * 1000);
    expect(parseColonDuration('0:2:0:0').totalMs).toBe(2 * 60 * 60 * 1000);
  });

  test('01:20:00:00 -> 1 gün 20 saat', () => {
    const r = parseColonDuration('01:20:00:00');
    expect(r.totalMs).toBe((1 * 24 + 20) * 60 * 60 * 1000);
  });

  test('tek parça "30" -> 30 saniye', () => {
    expect(parseColonDuration('30').totalMs).toBe(30 * 1000);
  });

  test('00:00:15:00 -> 15 dakika', () => {
    expect(parseColonDuration('00:00:15:00').totalMs).toBe(15 * 60 * 1000);
  });

  test('00:01:00:00 -> 1 saat', () => {
    expect(parseColonDuration('00:01:00:00').totalMs).toBe(60 * 60 * 1000);
  });

  test('25 saat normalize -> 1 gün 1 saat (carry)', () => {
    // 00:25:00:00 = 25 saat = 90000000ms = 1g 1sa
    const r = parseColonDuration('00:25:00:00');
    expect(r.totalMs).toBe(25 * 60 * 60 * 1000);
    expect(formatColonPreview(r.totalMs)).toBe('1g 1sa');
  });

  test('61 saniye normalize -> 1dk 1sn', () => {
    const r = parseColonDuration('00:00:00:61');
    expect(r.totalMs).toBe(61 * 1000);
    expect(formatColonPreview(r.totalMs)).toBe('1dk 1sn');
  });

  test('0:0:0:0 -> 0 hata', () => {
    expect(() => parseColonDuration('0:0:0:0')).toThrow('Süre 0 olamaz');
  });

  test('boş input hata', () => {
    expect(() => parseColonDuration('')).toThrow('Süre boş');
  });

  test('5 parça hata', () => {
    expect(() => parseColonDuration('1:2:3:4:5')).toThrow('Geçersiz format');
  });

  test('harf hata', () => {
    expect(() => parseColonDuration('a:b:c:d')).toThrow('Geçersiz değer');
  });

  test('1000 gün -> 365 aşımı hatası (carry ile)', () => {
    expect(() => parseColonDuration('1000:0:0:0')).toThrow('365 günü aşamaz');
  });

  test('365 gün aşımı hata', () => {
    expect(() => parseColonDuration('366:00:00:00')).toThrow('365 günü aşamaz');
  });

  test('365 gün sınırda kabul edilir', () => {
    expect(parseColonDuration('365:00:00:00').totalMs).toBe(365 * 24 * 60 * 60 * 1000);
  });

  test('parseTimeInput alias aynı çalışır', () => {
    expect(parseTimeInput('2:00').totalMs).toBe(parseColonDuration('2:00').totalMs);
  });

  test('trim ve leading zeros: "  00:02:00:00  " -> 2 saat', () => {
    expect(parseColonDuration('  00:02:00:00  ').totalMs).toBe(2 * 60 * 60 * 1000);
  });

  test('01:02:03:04 doğru toplam', () => {
    const r = parseColonDuration('01:02:03:04');
    const exp = 1 * 86400000 + 2 * 3600000 + 3 * 60000 + 4 * 1000;
    expect(r.totalMs).toBe(exp);
  });

  test('001:002:003:004 leading zeros', () => {
    expect(parseColonDuration('001:002:003:004').totalMs).toBe(parseColonDuration('01:02:03:04').totalMs);
  });

  test('0:0:30:0 -> 30 dakika', () => {
    expect(parseColonDuration('0:0:30:0').totalMs).toBe(30 * 60 * 1000);
  });

  test('0:0:0:30 -> 30 saniye', () => {
    expect(parseColonDuration('0:0:0:30').totalMs).toBe(30 * 1000);
  });

  test('0:24:00:00 -> 24 saat (1 gün normalize)', () => {
    const r = parseColonDuration('0:24:00:00');
    expect(formatColonPreview(r.totalMs)).toBe('1g');
  });

  test('0:00:61:00 -> 61 dakika carry 1sa 1dk', () => {
    expect(formatColonPreview(parseColonDuration('0:00:61:00').totalMs)).toBe('1sa 1dk');
  });

  test('boşluklu kısayol " 2:00 " trim', () => {
    expect(parseColonDuration(' 2:00 ').totalMs).toBe(2 * 60 * 1000);
  });

  test('tek sayı "0" -> 0 hata', () => {
    expect(() => parseColonDuration('0')).toThrow('Süre 0 olamaz');
  });

  test('negatif "-1:00:00:00" hata', () => {
    expect(() => parseColonDuration('-1:00:00:00')).toThrow('Geçersiz değer');
  });

  test('çift kolon "1::00" hata', () => {
    expect(() => parseColonDuration('1::00')).toThrow('Geçersiz değer');
  });

  test('365:00:00:01 -> 365 günü aşar hata', () => {
    expect(() => parseColonDuration('365:00:00:01')).toThrow('365 günü aşamaz');
  });

  test('originalInput korunur', () => {
    const r = parseColonDuration('01:20:00:00');
    expect(r.originalInput).toBe('01:20:00:00');
  });

  test('expiresAt yaklaşık now + totalMs', () => {
    const before = Date.now();
    const r = parseColonDuration('00:01:00:00');
    const after = Date.now();
    expect(r.expiresAt).toBeGreaterThanOrEqual(before + 3600000);
    expect(r.expiresAt).toBeLessThanOrEqual(after + 3600000);
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

describe('timeParser - formatColonPreview', () => {
  test('preview doğru', () => {
    expect(formatColonPreview(0)).toBe('0sn');
    expect(formatColonPreview(65 * 1000)).toBe('1dk 5sn');
    expect(formatColonPreview(25 * 60 * 60 * 1000)).toBe('1g 1sa');
    expect(formatColonPreview((1 * 24 * 60 * 60 + 20 * 60 * 60) * 1000)).toBe('1g 20sa');
  });

  test('0sn', () => expect(formatColonPreview(0)).toBe('0sn'));
  test('1sn', () => expect(formatColonPreview(1000)).toBe('1sn'));
  test('1dk', () => expect(formatColonPreview(60 * 1000)).toBe('1dk'));
  test('1sa', () => expect(formatColonPreview(3600000)).toBe('1sa'));
  test('1g', () => expect(formatColonPreview(86400000)).toBe('1g'));
  test('1g 1sa 1dk 1sn', () => expect(formatColonPreview(86400000 + 3600000 + 60000 + 1000)).toBe('1g 1sa 1dk 1sn'));
  test('90sn -> 1dk 30sn', () => expect(formatColonPreview(90 * 1000)).toBe('1dk 30sn'));
  test('3661sn -> 1sa 1dk 1sn', () => expect(formatColonPreview(3661 * 1000)).toBe('1sa 1dk 1sn'));
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
    const future = Date.now() + 60 * 60 * 1000;
    expect(getTimeUntil(future)).toBe(60 * 60 * 1000);
  });
  test('should return 0 for past time', () => {
    expect(getTimeUntil(Date.now() - 1000)).toBe(0);
  });
});
