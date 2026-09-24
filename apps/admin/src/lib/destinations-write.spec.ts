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
  newDestinationFormValues,
  SET_ACTIVE_CONTRACT_CODES,
  setActiveConfirmRows,
  setActiveDialogCopy,
  setActiveToast,
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
    // Đúng 80 là ca biên: phép so `>` đổi thành `>=` chỉ đỏ ở đây (vòng review F15).
    expect(validateDestinationForm({ ...VALID, slug: 'a'.repeat(80) }, 'create').slug).toBe(
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

  it('tên tới 120 ký tự được, 121 thì bị bắt NGAY tại ô', () => {
    // Không bắt ở đây thì server action trả `INVALID_INPUT` và admin chỉ thấy câu
    // lỗi chung, không biết ô nào sai (vòng review F15).
    expect(validateDestinationForm({ ...VALID, name: 'a'.repeat(120) }, 'create').name).toBe(
      undefined,
    );
    expect(validateDestinationForm({ ...VALID, name: 'a'.repeat(121) }, 'create').name).toBe(
      t.form.errors.tooLong(120),
    );
  });

  it('quốc gia tới 60 ký tự được, 61 thì bị bắt NGAY tại ô', () => {
    expect(validateDestinationForm({ ...VALID, country: 'a'.repeat(60) }, 'edit').country).toBe(
      undefined,
    );
    expect(validateDestinationForm({ ...VALID, country: 'a'.repeat(61) }, 'edit').country).toBe(
      t.form.errors.tooLong(60),
    );
  });

  it('câu "quá dài" nói đúng biên: N ký tự vẫn được, cùng chữ với danh mục', () => {
    // "Keep it under N" nói N là quá — trong khi form nhận đúng N.
    expect(t.form.errors.tooLong(80)).toBe(messages.admin.categories.form.errors.tooLong(80));
    expect(t.form.errors.tooLong(80)).toContain('80 characters or fewer');
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

describe('giá trị đầu của form tạo', () => {
  it('quốc gia điền sẵn Vietnam, mọi ô khác trống', () => {
    // Bảng dùng CHÍNH hàm này làm `initial` của hộp Add — spec của hộp thoại
    // từng tự cấp "Vietnam" qua fixture nên không canh gì cả (vòng review F15).
    expect(newDestinationFormValues()).toEqual({
      name: '',
      slug: '',
      country: 'Vietnam',
      region: '',
      description: '',
    });
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
  const d = t.setActive.dialog;

  it('hộp ẨN kể hệ quả ở trang vùng, các con số của site, hộ chiếu và tag blog', () => {
    // Bản spec đầu chỉ kể ba chỗ (trang vùng, tile, facet); bảng đo Task 9a
    // tìm ra thêm trang chủ, About, blog và hộ chiếu. Câu nào vắng ở đây là
    // một quyết định sai của người đọc nó.
    const lines = hideConsequences({ regionName: 'Central Vietnam', regionKey: 'central' });

    expect(lines).toEqual([
      d.hideRegionTours('Central Vietnam'),
      d.hideRegionOwnTours.central('Central Vietnam'),
      d.hideCounts,
      d.hidePassport,
      d.hideJournal,
    ]);
    expect(lines[0]).toContain('Central Vietnam page');
  });

  it('câu về chuyến RIÊNG của vùng chỉ nhắc những khu trang vùng ấy thật sự có', () => {
    // Vòng review F15: một câu chung hứa ba con số cho cả ba vùng, trong khi
    // miền Bắc chỉ có khu "How long have you got", miền Trung chỉ có khu chuyến
    // một ngày, miền Nam chỉ có ô "Longest trip".
    const north = d.hideRegionOwnTours.north('Northern Vietnam');
    const central = d.hideRegionOwnTours.central('Central Vietnam');
    const south = d.hideRegionOwnTours.south('Southern Vietnam');

    for (const line of [north, central, south]) expect(line).toContain('Longest trip');
    expect(north).toContain('How long have you got');
    expect(central).toContain('day-trip');
    for (const line of [north, south]) expect(line).not.toContain('day-trip');
    for (const line of [central, south]) expect(line).not.toContain('How long have you got');
  });

  it('câu về hộ chiếu nói cả khách có chuyến SẮP đi, không riêng người đã đi', () => {
    // Sổ hành trình dựng cả mục chỉ có chuyến sắp tới — ẩn điểm đến là mục ấy
    // biến mất theo (vòng review F15).
    expect(d.hidePassport).toContain('coming up');
  });

  it('điểm đến CHƯA có vùng thì không nói về trang vùng nào cả', () => {
    // Nó vốn không hiện ở trang vùng nào — nói rằng tour "rời trang vùng" là
    // nói về một trang không tồn tại.
    expect(hideConsequences({ regionName: null, regionKey: null })).toEqual([
      d.hideCounts,
      d.hidePassport,
      d.hideJournal,
    ]);
    expect(setActiveDialogCopy(false, { regionKey: null }).body).toBe(d.hideBodyNoRegion);
    expect(d.hideBodyNoRegion).not.toContain('destination pages');
    expect(setActiveDialogCopy(false, { regionKey: 'north' }).body).toBe(d.hideBody);
  });

  it('câu trấn an nói điều KHÔNG xảy ra: tour vẫn bán, link vẫn chạy', () => {
    const hide = setActiveDialogCopy(false, { regionKey: 'central' }).warning;

    expect(hide).toBe(d.hideWarning);
    expect(hide).toMatch(/stay on sale/);
    expect(hide).toMatch(/keep working/);
  });

  it('hộp HIỆN không hứa rằng tour không đổi — tour quay lại trang vùng và các con số', () => {
    // Câu chép từ danh mục ("they do not change") đúng với danh mục, sai với
    // điểm đến (vòng review F15).
    const show = setActiveDialogCopy(true, { regionKey: 'central' });

    expect(show.warning).toBe(d.showWarning);
    expect(show.warning).not.toContain('do not change');
  });

  it('nhãn nút và toast không nhắc "destination pages" khi điểm đến không ở trang vùng nào', () => {
    const toast = t.setActive.toast;
    const row = {
      id: 'd1500001-0000-4000-8000-000000000001',
      slug: 'can-gio',
      name: 'Cần Giờ',
      country: 'Vietnam',
      region: 'Mekong',
      description: null,
      isActive: false,
      tourCount: 0,
    };

    expect(setActiveToast(row)).toEqual({
      title: toast.hiddenTitle,
      description: toast.hiddenBody('Cần Giờ', false),
    });
    expect(toast.hiddenBody('Cần Giờ', false)).not.toContain('destination pages');
    expect(setActiveToast({ ...row, isActive: true }).description).toBe(
      toast.shownBody('Cần Giờ', false),
    );
    expect(setActiveToast({ ...row, region: 'Central Vietnam' }).description).toBe(
      toast.hiddenBody('Cần Giờ', true),
    );
    expect(t.setActive.hideLabel('Cần Giờ')).not.toContain('destination pages');
    expect(t.setActive.showLabel('Cần Giờ')).not.toContain('destination pages');
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
