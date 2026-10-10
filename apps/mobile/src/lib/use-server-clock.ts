import { useQuery } from '@tanstack/react-query';
import { vietnamToday } from '@tourism/contract';
import { orpc } from '@/lib/api/client';
import { clockOffsetMs, serverNow } from './server-clock';

/**
 * Gọi `health.check` MỘT lần mỗi phiên (`staleTime`/`gcTime` = Infinity —
 * React Query không refetch, không gc, mọi màn dùng chung một lượt gọi).
 * `select` chạy lúc dữ liệu vừa tới nên `Date.now()` bên trong gần đúng thời
 * điểm đo thật; đọc lại cache (không refetch) thì React Query nhớ sẵn kết quả
 * `select`, không gọi lại hàm — lệch không "trôi" theo số lần render.
 *
 * `offsetMs = 0` khi chưa có dữ liệu (app mới mở) — màn tạm dùng giờ máy, sai
 * số đó biến mất ngay khi `health.check` về.
 */
// Phải là hàm module-scope (tham chiếu ổn định): `select` viết inline bị React
// Query gọi lại mỗi lần render, `Date.now()` đổi theo nên offset luôn ≈ 0 và đồng
// hồ server đứng yên ở mốc `timestamp` đầu tiên.
const selectOffsetMs = (data: { timestamp: string }): number =>
  clockOffsetMs(data.timestamp, Date.now());

function useServerClockOffsetMs(): number {
  const query = useQuery({
    ...orpc.health.check.queryOptions({ staleTime: Infinity, gcTime: Infinity }),
    select: selectOffsetMs,
  });
  return query.data ?? 0;
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
