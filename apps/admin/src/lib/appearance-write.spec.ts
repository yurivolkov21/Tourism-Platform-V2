import { contract } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { siteSlotFixture, slotImage } from '@/test/appearance';
import { uploadedPhoto } from '@/test/photo-upload';
import { toSlotVM } from './appearance-view';
import {
  currentSlotDraft,
  isSetSlotStale,
  isUnchangedSlotDraft,
  librarySlotDraft,
  restorePayload,
  SET_SLOT_CONTRACT_CODES,
  SIGN_SLOT_CONTRACT_CODES,
  setSlotPayload,
  uploadedSlotDraft,
} from './appearance-write';

const codes = (errorMap: object) => Object.keys(errorMap).sort();

describe('tập mã lỗi khớp contract (codec derive từ i18n, không từ contract)', () => {
  it('lưu khe phủ ĐÚNG các mã `admin.appearance.setSlot` khai', () => {
    expect([...SET_SLOT_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.appearance.setSlot['~orpc'].errorMap),
    );
  });

  it('ký tải lên phủ ĐÚNG các mã `admin.appearance.signUpload` khai', () => {
    expect([...SIGN_SLOT_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.appearance.signUpload['~orpc'].errorMap),
    );
  });

  it('STALE_SLOT là trạng-thái-cũ; PHOTO_NOT_ALLOWED thì không — ở lại hộp chọn ảnh khác', () => {
    expect(isSetSlotStale('STALE_SLOT')).toBe(true);
    expect(isSetSlotStale('PHOTO_NOT_ALLOWED')).toBe(false);
    expect(isSetSlotStale('GENERIC')).toBe(false);
  });
});

describe('ảnh đang soạn của hộp Replace', () => {
  it('ảnh đang dùng mở sẵn trong hộp, khe trống thì không', () => {
    const vm = toSlotVM(siteSlotFixture('home-hero'));
    expect(currentSlotDraft(vm.image)).toMatchObject({
      publicId: 'tourism/catalog/site/home-hero',
      alt: 'A city at sunrise',
      origin: 'CURRENT',
      credit: 'Unsplash contributor · Unsplash License',
    });
    expect(
      currentSlotDraft(toSlotVM(siteSlotFixture('home-hero', { image: null })).image),
    ).toBeNull();
  });

  it('ảnh vừa tải: metadata đi theo, alt trống, không ghi công', () => {
    const draft = uploadedSlotDraft(uploadedPhoto('tourism/site/s1/pid'), 'demo');
    expect(draft).toMatchObject({ origin: 'UPLOAD', alt: '', credit: null, width: 2000 });
    expect(draft.upload?.version).toBe('1759000000');
    expect(draft.previewUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/v1759000000/tourism/site/s1/pid',
    );
  });

  it('ảnh thư viện: alt và ghi công chép từ dòng địa danh', () => {
    const draft = librarySlotDraft({
      publicId: 'lib/a1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
      alt: 'Old town at dusk',
      width: 1200,
      height: 800,
      author: 'Jane Doe',
      license: 'CC BY-SA 4.0',
    });
    expect(draft).toMatchObject({
      origin: 'LIBRARY',
      alt: 'Old town at dusk',
      credit: 'Jane Doe · CC BY-SA 4.0',
      width: 1200,
    });
    expect(draft.upload).toBeUndefined();
  });

  it('chưa đổi gì: ảnh đang dùng mà alt (sau khi cắt khoảng trắng) vẫn như cũ', () => {
    const image = toSlotVM(siteSlotFixture('home-hero')).image;
    const kept = currentSlotDraft(image);
    if (kept === null) throw new Error('fixture thiếu ảnh');
    expect(isUnchangedSlotDraft(kept, image)).toBe(true);
    expect(isUnchangedSlotDraft({ ...kept, alt: '  A city at sunrise ' }, image)).toBe(true);
    expect(isUnchangedSlotDraft({ ...kept, alt: 'Sunrise over the river' }, image)).toBe(false);
    // Ảnh vừa tải hay ảnh thư viện là ảnh MỚI — có gì để lưu, kể cả khi trùng alt.
    expect(isUnchangedSlotDraft({ ...kept, origin: 'LIBRARY' }, image)).toBe(false);
    expect(isUnchangedSlotDraft({ ...kept, origin: 'UPLOAD' }, image)).toBe(false);
  });
});

describe('lệnh lưu', () => {
  it('alt cắt khoảng trắng, trống thành null; metadata chỉ đi theo ảnh mới tải', () => {
    const draft = uploadedSlotDraft(uploadedPhoto('tourism/site/s1/pid'), 'demo');
    expect(setSlotPayload('home-hero', null, { ...draft, alt: '   ' })).toEqual({
      key: 'home-hero',
      version: null,
      image: { publicId: 'tourism/site/s1/pid', alt: null, upload: draft.upload },
    });
    const kept = currentSlotDraft(toSlotVM(siteSlotFixture('home-hero')).image);
    if (kept === null) throw new Error('fixture thiếu ảnh');
    expect(setSlotPayload('home-hero', 'v1', { ...kept, alt: ' New alt ' })).toEqual({
      key: 'home-hero',
      version: 'v1',
      image: { publicId: 'tourism/catalog/site/home-hero', alt: 'New alt' },
    });
  });

  it('Restore original gửi publicId và alt gốc, ở phiên bản thẻ đang cầm', () => {
    const vm = toSlotVM(
      siteSlotFixture('cta-band', {
        image: slotImage('cta-band', { publicId: 'lib/a1', source: 'LIBRARY' }),
      }),
    );
    expect(restorePayload('cta-band', vm)).toEqual({
      key: 'cta-band',
      version: vm.version,
      image: { publicId: 'tourism/catalog/site/cta-band', alt: 'A city at sunrise' },
    });
  });
});
