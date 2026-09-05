/**
 * Phần THUẦN của bộ dọn ảnh mồ côi trên Cloudinary (ADR-0035).
 *
 * Tách khỏi service vì đây là chỗ chứa LƯỚI AN TOÀN của cả cơ chế, và lưới an
 * toàn thì phải test được mà không có gì bị xoá thật. Mọi lời gọi ra CDN nằm ở
 * `cloudinary-destroy.ts`; mọi câu DB nằm ở `media-garbage.service.ts`.
 */

const DAY_MS = 86_400_000;

/**
 * Số ngày một publicId phải nằm trong hàng đợi trước khi được phép xoá.
 *
 * `destroy` của Cloudinary **không hoàn tác được** — không thùng rác, không
 * undo — và phần lớn ảnh nguồn là CC BY / CC BY-SA lấy từ Commons (ADR-0020),
 * mất là phải đi xin lại và ghi công lại.
 *
 * Bảy ngày là con số dành cho CON NGƯỜI, không phải cho máy: một bug làm
 * enqueue nhầm cả gallery sẽ hiện ra ở trang tour trước rất lâu, và tuần ấy là
 * khoảng thời gian gỡ ngòi (dừng worker, xoá sạch bảng) trước khi mất gì. Xoá
 * ngay thì lần đầu ai đó biết là lúc ảnh đã không còn.
 */
export const GC_GRACE_DAYS = 7;

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

/** Phán quyết của một lượt destroy: xong hẳn, hay để lại thử lần sau. */
export type DestroyOutcome = 'done' | 'failed';

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
  return response.result === 'ok' || response.result === 'not found' ? 'done' : 'failed';
}

/** Còn được thử nữa không. */
export function shouldRetry(attempts: number): boolean {
  return attempts < GC_MAX_ATTEMPTS;
}
