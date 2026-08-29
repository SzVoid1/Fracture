import { buildAnnouncementEmbed, buildAnnouncementButtons, buildCancelledEmbed } from '../src/utils/announcementEmbed.ts';

describe('announcementEmbed - buildAnnouncementEmbed (C kompakt)', () => {
  const baseAnn = {
    id: 'ann_test123',
    title: 'Test Duyuru',
    description: 'Test açıklama burası',
    channelId: 'ch1',
    roleId: 'role1',
    createdAt: new Date('2024-01-01T12:00:00Z').getTime(),
    expiresAt: new Date('2024-01-02T12:00:00Z').getTime(),
    totalMs: 24 * 60 * 60 * 1000,
    seenBy: [] as string[]
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  test('active: mavi, başlık 📢, 2 field, footer ID sağda + C, bar ve % içerir', () => {
    const embed = buildAnnouncementEmbed(baseAnn, 'active');
    const data = embed.toJSON();
    expect(data.color).toBe(0x5865F2);
    expect(data.title).toBe('📢 Test Duyuru');
    expect(data.description).toContain('Test açıklama');
    expect(data.description).toContain('▱'); // bar
    expect(data.description).toContain('%');
    expect(data.fields).toHaveLength(2);
    expect(data.fields![0].name).toBe('👥 Rol');
    expect(data.fields![0].value).toBe('<@&role1>');
    expect(data.fields![1].name).toBe('⏰ Bitiş');
    expect(data.footer!.text).toBe('ID: ann_test123 • C: Bilinmeyen');
    expect(data.timestamp).toBeDefined();
  });

  test('half: turuncu, başlık %50', () => {
    jest.setSystemTime(new Date('2024-01-01T23:59:59Z')); // ~50%
    const halfAnn = { ...baseAnn, createdAt: new Date('2024-01-01T12:00:00Z').getTime(), expiresAt: new Date('2024-01-02T12:00:00Z').getTime() };
    const embed = buildAnnouncementEmbed(halfAnn, 'half');
    expect(embed.toJSON().color).toBe(0xF39C12);
    expect(embed.toJSON().title).toContain('%50');
  });

  test('critical: kırmızı, başlık %75', () => {
    const embed = buildAnnouncementEmbed(baseAnn, 'critical');
    expect(embed.toJSON().color).toBe(0xE74C3C);
    expect(embed.toJSON().title).toContain('%75');
  });

  test('expired: koyu kırmızı, Süre Doldu, bar %100', () => {
    jest.setSystemTime(new Date('2024-01-03T12:00:00Z')); // geçmiş
    const embed = buildAnnouncementEmbed(baseAnn, 'expired');
    const data = embed.toJSON();
    expect(data.color).toBe(0x8B0000);
    expect(data.title).toContain('Süre Doldu');
    expect(data.description).toContain('süresi dolmuştur');
    expect(data.description).toContain('%100');
  });

  test('cancelled: kırmızı, İptal Edildi', () => {
    const embed = buildAnnouncementEmbed(baseAnn, 'cancelled');
    expect(embed.toJSON().title).toContain('İptal Edildi');
  });

  test('progress bar 0% = 10x ▱', () => {
    // 0 elapsed
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    const ann = { ...baseAnn, createdAt: Date.now(), expiresAt: Date.now() + 100000, totalMs: 100000 };
    const embed = buildAnnouncementEmbed(ann, 'active');
    expect(embed.toJSON().description).toContain('▱'.repeat(10));
    expect(embed.toJSON().description).toContain('%0');
  });

  test('progress bar 50% = 5x ▰ 5x ▱', () => {
    const ann = { ...baseAnn, createdAt: Date.now() - 50000, expiresAt: Date.now() + 50000, totalMs: 100000 };
    const embed = buildAnnouncementEmbed(ann, 'active');
    expect(embed.toJSON().description).toContain('▰'.repeat(5) + '▱'.repeat(5));
    expect(embed.toJSON().description).toContain('%50');
  });

  test('progress bar 100% = 10x ▰', () => {
    jest.setSystemTime(new Date('2024-01-01T12:01:40Z'));
    const ann = { ...baseAnn, createdAt: Date.now() - 100000, expiresAt: Date.now(), totalMs: 100000 };
    const embed = buildAnnouncementEmbed(ann, 'active');
    // at exactly 100% or expired? active still shows 100%
    // force expired to check 100
    const expEmbed = buildAnnouncementEmbed(ann, 'expired');
    expect(expEmbed.toJSON().description).toContain('▰'.repeat(10));
  });

  test('description kalan formatColonPreview içerir', () => {
    const ann = { ...baseAnn, totalMs: 65 * 1000, expiresAt: Date.now() + 65000 };
    const embed = buildAnnouncementEmbed(ann, 'active');
    expect(embed.toJSON().description).toMatch(/Kalan:/);
  });

  test('footer ID sağda + C', () => {
    const embed = buildAnnouncementEmbed(baseAnn, 'active');
    expect(embed.toJSON().footer!.text).toBe('ID: ann_test123 • C: Bilinmeyen');
  });

  test('footer C: kişi görünür', () => {
    const annWithAuthor = { ...baseAnn, authorId: '123', authorTag: 'Onur#1234' };
    const embed = buildAnnouncementEmbed(annWithAuthor as any, 'active');
    expect(embed.toJSON().footer!.text).toBe('ID: ann_test123 • C: Onur#1234');
  });

  test('timestamp createdAt', () => {
    const embed = buildAnnouncementEmbed(baseAnn, 'active');
    expect(new Date(embed.toJSON().timestamp as string).getTime()).toBe(baseAnn.createdAt);
  });
});

describe('announcementEmbed - buildAnnouncementButtons', () => {
  test('2 buton, Gördüm + 📜 n', () => {
    const row = buildAnnouncementButtons('ann_test123', 0);
    const comps = row.toJSON() as any;
    expect(comps.components).toHaveLength(2);
    expect(comps.components[0].custom_id).toBe('seen_ann_test123');
    expect(comps.components[0].label).toBe('Gördüm');
    expect(comps.components[0].emoji.name).toBe('✅');
    expect(comps.components[1].custom_id).toBe('list_ann_test123');
    expect(comps.components[1].label).toBe('0');
    expect(comps.components[1].emoji.name).toBe('📜');
  });

  test('sayaç 5 doğru', () => {
    const row = buildAnnouncementButtons('ann_x', 5);
    expect((row.toJSON() as any).components[1].label).toBe('5');
  });

  test('sayaç 123 doğru', () => {
    const row = buildAnnouncementButtons('ann_x', 123);
    expect((row.toJSON() as any).components[1].label).toBe('123');
  });
});

describe('announcementEmbed - buildCancelledEmbed', () => {
  test('iptal embed doğru', () => {
    const ann = {
      id: 'ann_c',
      title: 'Toplantı',
      description: 'Orijinal açıklama',
      channelId: 'ch1',
      roleId: 'r1',
      createdAt: Date.now(),
      expiresAt: Date.now() + 100000,
      totalMs: 100000,
      seenBy: []
    };
    const embed = buildCancelledEmbed(ann as any, 'Admin#0001');
    const data = embed.toJSON();
    expect(data.title).toContain('İptal Edildi');
    expect(data.description).toContain('Admin#0001');
    expect(data.fields!.some(f => f.name === 'Orijinal Açıklama')).toBe(true);
  });
});
