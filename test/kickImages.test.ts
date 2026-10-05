import * as fs from 'fs';
import * as path from 'path';
import {
  ensureKickAssetsDir,
  getKickAssetPath,
  hasKickAsset,
  resolveKickImage,
  describeKickAssets,
  KICK_ASSETS_DIR
} from '../src/utils/kickImages.ts';

jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;

function statOk(size = 1000): void {
  mockedFs.statSync.mockReturnValue({ size } as fs.Stats);
}

describe('kickImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockReturnValue(undefined);
    statOk();
  });

  test('klasör yoksa oluşturulur', () => {
    mockedFs.existsSync.mockReturnValue(false);
    ensureKickAssetsDir();
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(KICK_ASSETS_DIR, { recursive: true });
  });

  test('klasör varsa mkdir çağrılmaz', () => {
    mockedFs.existsSync.mockReturnValue(true);
    ensureKickAssetsDir();
    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
  });

  test('varsayılan klasör yolu assets/kick', () => {
    expect(KICK_ASSETS_DIR).toBe(path.join(process.cwd(), 'assets', 'kick'));
  });

  test('getKickAssetPath start.png yolunu döner', () => {
    mockedFs.existsSync.mockReturnValue(true);
    expect(getKickAssetPath('start')).toBe(path.join(KICK_ASSETS_DIR, 'start.png'));
    expect(getKickAssetPath('finish')).toBe(path.join(KICK_ASSETS_DIR, 'finish.png'));
  });

  test('dosya yoksa null', () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(getKickAssetPath('start')).toBeNull();
    expect(hasKickAsset('start')).toBe(false);
  });

  test('0 baytlık dosya yok sayılır', () => {
    mockedFs.existsSync.mockReturnValue(true);
    statOk(0);
    expect(getKickAssetPath('start')).toBeNull();
    expect(hasKickAsset('start')).toBe(false);
  });

  test('statSync hata verirse null (bozuk dosya koruması)', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(getKickAssetPath('start')).toBeNull();
  });

  test('dosya varsa attachment:// referansı üretilir', () => {
    mockedFs.existsSync.mockReturnValue(true);
    statOk();

    const image = resolveKickImage('start', 'https://kick.com/thumb.png')!;

    expect(image.source).toBe('asset');
    expect(image.url).toBe('attachment://start.png');
    expect(image.attachment).toBeDefined();
  });

  test('finish için finish.png referansı', () => {
    mockedFs.existsSync.mockReturnValue(true);
    statOk();

    const image = resolveKickImage('finish', '')!;
    expect(image.url).toBe('attachment://finish.png');
    expect(image.attachment).toBeDefined();
  });

  test('dosya yoksa Kick thumbnail\'ına düşer, attachment OLMAZ', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const image = resolveKickImage('start', 'https://images.kick.com/x/480.webp')!;

    expect(image.source).toBe('kick');
    expect(image.url).toBe('https://images.kick.com/x/480.webp');
    expect(image.attachment).toBeUndefined();
  });

  test('ne dosya ne thumbnail varsa null (kırık görsel olmaz)', () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(resolveKickImage('start', '')).toBeNull();
  });

  test('hasKickAsset doğru türü kontrol eder', () => {
    mockedFs.existsSync.mockImplementation((p: any) => String(p).endsWith('start.png'));
    statOk();
    expect(hasKickAsset('start')).toBe(true);
    expect(hasKickAsset('finish')).toBe(false);
  });

  test('describeKickAssets her iki durumu da bildirir', () => {
    mockedFs.existsSync.mockImplementation((p: any) => String(p).endsWith('finish.png'));
    statOk();
    const text = describeKickAssets();
    expect(text).toContain('— start.png');
    expect(text).toContain('✅ finish.png');
  });
});