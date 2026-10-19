import {
  type AdminDestinationPhoto,
  type AdminDestinationPhotos,
  contract,
  DESTINATION_PHOTOS_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  type DestinationPhotoDraft,
  destinationPhotoSourceLine,
  destinationPhotosFormValues,
  destinationPhotosPayload,
  destinationSkippedCopy,
  hasDestinationPhotoErrors,
  needsEmptyConfirm,
  putBack,
  removedDestinationPhotos,
  SET_DESTINATION_PHOTOS_CODES,
  SIGN_DESTINATION_UPLOADS_CODES,
  setDestinationPhotosErrorCopy,
  signDestinationUploadsErrorCopy,
  uploadedDestinationPhotoDraft,
  validateDestinationPhotos,
} from './destination-photos';

const t = messages.admin.destinations.photos;
const photosCopy = messages.admin.tours.editor.photos;

const DEST = '0bbbb001-0000-4000-8000-000000000001';
const VERSION = '2026-10-19T03:00:00.000Z';

const photo = (over: Partial<AdminDestinationPhoto>): AdminDestinationPhoto => ({
  publicId: 'tourism/catalog/destination/hoi-an/1',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/x.jpg',
  alt: 'Lanterns',
  width: 2400,
  height: 1600,
  source: 'CATALOG',
  usedByTours: 0,
  author: null,
  license: null,
  ...over,
});

const detail = (
  photos: AdminDestinationPhoto[],
  over: Partial<AdminDestinationPhotos> = {},
): AdminDestinationPhotos => ({
  id: DEST,
  name: 'Hoi An',
  slug: 'hoi-an',
  isActive: true,
  version: VERSION,
  photos,
  ...over,
});

const draft = (over: Partial<DestinationPhotoDraft>): DestinationPhotoDraft => ({
  key: 'k',
  publicId: 'p',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/p.jpg',
  alt: 'Alt',
  source: 'CATALOG',
  usedByTours: 0,
  author: null,
  license: null,
  ...over,
});

describe('destinationPhotosFormValues', () => {
  it('key tất định theo vị trí, alt null thành chuỗi rỗng', () => {
    const values = destinationPhotosFormValues(
      detail([photo({ publicId: 'a' }), photo({ publicId: 'b', alt: null })]),
    );
    expect(values.photos.map((p) => [p.key, p.publicId, p.alt])).toEqual([
      ['photo-0', 'a', 'Lanterns'],
      ['photo-1', 'b', ''],
    ]);
  });
});

describe('validateDestinationPhotos', () => {
  it('alt bắt buộc, quá dài, trùng ảnh', () => {
    const errors = validateDestinationPhotos({
      photos: [
        draft({ key: 'a', publicId: 'x', alt: '  ' }),
        draft({ key: 'b', publicId: 'y', alt: 'z'.repeat(301) }),
        draft({ key: 'c', publicId: 'x', alt: 'Fine' }),
        draft({ key: 'd', publicId: 'w', alt: 'Fine' }),
      ],
    });
    expect(errors.rows).toEqual({
      a: photosCopy.altRequired,
      b: messages.admin.tours.editor.form.errors.tooLong(300),
      c: photosCopy.duplicate,
    });
    expect(errors.list).toBeUndefined();
    expect(hasDestinationPhotoErrors(errors)).toBe(true);
  });

  it('quá trần thì báo cả danh sách; danh sách rỗng là hợp lệ', () => {
    const many = Array.from({ length: DESTINATION_PHOTOS_MAX + 2 }, (_, i) =>
      draft({ key: `k${i}`, publicId: `p${i}` }),
    );
    expect(validateDestinationPhotos({ photos: many }).list).toBe(
      messages.admin.tours.editor.form.errors.tooManyPhotos(DESTINATION_PHOTOS_MAX, 2),
    );
    expect(hasDestinationPhotoErrors(validateDestinationPhotos({ photos: [] }))).toBe(false);
  });
});

describe('destinationPhotosPayload', () => {
  it('cắt khoảng trắng alt, chỉ ảnh vừa tải mới mang `upload`', () => {
    const upload = { version: '1', width: 10, height: 10, format: 'jpg', bytes: 100 };
    expect(
      destinationPhotosPayload(DEST, VERSION, {
        photos: [draft({ publicId: 'a', alt: ' A ' }), draft({ publicId: 'b', upload })],
      }),
    ).toEqual({
      id: DEST,
      version: VERSION,
      photos: [
        { publicId: 'a', alt: 'A' },
        { publicId: 'b', alt: 'Alt', upload },
      ],
    });
  });
});

