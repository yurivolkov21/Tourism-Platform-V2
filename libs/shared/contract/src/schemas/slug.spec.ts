import { CATEGORY_SLUG_MAX } from './admin-categories.js';
import { slugifyVietnamese } from './slug.js';

/**
 * Sinh slug từ tên tiếng Việt (spec P4e-2 §2c).
 *
 * Hàm này là **GỢI Ý**, không phải luật. Đo trên production 22/09: slug thật do
 * người chọn, và có cái không suy máy móc ra được — `Hà Nội` mang slug `hanoi`
 * chứ không phải `ha-noi`. Nên ô slug ở form TẠO điền sẵn kết quả của hàm này
 * rồi để admin sửa; form SỬA không có ô ấy (slug khoá sau khi tạo).
 *
 * KHÔNG dùng lại `slugify` của `apps/web/src/lib/slug.ts`: hàm đó viết cho
 * anchor mục lục nên xoá sạch ký tự có dấu — `Đà Lạt` ra `l-t`.
 */

/**
 * Trần thật của hai cột dùng hàm này. Danh mục lấy từ contract (một nguồn);
 * điểm đến còn viết số ở đây vì `admin-destinations.ts` là việc của F15 — đổi
 * sang hằng thật ngay khi file ấy có.
 */
const CATEGORY_MAX = CATEGORY_SLUG_MAX;
const DESTINATION_MAX = 80;

describe('slugifyVietnamese', () => {
  it('bỏ dấu tiếng Việt thay vì xoá ký tự', () => {
    // Đây là toàn bộ lý do hàm này tồn tại. `slugify` của web cho ra `l-t`.
    expect(slugifyVietnamese('Đà Lạt', DESTINATION_MAX)).toBe('da-lat');
    expect(slugifyVietnamese('Đà Nẵng', DESTINATION_MAX)).toBe('da-nang');
    expect(slugifyVietnamese('Cần Thơ', DESTINATION_MAX)).toBe('can-tho');
  });

  it('`đ` và `Đ` thành `d` — NFD không tách được chữ này', () => {
    // `'Đ'.normalize('NFD')` vẫn là một ký tự, không phải D + dấu gạch. Bỏ sót
    // là `Đà Lạt` ra `-a-lat`.
    expect(slugifyVietnamese('Đồng Hới', DESTINATION_MAX)).toBe('dong-hoi');
    expect(slugifyVietnamese('đảo Phú Quốc', DESTINATION_MAX)).toBe('dao-phu-quoc');
  });

  it('gom mọi thứ không phải chữ-số thành MỘT gạch', () => {
    expect(slugifyVietnamese('  Hạ  Long  ', DESTINATION_MAX)).toBe('ha-long');
    expect(slugifyVietnamese('Việt Nam 2026!', DESTINATION_MAX)).toBe('viet-nam-2026');
    expect(slugifyVietnamese('Sa Pa — Fansipan', DESTINATION_MAX)).toBe('sa-pa-fansipan');
  });

  it('cắt theo `maxLength` và KHÔNG để lại gạch ở cuối', () => {
    // Cắt trước rồi mới trim gạch: cắt giữa một dấu phân cách là để lại
    // `...-` và slug ấy vừa xấu vừa lệch với slug người ta tưởng mình đặt.
    expect(slugifyVietnamese('a'.repeat(100), CATEGORY_MAX)).toHaveLength(CATEGORY_MAX);
    expect(slugifyVietnamese('abcde fghij', 6)).toBe('abcde');
    expect(slugifyVietnamese('abcdef ghij', 7)).toBe('abcdef');
  });

  it('hai trần khác nhau cho hai bảng — hàm nhận độ dài, không tự đoán', () => {
    const ten = 'Vườn quốc gia Phong Nha Kẻ Bàng và vùng đệm Quảng Bình';

    expect(slugifyVietnamese(ten, CATEGORY_MAX).length).toBeLessThanOrEqual(CATEGORY_MAX);
    expect(slugifyVietnamese(ten, DESTINATION_MAX).length).toBeLessThanOrEqual(DESTINATION_MAX);
  });

  it('chuỗi rỗng hoặc toàn ký tự lạ ra chuỗi rỗng, không ra một gạch', () => {
    // Trả `'-'` thì schema slug sẽ nhận, và ta có một slug vô nghĩa trong DB.
    expect(slugifyVietnamese('', CATEGORY_MAX)).toBe('');
    expect(slugifyVietnamese('   ', CATEGORY_MAX)).toBe('');
    expect(slugifyVietnamese('!!! ???', CATEGORY_MAX)).toBe('');
  });

  it('slug sẵn đúng khuôn thì đi qua nguyên vẹn', () => {
    expect(slugifyVietnamese('ha-long', DESTINATION_MAX)).toBe('ha-long');
  });
});
