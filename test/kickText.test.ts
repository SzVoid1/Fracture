import {
  renderKickMessage,
  renderKickDescription,
  buildKickTextData,
  expandBShortcut,
  stripLeadingTitle,
  truncateKickText,
  DEFAULT_LIVE_MESSAGE,
  DEFAULT_ENDED_MESSAGE,
  MAX_MESSAGE_LENGTH
} from '../src/utils/kickText.ts';

const BASE = {
  title: 'Yeni Video',
  category: 'Just Chatting',
  slug: 'testci',
  startedAt: Date.UTC(2026, 9, 1, 22, 0, 0),
  endedAt: Date.UTC(2026, 9, 4, 10, 12, 0),
  durationMs: 60 * 60 * 1000,
  viewerCount: 150,
  guildName: 'Fracture Sunucu'
};

const START_TS = Math.floor(BASE.startedAt / 1000);
const END_TS = Math.floor(BASE.endedAt / 1000);
const START_DISCORD = `<t:${START_TS}:F>`;

describe('kickText buildKickTextData', () => {
  test('eksik alanlar güvenli varsayılana döner', () => {
    const data = buildKickTextData({ slug: 'abc' });
    expect(data.title).toBe('Başlıksız Yayın');
    expect(data.category).toBe('');
    expect(data.link).toBe('https://kick.com/abc');
    expect(data.startedAt).toBe(0);
    expect(data.durationMs).toBe(0);
  });

  test('link slug\'dan türetilir', () => {
    expect(buildKickTextData({ slug: 'xqc' }).link).toBe('https://kick.com/xqc');
  });
});

describe('expandBShortcut', () => {
  test('{b} placeholder olarak genişler', () => {
    expect(expandBShortcut('{b} yayında')).toBe('{başlık} yayında');
    expect(expandBShortcut('{B} yayında')).toBe('{başlık} yayında');
  });

  test('tek başına duran b genişler', () => {
    expect(expandBShortcut('b yayında')).toBe('{başlık} yayında');
    expect(expandBShortcut('Gel b , izle')).toBe('Gel {başlık} , izle');
    expect(expandBShortcut('(b) izle')).toBe('({başlık}) izle');
  });

  test('kelime içindeki b DOKUNULMAZ', () => {
    expect(expandBShortcut('baba bize')).toBe('baba bize');
    expect(expandBShortcut('bir bab')).toBe('bir bab');
  });
});

describe('stripLeadingTitle', () => {
  test('baştaki başlık placeholder\'ı kaldırılır', () => {
    expect(stripLeadingTitle('{başlık}\n\nMerhaba')).toBe('Merhaba');
    expect(stripLeadingTitle('{baslik}\n\nMerhaba')).toBe('Merhaba');
    expect(stripLeadingTitle('{başlık} — Merhaba')).toBe('Merhaba');
  });

  test('ortadaki başlık yerinde kalır', () => {
    expect(stripLeadingTitle('Merhaba {başlık}')).toBe('Merhaba {başlık}');
  });

  test('başlık yoksa dokunmaz', () => {
    expect(stripLeadingTitle('Merhaba')).toBe('Merhaba');
  });
});

