import type { AdminTourRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { setPublishedToast } from './tours-publish';
import { toTourRowVM } from './tours-view';

/**
 * Mapper hiển thị + câu toast của `/tours` (spec P4e-1 §3-F11). Bảng không tự
 * tính gì, nên mọi nhánh hiển thị được pin ở đây.
 */

const t = messages.admin.tours;

const ROW: AdminTourRow = {
  id: '7f2a1b3c-0000-4000-8000-000000000001',
  slug: 'hoi-an-lantern-evening',
  title: 'Hoi An Lantern Evening',
  categoryName: 'Day Tours',
  basePrice: '39.00',
  currency: 'USD',
  isPublished: true,
  isFeatured: true,
  heroUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tours/hoi-an',
  openDepartureCount: 3,
};

describe('toTourRowVM', () => {
  it('format tiền giữ ĐỦ hai số lẻ — cùng luật với vùng bookings', () => {
    expect(toTourRowVM(ROW).price).toBe('$39.00');
    expect(toTourRowVM({ ...ROW, basePrice: '1299.5' }).price).toBe('$1,299.50');
  });

  it('dựng sẵn đường sang màn chuyến, bảng không ghép chuỗi', () => {
    const vm = toTourRowVM(ROW);
    expect(vm.departuresHref).toBe('/tours/hoi-an-lantern-evening/departures');
    expect(vm.departuresLabel).toBe(t.list.manageDepartures('Hoi An Lantern Evening'));
  });

  it('giữ con số THÔ cộng một câu đầy đủ cho trình đọc màn hình', () => {
    // Bảng in số to; `countLabel` là thứ duy nhất nói con số ấy là số GÌ.
    expect(toTourRowVM(ROW).openDepartureCount).toBe(3);
    expect(toTourRowVM(ROW).countLabel).toBe('3 bookable departures');
    expect(toTourRowVM({ ...ROW, openDepartureCount: 1 }).countLabel).toBe('1 bookable departure');
    expect(toTourRowVM({ ...ROW, openDepartureCount: 0 }).countLabel).toBe('0 bookable departures');
  });

  it('chuyển thẳng ba cờ và ảnh bìa, kể cả khi chưa có ảnh', () => {
    expect(toTourRowVM(ROW)).toMatchObject({
      category: 'Day Tours',
      isPublished: true,
      isFeatured: true,
      heroUrl: ROW.heroUrl,
    });
    expect(toTourRowVM({ ...ROW, heroUrl: null }).heroUrl).toBeNull();
  });
});

describe('setPublishedToast', () => {
  it('lên kệ → nói tour đã trở lại site công khai', () => {
    expect(setPublishedToast(ROW.title, { isPublished: true, changed: true })).toBe(
      t.publish.toast.live(ROW.title),
    );
  });

  it('rút khỏi kệ → nói rõ khách ĐÃ ĐẶT vẫn đi', () => {
    // Câu này là thứ ngăn vận hành ngần ngại rút một tour khỏi kệ khi có
    // chuyện — bất biến F11, không được rút gọn thành "done".
    const line = setPublishedToast(ROW.title, { isPublished: false, changed: true });
    expect(line).toBe(t.publish.toast.off(ROW.title));
    expect(line).toContain('still travel');
  });

  it('không có gì đổi → nói đúng như vậy, ở CẢ hai chiều', () => {
    expect(setPublishedToast(ROW.title, { isPublished: true, changed: false })).toBe(
      t.publish.toast.unchanged(ROW.title),
    );
    expect(setPublishedToast(ROW.title, { isPublished: false, changed: false })).toBe(
      t.publish.toast.unchanged(ROW.title),
    );
  });
});
