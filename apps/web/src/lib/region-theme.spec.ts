import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { regionTheme } from './region-theme';

describe('regionTheme', () => {
  // Bất biến CỦA CẢ CỤM: ba trang phải MỞ ĐẦU khác nhau. Trước 5j cả ba mở bằng
  // đúng một khu (Signature ngay sau Intro) nên user đọc ba trang thấy "na ná".
  it('mỗi vùng mở đầu bằng một khu KHÁC nhau — đó là cả điểm của việc phân hoá', () => {
    const openings = REGIONS.map((r) => regionTheme(r.key).openWith);
    expect(new Set(openings).size).toBe(3);
  });

  it('Bắc mở bằng phổ, Trung mở bằng dải một-ngày, Nam mở bằng bưu thiếp', () => {
    // Khu mở đầu cắm vào SỰ THẬT dữ liệu của từng vùng (đo 29/07):
    //  · Bắc là vùng DUY NHẤT trải 1→8 ngày và chạm bậc Challenging → phổ.
    //  · Trung có 4/5 chuyến riêng gói gọn trong một ngày → dải một-ngày.
    //  · Nam mỏng dữ liệu nhất nhưng bán cảnh → bưu thiếp dẫn bằng ảnh.
    expect(regionTheme('north').openWith).toBe('spectrum');
    expect(regionTheme('central').openWith).toBe('dayTrips');
    expect(regionTheme('south').openWith).toBe('postcards');
  });

  it('Bắc và Trung có khu chữ ký thứ hai, mỗi vùng một biến thể khác nhau', () => {
    expect(regionTheme('north').secondSignature).toBe('seasons');
    expect(regionTheme('central').secondSignature).toBe('timeline');
  });

  // ĐỪNG "bổ sung cho đủ đối xứng". Xem JSDoc `THEMES` trong region-theme.ts:
  // mọi khu thứ hai nghĩ ra cho Nam đều trùng hình với khu đã có hoặc phải bịa.
  it('CHỈ miền Nam không có khu chữ ký thứ hai — chủ đích, không phải thiếu sót', () => {
    const withoutSecond = REGIONS.filter((r) => regionTheme(r.key).secondSignature === null);
    expect(withoutSecond.map((r) => r.key)).toEqual(['south']);
  });

  // Khu mở đầu và khu chữ ký thứ hai KHÔNG được là cùng một thứ trên một trang —
  // in hai lần cùng một khu là đúng thứ "na ná" mà task này đi sửa.
  it('không vùng nào dựng cùng một khu hai lần', () => {
    for (const region of REGIONS) {
      const theme = regionTheme(region.key);
      expect(theme.openWith, region.key).not.toBe(theme.secondSignature);
    }
  });

  // Field `signature` đã bị `openWith` + `secondSignature` thay thế (Task 5j).
  // Test "ba biến thể signature khác nhau" cũ đã XOÁ cùng nó — nó đọc một field
  // không còn tồn tại. Test "hero của Bắc CAO hơn" xoá trước đó (ADR-0015).
  it('không còn field `signature` — nó đã bị hai field thứ-tự-khu thay thế', () => {
    expect('signature' in regionTheme('north')).toBe(false);
  });
});
