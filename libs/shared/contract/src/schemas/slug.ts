/**
 * Bỏ dấu tiếng Việt, và sinh slug từ tên tiếng Việt.
 *
 * ## `foldAccents` sống ở đây, không ở `apps/web`
 *
 * Hàm bỏ dấu ra đời ở `apps/web/src/lib/text.ts` (nuôi ô tìm kiếm của blog và
 * tours: gõ "ha long" phải ra "Hạ Long"). Từ 22/09 nó chuyển xuống đây và
 * `text.ts` re-export lại — vì `slugifyVietnamese` cần đúng luật ấy, mà gói
 * `contract` KHÔNG import được `apps/web`. Hai bản riêng thì sửa một ca lạ ở
 * một bên là hai bên đọc cùng một cái tên ra hai chuỗi khác nhau, im lặng.
 *
 * ## Slug là GỢI Ý, không phải luật
 *
 * Slug đang có trong DB do người chọn, và có cái không suy máy móc ra được: đo
 * trên production 22/09, `Hà Nội` mang slug `hanoi` chứ không phải `ha-noi`.
 * Nên ô slug ở form tạo chỉ ĐIỀN SẴN kết quả của hàm này rồi để admin sửa;
 * form sửa thì không có ô ấy vì slug khoá sau khi tạo (slug nằm trong URL công
 * khai dạng tham số truy vấn, mà tham số truy vấn thì không chuyển hướng được).
 *
 * ## Vì sao không dùng `slugify` của web
 *
 * `apps/web/src/lib/slug.ts` viết cho id section và anchor mục lục: nó xoá mọi
 * ký tự ngoài `[a-z0-9]`, nên `Đà Lạt` ra `l-t` và `Hà Nội` ra `h-n-i`. Với
 * tên địa danh tiếng Việt thì đó là rác, không phải slug. Hàm ấy KHÁC
 * `foldAccents` — chính nó mới là thứ cần dùng lại.
 */

/**
 * Dấu phụ sau khi NFD tách ra — dùng lớp Unicode `\p{M}`, KHÔNG viết dải tay.
 *
 * Bản đầu viết `/[<U+0300>-<U+036F>]/` bằng chính hai ký tự tổ hợp, và trên
 * màn hình nó trông như một cặp ngoặc vuông méo: cả hai đầu dải đều vô hình,
 * dấu huyền vẽ đè lên chính dấu ngoặc. Repo đã trả giá hai lần cho lớp lỗi
 * ký-tự-vô-hình (797 file CRLF, dấu `+` cột 0 trong CHANGELOG), và viết
 * `̀-ͯ` cũng không thoát: công cụ ghi file biến escape thành ký tự
 * thô (đo 22/09 bằng `cat -A`). `\p{M}` không có ký tự nào để mà vô hình, và
 * nó còn ĐÚNG hơn — phủ mọi dấu phụ chứ không riêng một dải.
 */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * `Đ`/`đ` có HAI mã Unicode trông y hệt nhau, phải xử cả hai.
 *
 * U+0110/U+0111 là D-CÓ-GẠCH, chữ cái tiếng Việt thật. U+00D0/U+00F0 là ETH —
 * chữ của tiếng Iceland — nhưng TCVN3/VNI và vài bộ gõ tiếng Việt vẫn sinh ra
 * nó, và trên màn hình không phân biệt được. Cả bốn đều KHÔNG phân rã qua NFD
 * (chúng là ký tự Latin riêng, không phải `d` cộng dấu), nên bỏ sót là chữ ấy
 * rơi thẳng vào `[^a-z0-9]` và biến mất: ETH-à-Lạt ra `a-lat`. Mà slug thì
 * khoá vĩnh viễn sau khi tạo.
 *
 * Dựng từ MÃ SỐ chứ không gõ ký tự vào regex: bốn ký tự này vẽ giống nhau từng
 * đôi một, nên trong mã nguồn chúng phải đọc được bằng mắt là bốn thứ khác nhau.
 */
const D_STROKE_UPPER = new RegExp(`[${String.fromCodePoint(0x0110, 0x00d0)}]`, 'g');
const D_STROKE_LOWER = new RegExp(`[${String.fromCodePoint(0x0111, 0x00f0)}]`, 'g');

/**
 * Bỏ dấu tiếng Việt và hạ chữ thường — `Hạ Long` → `ha long`.
 *
 * Dùng cho MỌI phép so khớp bỏ dấu: ô tìm kiếm của web và ô slug của admin.
 */
export function foldAccents(value: string): string {
  return value
    .replace(D_STROKE_UPPER, 'D')
    .replace(D_STROKE_LOWER, 'd')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
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
 * dấu gạch: `CATEGORY_SLUG_PATTERN` từ chối `'-'`, nhưng trả về một thứ chắc
 * chắn bị từ chối là để người ta thấy một câu lỗi khó hiểu ở ô slug.
 */
export function slugifyVietnamese(value: string, maxLength: number): string {
  const base = foldAccents(value)
    .replace(/[^a-z0-9]+/g, '-')
    // Trim gạch ở hai đầu TRƯỚC khi cắt, để "  Hạ Long  " không tốn mất hai ký
    // tự đầu của hạn mức cho hai dấu gạch rồi bị cắt hụt.
    .replace(/^-+|-+$/g, '');

  // Cắt RỒI mới trim lần hai: nhát cắt có thể rơi đúng vào một dấu phân cách,
  // và một slug kết thúc bằng gạch vừa xấu vừa khác thứ người ta tưởng đã đặt.
  return base.slice(0, maxLength).replace(/-+$/, '');
}
