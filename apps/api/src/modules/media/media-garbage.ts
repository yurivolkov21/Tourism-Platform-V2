/**
 * Phần THUẦN của bộ dọn ảnh mồ côi trên Cloudinary (ADR-0035).
 *
 * Tách khỏi service vì đây là chỗ chứa LƯỚI AN TOÀN của cả cơ chế, và lưới an
 * toàn thì phải test được mà không có gì bị xoá thật. Mọi lời gọi ra CDN nằm ở
 * `cloudinary-destroy.ts`; mọi câu DB nằm ở `media-garbage.service.ts`.
 */

const DAY_MS = 86_400_000;

// Độ trễ 7 ngày KHÔNG còn là hằng ở đây: nó sống ở `env.ts`
// (`MEDIA_GC_GRACE_DAYS`, mặc định 7, `.min(1)`) — nơi duy nhất production
// đọc. Bản đầu có `GC_GRACE_DAYS` ở đây kèm test "khoá lưới an toàn", nhưng
// không dòng code chạy nào đọc nó, tức test canh một hằng vô hiệu trong khi
// số thật ở env có thể đổi (vòng vá review 05/09). Lý do vì sao là 7 ngày ghi
// ở env.ts.

/**
 * Thử lại tối đa bao nhiêu lượt trước khi bỏ cuộc với một row.
 *
 * Bỏ cuộc chứ KHÔNG xoá row: một publicId hỏng mãi là một vết cần người xem
 * (quyền API bị thu hồi? cloud name sai?), và xoá nó đi là xoá luôn triệu
 * chứng. Row nằm lại với `attempts` chạm trần và `lastError` nguyên văn.
 */
export const GC_MAX_ATTEMPTS = 5;

/**
 * Mốc "cũ hơn mốc này thì tới hạn". Tính bằng phép trừ epoch chứ không đụng
 * lịch — không có ca riêng nào cho giao tháng, giao năm hay năm nhuận.
 *
 * `graceDays = 0` được tôn trọng nguyên văn — "mọi row đã tới hạn" là một
 * hành vi đọc được, và env schema đã chặn giá trị âm ở tầng config.
 *
 * Nhưng số ÂM vẫn bị kẹp về 0, và đó không phải phòng thủ thừa: `now − (−3
 * ngày)` là một mốc ở **tương lai**, tức mọi row đều quá hạn kể cả row vừa
 * ghi một giây trước. Một dấu trừ lọt vào đây không làm hàng đợi chạy sai một
 * chút — nó xoá lưới an toàn 7 ngày và biến bộ dọn thành xoá-ngay-lập-tức.
 * Đây là hàm KHÔNG được phép trả về một mốc muộn hơn `now`. (Test bắt được
 * lúc thi công, không phải suy đoán.)
 */
export function dueBefore(now: Date, graceDays: number): Date {
  return new Date(now.getTime() - Math.max(0, graceDays) * DAY_MS);
}

/**
 * Phán quyết của một lượt destroy. `destroyed` và `absent` đều là XONG (row
 * rời hàng đợi), nhưng phải phân biệt được vì log của lượt chạy đầu trên prod
 * là thứ duy nhất nói cho người vận hành biết bộ dọn có xoá THẬT không: nếu
 * publicId ghi sai dạng (thiếu folder, sai resource type), Cloudinary trả
 * `not found` cho MỌI row và hàng đợi sạch bong mà không byte nào bị xoá —
 * gộp hai ca thành một con số là che mất đúng lỗi ấy (vòng vá review 05/09).
 */
export type DestroyOutcome = 'destroyed' | 'absent' | 'failed';

/**
 * Đọc phản hồi `uploader.destroy` của Cloudinary.
 *
 * `not found` CŨNG là **xong**, và đây là ca thường gặp NHẤT chứ không phải
 * ngoại lệ: ADR-0035 §3 ghi publicId vào hàng đợi ngay lúc KÝ chữ ký, nên
 * phần lớn row là những lần khách kéo ảnh vào form rồi bỏ trang — file chưa
 * bao giờ lên tới CDN. Coi đó là lỗi thì hàng đợi tự bơm `attempts` và không
 * bao giờ sạch.
 */
export function classifyDestroyResult(response: { result?: string }): DestroyOutcome {
  if (response.result === 'ok') return 'destroyed';
  if (response.result === 'not found') return 'absent';
  return 'failed';
}

/** Còn được thử nữa không. */
export function shouldRetry(attempts: number): boolean {
  return attempts < GC_MAX_ATTEMPTS;
}
