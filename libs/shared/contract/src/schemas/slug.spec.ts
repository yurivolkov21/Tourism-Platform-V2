import { CATEGORY_SLUG_MAX, CategorySlugSchema } from './admin-categories.js';
import { DESTINATION_SLUG_MAX, DestinationSlugSchema } from './admin-destinations.js';
import { foldAccents, SLUG_PATTERN, slugifyVietnamese, slugSchema } from './slug.js';

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

/** Trần thật của hai cột dùng hàm này — cả hai lấy từ contract, một nguồn. */
const CATEGORY_MAX = CATEGORY_SLUG_MAX;
const DESTINATION_MAX = DESTINATION_SLUG_MAX;

describe('slugifyVietnamese', () => {
  it('bỏ dấu tiếng Việt thay vì xoá ký tự', () => {
    // Đây là toàn bộ lý do hàm này tồn tại. `slugify` của web cho ra `l-t`.
    expect(slugifyVietnamese('Đà Lạt', DESTINATION_MAX)).toBe('da-lat');
    expect(slugifyVietnamese('Đà Nẵng', DESTINATION_MAX)).toBe('da-nang');
    expect(slugifyVietnamese('Cần Thơ', DESTINATION_MAX)).toBe('can-tho');
  });

  it('ETH (U+00D0/U+00F0) cũng là `Đ` — trông y hệt, mã khác', () => {
    // TCVN3/VNI và vài bộ gõ tiếng Việt sinh ra ETH thay vì D-CÓ-GẠCH. Hai mã
    // vẽ giống nhau nên admin thấy tên ĐÚNG mà slug mất chữ đầu — và slug thì
    // khoá vĩnh viễn sau khi tạo.
    //
    // Dựng tên từ MÃ SỐ: gõ ký tự thẳng vào đây thì hai ca dưới trông y hệt
    // nhau và người đọc không biết ca nào đang thử mã nào.
    const eth = String.fromCodePoint(0x00d0);
    const dStroke = String.fromCodePoint(0x0110);

    expect(slugifyVietnamese(`${eth}à Lạt`, DESTINATION_MAX)).toBe('da-lat');
    expect(slugifyVietnamese(`${eth}ồng Hới`, DESTINATION_MAX)).toBe('dong-hoi');
    // Và bản D-CÓ-GẠCH phải cho ra ĐÚNG cùng một chuỗi.
    expect(slugifyVietnamese(`${dStroke}ồng Hới`, DESTINATION_MAX)).toBe(
      slugifyVietnamese(`${eth}ồng Hới`, DESTINATION_MAX),
    );
  });

  it('kết quả luôn qua được `SLUG_PATTERN`, hoặc là chuỗi rỗng', () => {
    // Hàm sinh và khuôn kiểm phải khớp nhau: sinh ra thứ chính schema từ chối
    // là bày cho admin một câu lỗi ngay trên ô vừa tự điền.
    for (const name of ['Đà Lạt', '  Hạ Long  ', 'A---B', '!!!', 'Tour 2026', '-Huế-']) {
      const slug = slugifyVietnamese(name, CATEGORY_MAX);
      if (slug !== '') expect(SLUG_PATTERN.test(slug)).toBe(true);
    }
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

describe('foldAccents', () => {
  it('cùng một bản cài đặt với `slugifyVietnamese`', () => {
    // Hàm này trước 22/09 có bản riêng ở `apps/web/src/lib/text.ts`. Hai bản
    // trôi lệch thì ô tìm kiếm của web và ô slug của admin đọc cùng một cái
    // tên ra hai chuỗi khác nhau.
    expect(foldAccents('Hạ Long')).toBe('ha long');
    expect(foldAccents('Đà Nẵng')).toBe('da nang');
    expect(foldAccents(`${String.fromCodePoint(0x00d0)}à Nẵng`)).toBe('da nang');
  });

  it('giữ nguyên hành vi cũ mà web đang dựa vào', () => {
    // Ba ca này là nguyên văn thứ `searchTours`/`searchPosts` đang canh.
    expect(foldAccents('bún chả')).toBe('bun cha');
    expect(foldAccents('HỘI AN')).toBe('hoi an');
    expect(foldAccents('plain text')).toBe('plain text');
  });
});

describe('SLUG_PATTERN và slugSchema — MỘT khuôn cho mọi bảng', () => {
  // Bài học 6 của vòng review F14: khuôn slug từng mang tên `CATEGORY_SLUG_PATTERN`
  // và nằm ở file danh mục, trong khi nó không riêng gì danh mục. Điểm đến dùng
  // lại CHÍNH khuôn ấy — hai bản khuôn là hai luật slug trôi xa nhau.

  it('gạch nối chỉ nằm GIỮA hai cụm chữ-số', () => {
    for (const slug of ['-', '---', '-day', 'day-', 'day--trips', 'Day', 'day_trips', '']) {
      expect(SLUG_PATTERN.test(slug), slug).toBe(false);
    }
    for (const slug of ['day', 'day-trips', 'ho-chi-minh-city', 'tour-2026']) {
      expect(SLUG_PATTERN.test(slug), slug).toBe(true);
    }
  });

  it('`slugSchema` cắt theo trần do chỗ gọi truyền vào', () => {
    const schema = slugSchema(5);

    expect(schema.safeParse('abcde').success).toBe(true);
    expect(schema.safeParse('abcdef').success).toBe(false);
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('ab-').success).toBe(false);
  });

  it('danh mục và điểm đến báo CÙNG một câu cho cùng một slug hỏng', () => {
    // Câu lỗi ấy đi thẳng ra response 400 của API; hai bảng nói hai câu khác
    // nhau cho cùng một luật là dấu hiệu luật đã tách làm hai.
    //
    // So CẢ danh sách câu, không riêng câu đầu: một luật thứ hai gắn thêm vào
    // một bảng vẫn để câu đầu trùng nhau (đo lúc kiểm đột biến).
    const messages = (schema: typeof CategorySlugSchema) =>
      schema.safeParse('day--trips').error?.issues.map((issue) => issue.message);

    expect(messages(CategorySlugSchema)).toHaveLength(1);
    expect(messages(DestinationSlugSchema)).toEqual(messages(CategorySlugSchema));
  });

  it('hai bảng giữ hai TRẦN riêng — 60 cho danh mục, 80 cho điểm đến', () => {
    const slug = 'a'.repeat(70);

    expect(CategorySlugSchema.safeParse(slug).success).toBe(false);
    expect(DestinationSlugSchema.safeParse(slug).success).toBe(true);
  });
});
