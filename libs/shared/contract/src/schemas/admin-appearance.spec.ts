import { describe, expect, it } from 'vitest';
import {
  AdminAppearanceSetSlotInputSchema,
  AdminAppearanceSignUploadInputSchema,
  SITE_SLOT_ALT_MAX,
} from './admin-appearance.js';

const valid = {
  key: 'home-hero',
  version: '2026-10-19T03:00:00.000Z',
  image: {
    publicId: 'tourism/site/0dddd001-0000-4000-8000-000000000001/a1',
    alt: 'A city at dawn',
  },
};

describe('admin.appearance — dạng input (ADR-0059)', () => {
  it('nhận một lệnh lưu đúng, kể cả phiên bản null của khe chưa có dòng', () => {
    expect(AdminAppearanceSetSlotInputSchema.safeParse(valid).success).toBe(true);
    expect(AdminAppearanceSetSlotInputSchema.safeParse({ ...valid, version: null }).success).toBe(
      true,
    );
  });

  it('khe video và khoá lạ chết ở tầng dạng, ở cả lệnh lưu lẫn lệnh ký', () => {
    for (const key of ['about-cta-video', 'home-trust', '']) {
      expect(AdminAppearanceSetSlotInputSchema.safeParse({ ...valid, key }).success, key).toBe(
        false,
      );
      expect(AdminAppearanceSignUploadInputSchema.safeParse({ key }).success, key).toBe(false);
    }
    expect(AdminAppearanceSignUploadInputSchema.safeParse({ key: 'auth-panel' }).success).toBe(
      true,
    );
  });

  it('alt quá trần bị từ chối; alt trống là ảnh trang trí (null)', () => {
    const long = { ...valid, image: { ...valid.image, alt: 'x'.repeat(SITE_SLOT_ALT_MAX + 1) } };
    expect(AdminAppearanceSetSlotInputSchema.safeParse(long).success).toBe(false);
    const blank = AdminAppearanceSetSlotInputSchema.parse({
      ...valid,
      image: { ...valid.image, alt: '   ' },
    });
    expect(blank.image.alt).toBeNull();
  });

  it('publicId lạ hình dạng bị từ chối — nó là đối số của lệnh destroy sau này', () => {
    const bad = { ...valid, image: { ...valid.image, publicId: '../tourism/catalog/x' } };
    expect(AdminAppearanceSetSlotInputSchema.safeParse(bad).success).toBe(false);
  });
});
