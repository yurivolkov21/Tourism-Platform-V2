/**
 * Sinh slug từ tên tiếng Việt — dùng ở form TẠO của admin (spec P4e-2 §2c).
 *
 * ## Đây là GỢI Ý, không phải luật
 *
 * Slug đang có trong DB do người chọn, và có cái không suy máy móc ra được: đo
 * trên production 22/09, `Hà Nội` mang slug `hanoi` chứ không phải `ha-noi`.
 * Nên ô slug ở form tạo chỉ ĐIỀN SẴN kết quả của hàm này rồi để admin sửa;
 * form sửa thì không có ô ấy vì slug khoá sau khi tạo (slug nằm trong URL công
 * khai dạng tham số truy vấn, mà tham số truy vấn thì không chuyển hướng được).
 *
 * ## Vì sao không dùng lại `slugify` của web
 *
 * `apps/web/src/lib/slug.ts` viết cho id section và anchor mục lục: nó xoá mọi
 * ký tự ngoài `[a-z0-9]`, nên `Đà Lạt` ra `l-t` và `Hà Nội` ra `h-n-i`. Với
 * tên địa danh tiếng Việt thì đó là rác, không phải slug.
 */

/**
 * Dấu tiếng Việt bỏ được bằng `normalize('NFD')` — trừ `đ`/`Đ`.
 *
 * NFD tách một chữ có dấu thành chữ gốc cộng ký tự dấu phụ, rồi ta xoá dải dấu
 * phụ đi. Nhưng `đ` KHÔNG phải `d` cộng dấu: nó là một ký tự Latin riêng, NFD
 * trả lại chính nó. Bỏ sót chỗ này thì `Đà Lạt` ra `-a-lat` — mất luôn chữ đầu.
 */
function boDauTiengViet(value: string): string {
  return value.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Tên → slug, cắt theo `maxLength`.
 *
 * `maxLength` đến từ chỗ gọi chứ không phải hằng trong file này: hai bảng dùng
 * hàm này có hai trần khác nhau (danh mục 60, điểm đến 80). Một hàm tự biết
 * trần của hai bảng khác nhau là một hàm biết quá nhiều — và là một chỗ nữa
 * phải nhớ sửa khi cột đổi độ rộng.
 *
 * Trả chuỗi RỖNG khi không còn gì dùng được (tên toàn ký tự lạ). Không trả một
 * dấu gạch: `'-'` sẽ lọt qua schema slug và để lại một hàng vô nghĩa trong DB.
 */
export function slugifyVietnamese(value: string, maxLength: number): string {
  const base = boDauTiengViet(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    // Trim gạch ở hai đầu TRƯỚC khi cắt, để "  Hạ Long  " không tốn mất hai ký
    // tự đầu của hạn mức cho hai dấu gạch rồi bị cắt hụt.
    .replace(/^-+|-+$/g, '');

  // Cắt RỒI mới trim lần hai: nhát cắt có thể rơi đúng vào một dấu phân cách,
  // và một slug kết thúc bằng gạch vừa xấu vừa khác thứ người ta tưởng đã đặt.
  return base.slice(0, maxLength).replace(/-+$/, '');
}