describe('renderKickMessage', () => {
  test('tüm placeholder\'lar doldurulur', () => {
    const out = renderKickMessage(
      '{kategori}|{slug}|{link}|{baslangic}|{bitis}|{sure}|{izleyici}|{sunucu}|{baslik}',
      BASE,
      true
    );
    expect(out).toContain('Just Chatting');
    expect(out).toContain('testci');
    expect(out).toContain('https://kick.com/testci');
    expect(out).toContain(START_DISCORD);
    expect(out).toContain(`<t:${END_TS}:F>`);
    expect(out).toContain('1s 0dk 0sn');
    expect(out).toContain('150');
    expect(out).toContain('Fracture Sunucu');
    expect(out).toContain('Yeni Video');
  });

  test('türkçe karakterli placeholder normalize edilir', () => {
    expect(renderKickMessage('{kategori} - {başlık}', BASE)).toBe(`Just Chatting - Yeni Video`);
  });

  test('baştaki {başlık} kaldırılır (başlık zaten en üstte)', () => {
    expect(renderKickMessage('{başlık} ve {başlangic}', BASE)).toBe(`ve ${START_DISCORD}`);
    expect(renderKickMessage('{baslik}', BASE)).toBe('');
  });

  test('ASCII ve Türkçe yazım aynı sonucu verir', () => {
    expect(renderKickMessage('x {baslik} y', BASE)).toBe('x Yeni Video y');
    expect(renderKickMessage('x {başlık} y', BASE)).toBe('x Yeni Video y');
    expect(renderKickMessage('{kategori}', BASE)).toBe('Just Chatting');
    expect(renderKickMessage('{baslangic}', BASE)).toBe(START_DISCORD);
  });

  test('büyük harfli Türkçe placeholder (İzleyici)', () => {
    expect(renderKickMessage('{İzleyici}', { slug: 'x', title: 't', viewerCount: 5 }, true)).toBe('5');
  });

  test('bilinmeyen placeholder literal kalır', () => {
    expect(renderKickMessage('{yokboyle}', BASE)).toBe('{yokboyle}');
  });

  test('b kısaltması placeholder\'a çevrilir', () => {
    expect(renderKickMessage('şu an b yayında', BASE)).toBe('şu an Yeni Video yayında');
  });

  test('baştaki b kısaltması da KORUNUR (legacy temizleme b\'yi yutmamalı)', () => {
    expect(renderKickMessage('b konusunda yayındayız', BASE)).toBe('Yeni Video konusunda yayındayız');
    expect(renderKickMessage('{b} konusunda yayındayız', BASE)).toBe('Yeni Video konusunda yayındayız');
  });

  test('varsayılan mesajlarda başlık YOK (üstte ayrı gösteriliyor)', () => {
    expect(renderKickMessage(undefined, BASE)).toBe(DEFAULT_LIVE_MESSAGE);
    expect(renderKickMessage(undefined, BASE, true)).toBe(DEFAULT_ENDED_MESSAGE);
    expect(DEFAULT_LIVE_MESSAGE).not.toContain('{');
    expect(DEFAULT_ENDED_MESSAGE).not.toContain('{');
  });

  test('boş string de varsayılana döner', () => {
    expect(renderKickMessage('   ', BASE)).toBe(DEFAULT_LIVE_MESSAGE);
  });

  test('eski kayıt: başta {başlık} varsa tekrar etiketlenmez', () => {
    expect(renderKickMessage('{başlık}\n\nMerhaba', BASE)).toBe('Merhaba');
  });

  test('bilinmeyen başlangıç/bitiş zamanı "Bilinmiyor"', () => {
    expect(renderKickMessage('{baslangic}', { slug: 'x', title: 't' })).toBe('Bilinmiyor');
    expect(renderKickMessage('{bitis}', { slug: 'x', title: 't' }, true)).toBe('Bilinmiyor');
  });

  test('süre bilinmiyorsa "Bilinmiyor" (Süre doldu değil)', () => {
    expect(renderKickMessage('{sure}', { slug: 'x', title: 't' }, true)).toBe('Bilinmiyor');
  });

  test('izleyici 0 ise "Bilinmiyor"', () => {
    expect(renderKickMessage('{izleyici}', { slug: 'x', title: 't', viewerCount: 0 }, true)).toBe('Bilinmiyor');
  });

  test('izleyici tr-TR binlik ayracıyla biçimlenir', () => {
    expect(renderKickMessage('{izleyici}', { slug: 'x', title: 't', viewerCount: 258865 }, true)).toBe('258.865');
  });

  test('kategori boşsa placeholder boş stringe döner', () => {
    expect(renderKickMessage('[|{kategori}]', { slug: 'x', title: 't' })).toBe('[|]');
  });

  test('Discord limitinde kırpar', () => {
    const out = renderKickMessage('a'.repeat(MAX_MESSAGE_LENGTH + 500), BASE);
    expect(out.length).toBe(MAX_MESSAGE_LENGTH);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('renderKickDescription', () => {
  test('başlık HER ZAMAN en üstte + altında ek mesaj', () => {
    const out = renderKickDescription(undefined, BASE);
    expect(out).toBe(`Yeni Video\n\n${DEFAULT_LIVE_MESSAGE}`);
  });

  test('bitti açıklaması da başlıkla başlar', () => {
    const out = renderKickDescription(undefined, BASE, true);
    expect(out).toBe(`Yeni Video\n\n${DEFAULT_ENDED_MESSAGE}`);
  });

  test('özel mesaj başlık altına eklenir', () => {
    const out = renderKickDescription('Gel izle!', BASE);
    expect(out).toBe('Yeni Video\n\nGel izle!');
  });

  test('özel mesajda {başlık} kullanılırsa gerekçeli tekrar olur', () => {
    const out = renderKickDescription('şu an b yayında', BASE);
    expect(out).toBe('Yeni Video\n\nşu an Yeni Video yayında');
  });

  test('başlık template\'de değilse bile üstte görünür', () => {
    const out = renderKickDescription('Sadece mesaj', BASE);
    expect(out.startsWith('Yeni Video')).toBe(true);
  });

  test('ek mesaj boşsa sadece başlık', () => {
    const out = renderKickDescription('{kategori}', { slug: 'x', title: 'Sadece Başlık' });
    expect(out).toBe('Sadece Başlık');
  });

  test('başlık yoksa varsayılan başlık metni kullanılır', () => {
    expect(renderKickDescription(undefined, { slug: 'x' }).startsWith('Başlıksız Yayın')).toBe(true);
  });
});

describe('truncateKickText', () => {
  test('kısa metne dokunmaz', () => {
    expect(truncateKickText('abc', 10)).toBe('abc');
  });

  test('tam sınırda dokunmaz', () => {
    expect(truncateKickText('abcde', 5)).toBe('abcde');
  });

  test('uzun metni kırpar ve sonuna … koyar', () => {
    expect(truncateKickText('abcdefgh', 5)).toBe('abcd…');
  });
});