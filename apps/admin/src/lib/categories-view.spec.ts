import type { AdminCategoryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toCategoryRowVMs } from './categories-view';

/**
 * VM của bảng danh mục (spec P4e-2 F14).
 *
 * Phần đáng test nhất là hai lá cờ `canMoveUp`/`canMoveDown`: chúng quyết định
 * nút nào bấm được, và chúng là bản SOI GƯƠNG của luật server (`CANNOT_MOVE`).
 * Lệch là mời admin bấm một thứ chắc chắn ăn 409.
 *
 * Mapper nhận CẢ MẢNG chứ không từng hàng — khác `toDepartureRowVM`. Vì "hàng
 * này có phải hàng đầu không" là một câu hỏi về VỊ TRÍ trong danh sách, không
 * phải về hàng; đưa từng hàng vào thì mỗi chỗ gọi lại phải tự đếm chỉ số.
 */

const t = messages.admin.categories;

const row = (n: number, over: Partial<AdminCategoryRow> = {}): AdminCategoryRow => ({
  id: `c1400001-0000-4000-8000-${String(n).padStart(12, '0')}`,
  slug: `cat-${n}`,
  name: `Category ${n}`,
  description: null,
  order: n,
  isActive: true,
  tourCount: 0,
  ...over,
});

describe('toCategoryRowVMs', () => {
  it('hàng ĐẦU không lên được, hàng CUỐI không xuống được', () => {
    const vms = toCategoryRowVMs([row(1), row(2), row(3)]);

    expect(vms[0]?.canMoveUp).toBe(false);
    expect(vms[0]?.canMoveDown).toBe(true);
    expect(vms[2]?.canMoveUp).toBe(true);
    expect(vms[2]?.canMoveDown).toBe(false);
  });

  it('hàng giữa đi được cả hai chiều', () => {
    const vms = toCategoryRowVMs([row(1), row(2), row(3)]);

    expect(vms[1]?.canMoveUp).toBe(true);
    expect(vms[1]?.canMoveDown).toBe(true);
  });

  it('danh sách MỘT hàng thì không đi đâu được', () => {
    // Ca biên dễ quên nhất: hàng duy nhất vừa là đầu vừa là cuối.
    const vms = toCategoryRowVMs([row(1)]);

    expect(vms[0]?.canMoveUp).toBe(false);
    expect(vms[0]?.canMoveDown).toBe(false);
  });

  it('hàng ĐÃ TẮT vẫn sắp được — thứ tự là thuộc tính của hàng, không phải của trạng thái', () => {
    // Server cũng cho (có ca int canh). Tắt nút ở đây là chặn một thao tác hợp lệ.
    const vms = toCategoryRowVMs([row(1), row(2, { isActive: false })]);

    expect(vms[1]?.canMoveUp).toBe(true);
  });

  it('trạng thái thành chữ, không phải boolean trần', () => {
    const vms = toCategoryRowVMs([row(1), row(2, { isActive: false })]);

    expect(vms[0]?.statusLabel).toBe(t.list.active);
    expect(vms[1]?.statusLabel).toBe(t.list.inactive);
  });

  it('số tour thành nhãn đếm được, số 0 vẫn có nhãn', () => {
    const vms = toCategoryRowVMs([row(1, { tourCount: 1 }), row(2, { tourCount: 0 })]);

    expect(vms[0]?.toursLabel).toBe(t.list.tours(1));
    expect(vms[1]?.toursLabel).toBe(t.list.tours(0));
  });

  it('không có mô tả thì in một câu, không in ô trống', () => {
    const vms = toCategoryRowVMs([row(1), row(2, { description: 'Back by dinner.' })]);

    expect(vms[0]?.description).toBe(t.list.inherited);
    expect(vms[1]?.description).toBe('Back by dinner.');
  });

  it('mô tả THÔ đi riêng khỏi mô tả HIỂN THỊ', () => {
    // Form sửa phải đọc bản thô. Nếu nó đọc bản hiển thị rồi so với câu thay
    // thế, thì một danh mục có mô tả thật ĐÚNG BẰNG câu ấy sẽ mở ra ô trống —
    // và lưu một phát là mất mô tả.
    const vms = toCategoryRowVMs([row(1), row(2, { description: t.list.inherited })]);

    expect(vms[0]?.descriptionValue).toBe('');
    expect(vms[1]?.descriptionValue).toBe(t.list.inherited);
  });

  it('chở nguyên id, slug và tên để dialog dùng lại', () => {
    const vms = toCategoryRowVMs([row(7, { name: 'Cruises', slug: 'cruises' })]);

    expect(vms[0]?.id).toBe(row(7).id);
    expect(vms[0]?.slug).toBe('cruises');
    expect(vms[0]?.name).toBe('Cruises');
  });

  it('giữ NGUYÊN thứ tự server trả về, không tự sắp lại', () => {
    // Server đã sắp theo `order`; sắp lần hai ở client là mở đường cho hai
    // thước khác nhau nói hai chuyện.
    const vms = toCategoryRowVMs([row(3), row(1), row(2)]);

    expect(vms.map((vm) => vm.order)).toEqual([3, 1, 2]);
  });
});
