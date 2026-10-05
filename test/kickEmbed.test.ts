import {
  buildKickLiveEmbed,
  buildKickEndedEmbed,
  buildKickLinkButton,
  buildKickPingContent,
  KICK_LIVE_COLOR,
  KICK_ENDED_COLOR
} from '../src/utils/kickEmbed.ts';

const LIVE_DATA = {
  slug: 'testci',
  title: 'Yayındayız!',
  category: 'Just Chatting',
  thumbnail: 'https://files.kick.com/thumb.png',
  startedAt: Date.UTC(2026, 9, 1, 22, 0, 0)
};

const ENDED_DATA = {
  ...LIVE_DATA,
  endedAt: Date.UTC(2026, 9, 4, 10, 12, 0),
  viewerCount: 258865
};

describe('buildKickLiveEmbed', () => {
  test('başlık, renk ve açıklama', () => {
    const embed = buildKickLiveEmbed(LIVE_DATA, 'Herkesi bekliyoruz!');
    const json = embed.toJSON();
    expect(json.title).toBe('🔴 YAYINDAYIZ!');
    expect(json.description).toBe('Herkesi bekliyoruz!');
    expect(json.color).toBe(KICK_LIVE_COLOR);
  });

test('görsel açıkça geçilir (görsel çözümü çağıranın işidir)', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x', undefined, {
      url: 'https://files.kick.com/thumb.png',
      source: 'kick'
    }).toJSON();
    expect(json.image?.url).toBe('https://files.kick.com/thumb.png');
  });

  test('thumbnail yoksa image eklenmez', () => {
    const json = buildKickLiveEmbed({ ...LIVE_DATA, thumbnail: '' }, 'x').toJSON();
    expect(json.image).toBeUndefined();
  });

  test('kategori ve başlangıç field\'ları', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x').toJSON();
    const names = json.fields!.map(f => f.name);
    expect(names).toContain('🎮 Kategori');
    expect(names).toContain('🕐 Başlangıç');
    expect(json.fields!.find(f => f.name === '🎮 Kategori')?.value).toBe('Just Chatting');
    expect(json.fields!.find(f => f.name === '🕐 Başlangıç')?.value).toContain('<t:');
  });

  test('kategori yoksa kategori field\'ı eklenmez', () => {
    const json = buildKickLiveEmbed({ ...LIVE_DATA, category: '' }, 'x').toJSON();
    expect(json.fields!.map(f => f.name)).not.toContain('🎮 Kategori');
  });

  test('izleyici ve dil bilgisi YOK', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x').toJSON();
    const all = JSON.stringify(json);
    expect(all).not.toContain('İzleyici');
    expect(all).not.toContain('Son İzleyici');
    expect(all).not.toContain('Dil');
  });

  test('başlangıç bilinmiyorsa "Bilinmiyor"', () => {
    const json = buildKickLiveEmbed({ ...LIVE_DATA, startedAt: 0 }, 'x').toJSON();
    expect(json.fields!.find(f => f.name === '🕐 Başlangıç')?.value).toBe('Bilinmiyor');
  });

  test('footer kick linki ve sunucu adı', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x', 'Fracture Sunucu').toJSON();
    expect(json.footer?.text).toContain('https://kick.com/testci');
    expect(json.footer?.text).toContain('Fracture Sunucu');
  });

  test('sunucu adı verilmezse footer sadece link', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x').toJSON();
    expect(json.footer?.text).toBe('Fracture • https://kick.com/testci');
  });
});

