import type { AdminDestinationRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toDestinationRowVM } from './destinations-view';

/**
 * VM của bảng điểm đến (spec P4e-2 F15).
 *
 * Phần đáng test nhất là "chuẩn hoá `region`" của spec §5: cột DB là chữ tự do,
 * còn web xếp điểm đến vào trang vùng bằng `findRegion`. VM phải đọc ra ĐÚNG
 * vùng mà web đọc — lệch là bảng admin nói một đằng, trang vùng hiện một nẻo.
 */

const t = messages.admin.destinations;

const row = (over: Partial<AdminDestinationRow> = {}): AdminDestinationRow => ({
  id: 'd1500001-0000-4000-8000-000000000001',
  slug: 'hoi-an',
  name: 'Hội An',
  country: 'Vietnam',
  region: 'Central Vietnam',
  description: null,
  isActive: true,
  tourCount: 0,
  linkedTourCount: 4,
  ...over,
});

describe('toDestinationRowVM — chuẩn hoá vùng', () => {
  it('tên vùng chuẩn đi nguyên, và là giá trị chọn sẵn của form sửa', () => {
    const vm = toDestinationRowVM(row());

    expect(vm.regionName).toBe('Central Vietnam');
    expect(vm.regionLabel).toBe('Central Vietnam');
  });

  it('chuỗi kiểu cũ mà web vẫn nhận (khoá ngắn, sai hoa-thường) ra ĐÚNG tên chuẩn', () => {
    // Web xếp `north` vào miền Bắc; bảng admin mà báo "No region" cho nó là
    // nói sai về một điểm đến đang hiện bình thường trên site.
    expect(toDestinationRowVM(row({ region: 'north' })).regionName).toBe('Northern Vietnam');
    expect(toDestinationRowVM(row({ region: '  southern vietnam ' })).regionName).toBe(
      'Southern Vietnam',
    );
  });

  it('chuỗi không khớp vùng nào, hay `null`, ra "No region" — không đoán', () => {
    // Đây là ca ADR-0045 mô tả: điểm đến biến khỏi mọi trang vùng mà không có
    // lỗi nào ở đâu cả. Bảng là chỗ đầu tiên nói ra điều đó.
    for (const region of ['Mekong', null]) {
      const vm = toDestinationRowVM(row({ region }));
      expect(vm.regionName).toBeNull();
      expect(vm.regionLabel).toBe(t.list.noRegion);
    }
  });
});

describe('toDestinationRowVM — phần còn lại', () => {
  it('trạng thái thành chữ, dùng CÙNG chữ với bảng danh mục', () => {
    // Bài học 20: một chữ cho mỗi khái niệm — hai bảng tra cứu nói hai chữ cho
    // cùng một trạng thái là người đọc tưởng hai thứ khác nhau.
    expect(toDestinationRowVM(row()).statusLabel).toBe(messages.admin.categories.list.active);
    expect(toDestinationRowVM(row({ isActive: false })).statusLabel).toBe(
      messages.admin.categories.list.inactive,
    );
  });

  it('ô Tours: tổng mọi trạng thái là dòng chính, số đang bán là dòng phụ; 0 thì "No tours"', () => {
    const busy = toDestinationRowVM(row({ tourCount: 3, linkedTourCount: 5 }));
    const empty = toDestinationRowVM(row({ tourCount: 0, linkedTourCount: 0 }));
    // So với `messages`: chữ ghim ở MỘT nơi là spec i18n (review RU2).
    expect(busy.toursLabel).toBe(t.list.tours(5));
    expect(busy.publishedLabel).toBe(t.list.published(3));
    expect(empty.toursLabel).toBe(t.list.noTours);
    expect(empty.publishedLabel).toBeNull();
  });

  it('khe deploy — hàng từ API cũ thiếu `linkedTourCount`: ô Tours in dấu trống, một dòng (review E2)', () => {
    // Trước bản vá ô in "undefined tours" trên "3 published".
    const stale = toDestinationRowVM(
      row({ tourCount: 3, linkedTourCount: undefined as unknown as number }),
    );

    expect(stale.toursLabel).toBe(t.list.toursUnknown);
    expect(stale.publishedLabel).toBeNull();
  });

  it('chỉ có tour nháp vẫn là "1 tour", không phải "No tours"', () => {
    // Nhãn đếm theo `linkedTourCount` như nút Delete: đếm theo số đang bán thì hàng này in
    // "No tours" ngay cạnh một nút Delete đang khoá — hai chỗ của một hàng nói ngược nhau.
    const draftOnly = toDestinationRowVM(row({ tourCount: 0, linkedTourCount: 1 }));

    expect(draftOnly.toursLabel).toBe(t.list.tours(1));
    expect(draftOnly.publishedLabel).toBe(t.list.published(0));
    // Con số nút Delete đọc: tổng mọi trạng thái, không phải số đang bán.
    expect(draftOnly.linkedTourCount).toBe(1);
  });

  it('mô tả THÔ đi riêng khỏi mô tả HIỂN THỊ', () => {
    // Một mô tả thật đúng bằng câu thay thế vẫn phải mở ra đúng nó trong form.
    const empty = toDestinationRowVM(row());
    const same = toDestinationRowVM(row({ description: t.list.inherited }));

    expect(empty.description).toBe(t.list.inherited);
    expect(empty.descriptionValue).toBe('');
    expect(same.descriptionValue).toBe(t.list.inherited);
  });

  it('chở nguyên id, slug, tên và quốc gia', () => {
    const vm = toDestinationRowVM(row({ country: 'Viet Nam' }));

    expect(vm).toMatchObject({
      id: row().id,
      slug: 'hoi-an',
      name: 'Hội An',
      country: 'Viet Nam',
    });
  });
});
