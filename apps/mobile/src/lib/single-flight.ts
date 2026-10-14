/**
 * Chặn bấm đúp vào một thao tác async (N7, rà 07/10): trong lúc lượt trước chưa xong, lượt tới sau
 * bị bỏ qua (trả `undefined`) thay vì chạy song song. Dùng cho nút mở trình chọn ảnh: bấm hai lần
 * trước khi picker kịp mở là hai lời gọi `launch…Async` chồng nhau. Chuyện gì xảy ra khi ấy tuỳ nền
 * tảng (N7 nghi hai picker, hay lượt sau ném lỗi thành câu lỗi tải ảnh) và chưa đo trên máy thật,
 * nên chặn từ gốc. Khoá nhả khi lượt đang chạy xong, kể cả khi nó ném lỗi.
 */
export function createSingleFlight(): <T>(task: () => Promise<T>) => Promise<T | undefined> {
  let running = false;
  return async (task) => {
    if (running) return undefined;
    running = true;
    try {
      return await task();
    } finally {
      running = false;
    }
  };
}