describe('buildKickEndedEmbed', () => {
  test('başlık ve renk değişir', () => {
    const json = buildKickEndedEmbed(ENDED_DATA, 'Yayın bitti').toJSON();
    expect(json.title).toBe('⚫ YAYIN BİTTİ!');
    expect(json.color).toBe(KICK_ENDED_COLOR);
    expect(json.description).toBe('Yayın bitti');
  });

  test('son izleyici, başlangıç, bitiş ve süre field\'ları', () => {
    const json = buildKickEndedEmbed(ENDED_DATA, 'x').toJSON();
    const names = json.fields!.map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['👥 Son İzleyici', '🕐 Başlangıç', '🕑 Bitiş', '⏱️ Süre']));
    expect(json.fields!.find(f => f.name === '👥 Son İzleyici')?.value).toBe('258.865');
  });

  test('süre hesaplanır', () => {
    const json = buildKickEndedEmbed({
      ...ENDED_DATA,
      endedAt: LIVE_DATA.startedAt + 3 * 60 * 60 * 1000 + 25 * 60 * 1000
    }, 'x').toJSON();
    expect(json.fields!.find(f => f.name === '⏱️ Süre')?.value).toBe('3sa 25dk');
  });

  test('gün cinsinden süre', () => {
    const json = buildKickEndedEmbed({
      ...ENDED_DATA,
      endedAt: LIVE_DATA.startedAt + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000
    }, 'x').toJSON();
    expect(json.fields!.find(f => f.name === '⏱️ Süre')?.value).toBe('2g 5sa');
  });

  test('süre 1 dk altındaysa', () => {
    const json = buildKickEndedEmbed({
      ...ENDED_DATA,
      endedAt: LIVE_DATA.startedAt + 30 * 1000
    }, 'x').toJSON();
    expect(json.fields!.find(f => f.name === '⏱️ Süre')?.value).toBe('1dkden az');
  });

  test('biliinmeyen süre / izleyici "Bilinmiyor" olur', () => {
    const json = buildKickEndedEmbed({ ...ENDED_DATA, startedAt: 0, endedAt: 0, viewerCount: 0 }, 'x').toJSON();
    expect(json.fields!.find(f => f.name === '⏱️ Süre')?.value).toBe('Bilinmiyor');
    expect(json.fields!.find(f => f.name === '👥 Son İzleyici')?.value).toBe('Bilinmiyor');
  });

  test('kategori yoksa kategori field\'ı eklenmez', () => {
    const json = buildKickEndedEmbed({ ...ENDED_DATA, category: '' }, 'x').toJSON();
    expect(json.fields!.map(f => f.name)).not.toContain('🎮 Kategori');
  });

  test('açıklama boşsa description ayarlanmaz', () => {
    const json = buildKickEndedEmbed(ENDED_DATA, '').toJSON();
    expect(json.description).toBeUndefined();
  });
});

describe('buildKickLinkButton', () => {
  test('link butonu doğru URL\'i gösterir', () => {
    const json = buildKickLinkButton('testci').toJSON() as any;
    const button = json.components[0];
    expect(button.url).toBe('https://kick.com/testci');
    expect(button.label).toBe("Kick'te İzle");
    expect(button.style).toBe(5);
  });
});

describe('buildKickPingContent', () => {
  test('everyone modu', () => {
    expect(buildKickPingContent('everyone')).toBe('@everyone');
  });

  test('role modu', () => {
    expect(buildKickPingContent('role', '123')).toBe('<@&123>');
  });

  test('role modunda rol id yoksa boş', () => {
    expect(buildKickPingContent('role')).toBe('');
  });

  test('none modu / tanımsız', () => {
    expect(buildKickPingContent('none')).toBe('');
    expect(buildKickPingContent(undefined)).toBe('');
  });
});

describe('kickEmbed - özel görsel (assets/kick)', () => {
  const assetImage = { url: 'attachment://start.png', source: 'asset' as const };
  const kickImage = { url: 'https://images.kick.com/thumb/480.webp', source: 'kick' as const };

  test('live embed attachment:// referansını kullanır', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x', undefined, assetImage).toJSON();
    expect(json.image?.url).toBe('attachment://start.png');
  });

  test('ended embed attachment://finish.png referansını kullanır', () => {
    const json = buildKickEndedEmbed(ENDED_DATA, 'x', undefined, { url: 'attachment://finish.png', source: 'asset' }).toJSON();
    expect(json.image?.url).toBe('attachment://finish.png');
  });

  test('Kick görseli verilirse onu kullanır', () => {
    const json = buildKickLiveEmbed(LIVE_DATA, 'x', undefined, kickImage).toJSON();
    expect(json.image?.url).toBe('https://images.kick.com/thumb/480.webp');
  });

  test('görsel null/verilmezse image OLMAMALI (bozuk link yerine boş)', () => {
    expect(buildKickLiveEmbed(LIVE_DATA, 'x').toJSON().image).toBeUndefined();
    expect(buildKickLiveEmbed(LIVE_DATA, 'x', undefined, null).toJSON().image).toBeUndefined();
    expect(buildKickEndedEmbed(ENDED_DATA, 'x', undefined, null).toJSON().image).toBeUndefined();
  });

  test('data.thumbnail dolu olsa bile image parametresi verilmezse kullanılmaz', () => {
    // Görsel artık açıkça geçiriliyor; thumbnail alanı embed'e otomatik yazılmıyor.
    expect(buildKickLiveEmbed(LIVE_DATA, 'x').toJSON().image).toBeUndefined();
  });
});
