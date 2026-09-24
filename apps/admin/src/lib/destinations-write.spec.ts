import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toDestinationRowVM } from './destinations-view';
import {
  CREATE_CONTRACT_CODES,
  destinationCreatePayload,
  destinationEditValues,
  destinationUpdatePayload,
  hideConsequences,
  isCreateStale,
  isSetActiveStale,
  isUpdateStale,
  SET_ACTIVE_CONTRACT_CODES,
  setActiveConfirmRows,
  setActiveDialogCopy,
  UPDATE_CONTRACT_CODES,
  validateDestinationForm,
} from './destinations-write';
import { hasFormErrors } from './form-errors';

/**
 * Logic thuần của ba lệnh ghi vùng điểm đến (spec P4e-2 F15).
 *
 * Ca đắt nhất vẫn là phép đối chiếu tập mã với contract (một mã quên viết câu
 * rơi về câu GENERIC mà không có gì đỏ), cộng hai thứ riêng của bảng này: ô vùng
 * chỉ nhận ba tên, và hộp ẩn nói ĐÚNG những gì bảng đo spec §4.6 tìm ra.
 */

const t = messages.admin.destinations;
const VALID = {
  name: 'Hội An',
  slug: 'hoi-an',
  country: 'Vietnam',
  region: 'Central Vietnam',
  description: '',
};

describe('tập mã lỗi khớp contract', () => {
  it('ba codec phủ ĐÚNG các mã mà contract khai', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();

    expect([...CREATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.destinations.create['~orpc'].errorMap),
    );
    expect([...UPDATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.destinations.update['~orpc'].errorMap),
    );
    expect([...SET_ACTIVE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.destinations.setActive['~orpc'].errorMap),
    );
  });

  it('`SLUG_TAKEN` KHÔNG đóng dialog; `NOT_FOUND` thì có', () => {
    expect(isCreateStale('SLUG_TAKEN')).toBe(false);
    expect(isUpdateStale('NOT_FOUND')).toBe(true);
    expect(isSetActiveStale('NOT_FOUND')).toBe(true);
  });
});

describe('validateDestinationForm', () => {
  it('form hợp lệ không báo gì', () => {
    expect(hasFormErrors(validateDestinationForm(VALID, 'create'))).toBe(false);
  });

  it('vùng CHƯA chọn bị bắt — ô chọn có mục giữ chỗ rỗng', () => {
    expect(validateDestinationForm({ ...VALID, region: '' }, 'create').region).toBe(
      t.form.errors.regionRequired,
    );
    expect(validateDestinationForm({ ...VALID, region: '' }, 'edit').region).toBe(
      t.form.errors.regionRequired,
    );
  });

  it('vùng ngoài ba tên bị bắt, kể cả dạng web đọc được', () => {
    // Soi gương cổng GHI của contract: `north` web đọc ra miền Bắc, nhưng không
    // được ghi xuống — ADR-0045 chốt lưu `name`.
    for (const region of ['north', 'North', 'Mekong']) {
      expect(validateDestinationForm({ ...VALID, region }, 'create').region, region).toBe(
        t.form.errors.regionRequired,
      );
    }
  });

  it('câu lỗi khuôn slug là CHÍNH câu của danh mục (bài học 8)', () => {
    expect(t.form.errors.slugShape).toBe(messages.admin.categories.form.errors.slugShape);
    for (const slug of ['-', 'hoi--an', 'Hoi An', 'hoi-an-']) {
      expect(validateDestinationForm({ ...VALID, slug }, 'create').slug, slug).toBe(
        t.form.errors.slugShape,
      );
    }
  });

  it('slug quá 80 ký tự bị bắt — trần của điểm đến, không phải 60 của danh mục', () => {
    expect(validateDestinationForm({ ...VALID, slug: 'a'.repeat(70) }, 'create').slug).toBe(
      undefined,
    );
    expect(validateDestinationForm({ ...VALID, slug: 'a'.repeat(81) }, 'create').slug).toBe(
      t.form.errors.tooLong(80),
    );
  });

  it('chế độ SỬA KHÔNG xét ô slug — form ấy không có ô đó', () => {
    expect(validateDestinationForm({ ...VALID, slug: '' }, 'edit').slug).toBeUndefined();
  });

  it('tên và quốc gia trống hoặc toàn khoảng trắng đều bị bắt', () => {
    expect(validateDestinationForm({ ...VALID, name: '  ' }, 'create').name).toBe(
      t.form.errors.nameRequired,
    );
    expect(validateDestinationForm({ ...VALID, country: '  ' }, 'edit').country).toBe(
      t.form.errors.countryRequired,
    );
  });

  it('mô tả tới 2000 ký tự được, quá thì bị bắt', () => {
    expect(
      validateDestinationForm({ ...VALID, description: 'a'.repeat(2000) }, 'edit').description,
    ).toBeUndefined();
    expect(
      validateDestinationForm({ ...VALID, description: 'a'.repeat(2001) }, 'edit').description,
    ).toBe(t.form.errors.tooLong(2000));
  });
});

