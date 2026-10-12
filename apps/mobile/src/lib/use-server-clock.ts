import { useQuery } from '@tanstack/react-query';
import { vietnamToday } from '@tourism/contract';
import { orpc } from '@/lib/api/client';
import { clockOffsetMs, serverNow } from './server-clock';

/**
 * Gọi `health.check` MỘT lần mỗi phiên (`staleTime`/`gcTime` = Infinity —
 * React Query không refetch, không gc, mọi màn dùng chung một lượt gọi).
 * Lệch đo bằng `dataUpdatedAt` — giờ MÁY lúc phản hồi về, lưu cùng dữ liệu
 * trong cache — chứ không bằng `Date.now()` lúc đọc. Đọc bằng `Date.now()` (kể
 * cả trong `select`) là đồng hồ đứng yên ở mốc `timestamp` đầu: `select` viết
 * inline chạy lại mỗi lần render (K2), còn `select` tách ra ngoài vẫn chạy lại
 * cho MỖI màn mới mount, vì React Query nhớ kết quả `select` riêng từng màn —
 * màn mở sau vài giờ (P1–P6, lịch trình) bắt đầu từ đúng giờ gọi đầu tiên.
 *
 * `offsetMs = 0` khi chưa có dữ liệu (app mới mở) — màn tạm dùng giờ máy, sai
 * số đó biến mất ngay khi `health.check` về.
 */
function useServerClockOffsetMs(): number {
  const query = useQuery(orpc.health.check.queryOptions({ staleTime: Infinity, gcTime: Infinity }));
  if (query.data === undefined) return 0;
  return clockOffsetMs(query.data.timestamp, query.dataUpdatedAt);
}

/**
 * "Bây giờ" server (`Date`) VÀ ngày lịch Việt Nam suy từ đó — một hook DUY
 * NHẤT để mọi màn cụm P đọc cùng một mốc trong cùng một lượt render (gọi hai
 * hook riêng cho `now`/`today` có thể lệch vài ms giữa hai lời gọi `Date.now()`,
 * vô hại ở tầm ngày nhưng P5 còn so theo GIỜ:PHÚT — lệch nhỏ đó đủ đổi kết
 * quả `timedStopStates` ở biên).
 */
export function useServerClock(): { now: Date; today: string } {
  const offsetMs = useServerClockOffsetMs();
  const now = serverNow(offsetMs);
  return { now, today: vietnamToday(now) };
}

/** Ngày lịch Việt Nam "bây giờ" theo đồng hồ server — cụm P dùng số này cho
 *  mọi phép so với `departureStartDate`/`departureEndDate`. */
export function useServerToday(): string {
  return useServerClock().today;
}
