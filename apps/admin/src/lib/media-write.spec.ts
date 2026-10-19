import { contract, MEDIA_ALT_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { MEDIA_VERSION, mediaItem, USAGES } from '@/test/media';
import {
  altVariantLines,
  canSaveMedia,
  creditVariantLines,
  draftErrors,
  hasCcWarning,
  isMediaStale,
  licenseSuggestions,
  MEDIA_CONTRACT_CODES,
  mediaDraft,
  mediaPayload,
} from './media-write';

const t = messages.admin.media;
const codes = (errorMap: object) => Object.keys(errorMap).sort();

describe('codec lỗi khớp contract', () => {
  it('phủ ĐÚNG các mã `admin.media.update` khai', () => {
    expect([...MEDIA_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.media.update['~orpc'].errorMap),
    );
  });

  it('STALE_MEDIA và NOT_FOUND là trạng-thái-cũ; ALT_REQUIRED ở lại form', () => {
    expect(isMediaStale('STALE_MEDIA')).toBe(true);
    expect(isMediaStale('NOT_FOUND')).toBe(true);
    expect(isMediaStale('ALT_REQUIRED')).toBe(false);
  });
});

describe('form của ngăn chi tiết', () => {
  it('bản nháp từ mục: null thành chuỗi rỗng', () => {
    expect(mediaDraft(mediaItem({ sourceUrl: null }))).toEqual({
      alt: 'Lanterns over the river',
      author: 'Jane Doe',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: '',
    });
  });

  it('payload: cắt khoảng trắng, rỗng thành null, mang version đang cầm', () => {
    const item = mediaItem();
    expect(
      mediaPayload(item, {
        alt: '  Lanterns  ',
        author: ' ',
        license: 'CC BY 4.0',
        licenseUrl: '',
        sourceUrl: '',
      }),
    ).toEqual({
      publicId: item.publicId,
      version: MEDIA_VERSION,
      alt: 'Lanterns',
      author: null,
      license: 'CC BY 4.0',
      licenseUrl: null,
      sourceUrl: null,
    });
  });

  it('lưu được khi có ô đổi, hay khi các chỗ dùng đang lệch (lưu là làm chúng giống nhau)', () => {
    const item = mediaItem();
    expect(canSaveMedia(item, mediaDraft(item))).toBe(false);
    expect(canSaveMedia(item, { ...mediaDraft(item), alt: 'Lanterns over the river ' })).toBe(
      false,
    );
    expect(canSaveMedia(item, { ...mediaDraft(item), author: 'J. Doe' })).toBe(true);
    expect(canSaveMedia(mediaItem({ altVaries: true }), mediaDraft(item))).toBe(true);
  });

  it('alt bắt buộc thì không để trống; link phải là http(s)', () => {
    const item = mediaItem();
    expect(
      draftErrors(item, {
        ...mediaDraft(item),
        alt: '  ',
        licenseUrl: 'javascript:alert(1)',
        sourceUrl: 'commons.wikimedia.org',
      }),
    ).toEqual({
      alt: t.drawer.altMissing,
      licenseUrl: t.drawer.invalidLink,
      sourceUrl: t.drawer.invalidLink,
    });
    expect(draftErrors(item, mediaDraft(item))).toEqual({});
  });

  it('ảnh chỉ ở bài viết và khe: alt trống được', () => {
    const item = mediaItem({ altRequired: false, usages: [USAGES.post, USAGES.slot] });
    expect(draftErrors(item, { ...mediaDraft(item), alt: '' })).toEqual({});
  });

  it('alt vượt trần do dán chữ vào: báo ở ô alt', () => {
    const item = mediaItem();
    const errors = draftErrors(item, { ...mediaDraft(item), alt: 'x'.repeat(MEDIA_ALT_MAX + 1) });
    expect(Object.keys(errors)).toEqual(['alt']);
  });

  it('cảnh báo CC: họ CC BY thiếu tác giả hay link giấy phép; giấy phép khác thì không', () => {
    const base = mediaDraft(mediaItem());
    expect(hasCcWarning(base)).toBe(false);
    expect(hasCcWarning({ ...base, licenseUrl: '' })).toBe(true);
    expect(hasCcWarning({ ...base, author: ' ' })).toBe(true);
    expect(hasCcWarning({ ...base, license: 'Unsplash License', author: '' })).toBe(false);
  });
});

describe('các giá trị đang lệch', () => {
  it('alt: mỗi giá trị một dòng kèm số chỗ dùng, trống ghi Empty', () => {
    const item = mediaItem({
      altVaries: true,
      usages: [USAGES.library, USAGES.tourA, { ...USAGES.tourB, alt: null }],
    });
    expect(altVariantLines(item)).toEqual([
      { value: 'Lanterns over the river', uses: '2 uses' },
      { value: t.drawer.emptyValue, uses: '1 use' },
    ]);
    expect(altVariantLines(mediaItem())).toEqual([]);
  });

  it('ghi công: mỗi bản một dòng "tác giả · giấy phép", không có gì ghi No credit', () => {
    const item = mediaItem({
      creditVaries: true,
      creditVariants: [
        { author: 'Jane Doe', license: 'CC BY-SA 4.0', licenseUrl: null, sourceUrl: null },
        { author: null, license: null, licenseUrl: null, sourceUrl: null },
      ],
    });
    expect(creditVariantLines(item)).toEqual(['Jane Doe · CC BY-SA 4.0', t.drawer.noCredit]);
  });
});

describe('licenseSuggestions', () => {
  it('giấy phép đang có, dùng nhiều trước, gộp trùng', () => {
    expect(
      licenseSuggestions([
        mediaItem({ license: 'Unsplash License' }),
        mediaItem({ license: 'CC BY-SA 4.0' }),
        mediaItem({ license: 'CC BY-SA 4.0' }),
        mediaItem({ license: null }),
      ]),
    ).toEqual(['CC BY-SA 4.0', 'Unsplash License']);
  });
});