describe('payload', () => {
  it('cắt khoảng trắng mọi ô, mô tả trống thành `null`', () => {
    expect(
      destinationCreatePayload({
        name: '  Hội An ',
        slug: ' hoi-an ',
        country: ' Vietnam ',
        region: 'Central Vietnam',
        description: '   ',
      }),
    ).toEqual({
      name: 'Hội An',
      slug: 'hoi-an',
      country: 'Vietnam',
      region: 'Central Vietnam',
      description: null,
    });
  });

  it('payload SỬA không mang `slug` — dù người gọi có truyền vào', () => {
    const payload = destinationUpdatePayload('d1500001-0000-4000-8000-000000000001', {
      ...VALID,
      slug: 'hacked',
    });

    expect('slug' in payload).toBe(false);
    expect(payload.region).toBe('Central Vietnam');
  });

  it('dựng payload với ô vùng CHƯA chọn là lỗi lập trình — ném ngay, không gửi đi', () => {
    expect(() => destinationCreatePayload({ ...VALID, region: '' })).toThrow();
  });
});

describe('giá trị đầu của form sửa', () => {
  const vmOf = (region: string | null) =>
    toDestinationRowVM({
      id: 'd1500001-0000-4000-8000-000000000001',
      slug: 'hanoi',
      name: 'Hà Nội',
      country: 'Vietnam',
      region,
      description: null,
      isActive: true,
      tourCount: 3,
    });

  it('chọn sẵn tên vùng CHUẨN — kể cả khi DB lưu dạng cũ', () => {
    // Lưu lại form ấy là cột mang đúng một trong ba tên, không phải `north`.
    expect(destinationEditValues(vmOf('north')).region).toBe('Northern Vietnam');
  });

  it('chuỗi không khớp vùng nào thì ô trống — bắt admin chọn lại', () => {
    expect(destinationEditValues(vmOf('Mekong')).region).toBe('');
  });
});

describe('hộp ẩn/hiện — nói đúng những gì bảng đo §4.6 tìm ra', () => {
  it('hộp ẨN kể hai hệ quả ở trang vùng, hộ chiếu của khách và tag blog', () => {
    // Bản spec đầu chỉ kể ba chỗ (trang vùng, tile, facet); bảng đo Task 9a
    // tìm ra thêm trang chủ, About, blog và hộ chiếu. Câu nào vắng ở đây là
    // một quyết định sai của người đọc nó.
    const lines = hideConsequences({ regionName: 'Central Vietnam' });

    expect(lines).toEqual([
      t.setActive.dialog.hideRegionTours('Central Vietnam'),
      t.setActive.dialog.hideRegionOwnTours('Central Vietnam'),
      t.setActive.dialog.hidePassport,
      t.setActive.dialog.hideJournal,
    ]);
    expect(lines[0]).toMatch(/Central Vietnam page/);
    expect(t.setActive.dialog.hidePassport).toMatch(/passport/i);
  });

  it('điểm đến CHƯA có vùng thì không nói về trang vùng nào cả', () => {
    // Nó vốn không hiện ở trang vùng nào — nói rằng tour "rời trang vùng" là
    // nói về một trang không tồn tại.
    expect(hideConsequences({ regionName: null })).toEqual([
      t.setActive.dialog.hidePassport,
      t.setActive.dialog.hideJournal,
    ]);
  });

  it('câu trấn an nói điều KHÔNG xảy ra: tour vẫn bán, link vẫn chạy', () => {
    const hide = setActiveDialogCopy(false).warning;

    expect(hide).toBe(t.setActive.dialog.hideWarning);
    expect(hide).toMatch(/stay on sale/);
    expect(hide).toMatch(/keep working/);
    expect(setActiveDialogCopy(true).warning).toBe(t.setActive.dialog.showWarning);
  });

  it('nút Hide/Show dùng CÙNG chữ với danh mục (bài học 20)', () => {
    expect(t.setActive.hide).toBe(messages.admin.categories.setActive.hide);
    expect(t.setActive.show).toBe(messages.admin.categories.setActive.show);
  });

  it('hộp xác nhận in tên, vùng và SỐ TOUR', () => {
    const rows = setActiveConfirmRows({
      name: 'Hội An',
      regionLabel: 'Central Vietnam',
      tourCount: 4,
    });

    expect(rows.map((r) => r.value)).toEqual(['Hội An', 'Central Vietnam', '4']);
  });
});