describe('dòng nguồn và câu hậu quả (spec §7.3)', () => {
  it('dòng nguồn: nguồn, ghi công, số tour mượn', () => {
    expect(destinationPhotoSourceLine(draft({ source: 'UPLOAD' }))).toBe(t.source.UPLOAD);
    expect(
      destinationPhotoSourceLine(
        draft({ author: 'J. Nguyen', license: 'CC BY-SA 4.0', usedByTours: 3 }),
      ),
    ).toBe(
      [t.source.CATALOG, photosCopy.credit('J. Nguyen', 'CC BY-SA 4.0'), t.usedBy(3)].join(' · '),
    );
  });

  it('ảnh gỡ khỏi bản đã lưu: mỗi ảnh một câu theo nguồn và số tour mượn', () => {
    const base = {
      photos: [
        draft({ key: 'a', publicId: 'kept' }),
        draft({ key: 'b', publicId: 'upload', source: 'UPLOAD' }),
        draft({ key: 'c', publicId: 'catalog' }),
        draft({ key: 'd', publicId: 'borrowed', source: 'UPLOAD', usedByTours: 5 }),
        draft({ key: 'e', publicId: 'both', usedByTours: 1 }),
      ],
    };
    const values = { photos: [draft({ key: 'a', publicId: 'kept' })] };
    expect(
      removedDestinationPhotos(base, values).map((r) => [r.photo.publicId, r.consequence]),
    ).toEqual([
      ['upload', t.removed.upload],
      ['catalog', t.removed.catalog],
      ['borrowed', t.removed.usedByTours(5)],
      ['both', `${t.removed.usedByTours(1)} ${t.removed.catalog}`],
    ]);
  });

  it('ảnh vừa tải rồi gỡ trước khi lưu không có trong danh sách gỡ', () => {
    const base = { photos: [] };
    expect(removedDestinationPhotos(base, { photos: [] })).toEqual([]);
  });

  it('Put back thêm lại ảnh ở cuối danh sách, giữ alt đã lưu', () => {
    const gone = draft({ key: 'b', publicId: 'gone', alt: 'Saved alt' });
    const values = { photos: [draft({ key: 'a', publicId: 'kept' })] };
    expect(putBack(values, gone).photos.map((p) => [p.publicId, p.alt])).toEqual([
      ['kept', 'Alt'],
      ['gone', 'Saved alt'],
    ]);
    // Đã có trong danh sách (bấm hai lần) thì không thêm trùng.
    const twice = putBack(putBack(values, gone), gone);
    expect(twice.photos).toHaveLength(2);
  });
});

describe('needsEmptyConfirm (spec §7.1)', () => {
  it('chỉ hỏi khi điểm đến đang hiện và danh sách rỗng', () => {
    expect(needsEmptyConfirm(true, { photos: [] })).toBe(true);
    expect(needsEmptyConfirm(false, { photos: [] })).toBe(false);
    expect(needsEmptyConfirm(true, { photos: [draft({})] })).toBe(false);
  });
});

describe('tải lên', () => {
  it('ảnh vừa tải thành dòng UPLOAD, alt trống, chở metadata', () => {
    const upload = { version: '1759', width: 2000, height: 1333, format: 'jpg', bytes: 5 };
    const row = uploadedDestinationPhotoDraft(
      { publicId: `tourism/destinations/${DEST}/a`, upload },
      'demo',
    );
    expect(row).toMatchObject({
      publicId: `tourism/destinations/${DEST}/a`,
      alt: '',
      source: 'UPLOAD',
      usedByTours: 0,
      upload,
    });
    expect(row.url).toContain('res.cloudinary.com/demo/');
  });

  it('câu file bị bỏ: hai câu chung, câu đầy nói về điểm đến', () => {
    expect(destinationSkippedCopy({ name: 'a.gif', reason: 'type' })).toBe(
      photosCopy.skipped.type('a.gif'),
    );
    expect(destinationSkippedCopy({ name: 'a.jpg', reason: 'full' })).toBe(t.skippedFull('a.jpg'));
  });
});

describe('codec lỗi', () => {
  it('tập mã khớp từng chữ với errorMap của contract', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();
    expect([...SET_DESTINATION_PHOTOS_CODES].sort()).toEqual(
      codes(contract.admin.destinations.setPhotos['~orpc'].errorMap),
    );
    expect([...SIGN_DESTINATION_UPLOADS_CODES].sort()).toEqual(
      codes(contract.admin.destinations.signPhotoUploads['~orpc'].errorMap),
    );
  });

  it('mã contract và câu của chúng; lệnh ký không rõ kết cục có câu riêng của việc tải', () => {
    expect(setDestinationPhotosErrorCopy('PHOTO_NOT_ALLOWED')).toBe(t.errors.PHOTO_NOT_ALLOWED);
    expect(signDestinationUploadsErrorCopy('GENERIC')).toBe(photosCopy.signFailed);
    expect(signDestinationUploadsErrorCopy('MEDIA_UPLOAD_NOT_CONFIGURED')).toBe(
      t.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED,
    );
  });
});
