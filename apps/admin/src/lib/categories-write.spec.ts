import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CREATE_CONTRACT_CODES,
  categoryCreatePayload,
  categoryUpdatePayload,
  hasFormErrors,
  isCreateStale,
  isMoveStale,
  isUpdateStale,
  MOVE_CONTRACT_CODES,
  SET_ACTIVE_CONTRACT_CODES,
  setActiveConfirmRows,
  setActiveDialogCopy,
  UPDATE_CONTRACT_CODES,
  validateCategoryForm,
} from './categories-write';

/**
 * Logic thuần của bốn lệnh ghi vùng danh mục (spec P4e-2 F14).
 *
 * Ca đắt nhất ở đây là phép đối chiếu tập mã: i18n là nguồn của tập mã phía
 * admin, nên một mã contract thêm vào mà quên viết câu sẽ rơi về câu GENERIC
 * mập mờ — và không có gì đỏ. Test này là thứ đỏ thay.
 */

const t = messages.admin.categories;
const VALID = { name: 'Day trips', slug: 'day-trips', description: '' };

describe('tập mã lỗi khớp contract', () => {
  it('bốn codec phủ ĐÚNG các mã mà contract khai', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();

    expect([...CREATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.categories.create['~orpc'].errorMap),
    );
    expect([...UPDATE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.categories.update['~orpc'].errorMap),
    );
    expect([...SET_ACTIVE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.categories.setActive['~orpc'].errorMap),
    );
    expect([...MOVE_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.categories.move['~orpc'].errorMap),
    );
  });

  it('`SLUG_TAKEN` KHÔNG đóng dialog — nó nói về thứ đang nằm trong ô nhập', () => {
    // Đóng dialog ở đây là bắt người ta gõ lại cả form chỉ vì một chữ trùng.
    expect(isCreateStale('SLUG_TAKEN')).toBe(false);
  });

  it('`NOT_FOUND` và `CANNOT_MOVE` thì có — thế giới đã đổi dưới chân dialog', () => {
    expect(isUpdateStale('NOT_FOUND')).toBe(true);
    expect(isMoveStale('CANNOT_MOVE')).toBe(true);
  });
});

describe('validateCategoryForm', () => {
  it('form hợp lệ không báo gì', () => {
    expect(hasFormErrors(validateCategoryForm(VALID, 'create'))).toBe(false);
  });

  it('tên trống hoặc toàn khoảng trắng đều bị bắt', () => {
    expect(validateCategoryForm({ ...VALID, name: '' }, 'create').name).toBeDefined();
    expect(validateCategoryForm({ ...VALID, name: '   ' }, 'create').name).toBeDefined();
  });

  it('slug sai khuôn báo câu RIÊNG, khác câu "bỏ trống"', () => {
    // Hai lỗi khác nhau thì hai câu khác nhau: "chưa nhập" và "nhập sai kiểu"
    // dẫn tới hai hành động khác nhau của người đang gõ.
    expect(validateCategoryForm({ ...VALID, slug: '' }, 'create').slug).toBe(
      t.form.errors.slugRequired,
    );
    expect(validateCategoryForm({ ...VALID, slug: 'Day Trips' }, 'create').slug).toBe(
      t.form.errors.slugShape,
    );
  });

  it('chế độ SỬA KHÔNG xét ô slug — form ấy không có ô đó', () => {
    // Bắt một ô không tồn tại phải hợp lệ là khoá cứng nút Lưu mà không nói
    // được vì sao.
    expect(validateCategoryForm({ ...VALID, slug: '' }, 'edit').slug).toBeUndefined();
    expect(validateCategoryForm({ ...VALID, slug: 'KHÔNG HỢP LỆ' }, 'edit').slug).toBeUndefined();
  });

  it('mô tả quá dài bị bắt ở CẢ hai chế độ', () => {
    const dai = { ...VALID, description: 'a'.repeat(501) };

    expect(validateCategoryForm(dai, 'create').description).toBeDefined();
    expect(validateCategoryForm(dai, 'edit').description).toBeDefined();
  });
});

describe('payload', () => {
  it('mô tả trống thành `null`, không thành chuỗi rỗng', () => {
    // Cột nullable, và "chưa viết mô tả" khác "mô tả là một chuỗi rỗng".
    expect(categoryCreatePayload(VALID).description).toBeNull();
  });

  it('cắt khoảng trắng thừa ở mọi ô', () => {
    const payload = categoryCreatePayload({
      name: '  Day trips  ',
      slug: '  day-trips  ',
      description: '  Back by dinner.  ',
    });

    expect(payload).toEqual({
      name: 'Day trips',
      slug: 'day-trips',
      description: 'Back by dinner.',
    });
  });

  it('payload SỬA không mang `slug` — dù người gọi có truyền vào', () => {
    // Đây là chốt cuối phía client cho quyết định "slug khoá sau khi tạo".
    const payload = categoryUpdatePayload('c1400001-0000-4000-8000-000000000001', {
      ...VALID,
      slug: 'hacked',
    });

    expect('slug' in payload).toBe(false);
  });
});

describe('dialog bật/tắt', () => {
  it('hai chiều hai câu, và câu ẨN nói thẳng thứ KHÔNG xảy ra', () => {
    // Thứ admin hay đoán nhầm nhất: tưởng ẩn danh mục là ẩn luôn tour trong đó.
    const hide = setActiveDialogCopy(false).warning;

    expect(hide).toBe(t.setActive.dialog.hideWarning);
    expect(hide).toMatch(/stay on sale/i);
    expect(hide).toMatch(/keep working/i);
    expect(setActiveDialogCopy(true).warning).toBe(t.setActive.dialog.showWarning);
  });

  it('hộp xác nhận in tên và SỐ TOUR — con số quyết định ở đây', () => {
    const rows = setActiveConfirmRows({ name: 'Day trips', tourCount: 7 });

    expect(rows.map((row) => row.value)).toEqual(['Day trips', '7']);
  });
});
