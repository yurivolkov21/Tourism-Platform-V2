import { z } from 'zod';

/**
 * "Tour này đã đủ để bán chưa" (ADR-0047 §4) — THUẦN, dùng ở ba nơi: API chặn
 * `setPublished(true)` và chặn lệnh sửa làm một tour ĐANG BÁN trở nên thiếu;
 * admin in khung readiness và báo trước khi lưu. Một luật, một bản.
 *
 * Ba điều kiện, cả 29 tour hiện có đều đạt (đo 24/09): có tóm tắt, đúng một
 * điểm đến chính, lịch trình đủ mọi ngày 1..N. F18 thêm ảnh bìa.
 */
export interface TourReadinessInput {
  summary: string | null;
  destinations: readonly { isPrimary: boolean }[];
  durationDays: number;
  /** `dayNumber` của các ngày ĐÃ có hàng — hàng lịch trình luôn có tiêu đề. */
  itineraryDays: readonly number[];
}

export const TourReadinessSchema = z.object({
  summary: z.boolean(),
  primaryDestination: z.boolean(),
  /** Ngày 1..N chưa có lịch trình, tăng dần. */
  missingDays: z.array(z.int().positive()),
  ready: z.boolean(),
});
export type TourReadiness = z.output<typeof TourReadinessSchema>;

export function tourReadiness(input: TourReadinessInput): TourReadiness {
  const summary = (input.summary ?? '').trim() !== '';
  const primaryDestination = input.destinations.filter((link) => link.isPrimary).length === 1;
  const present = new Set(input.itineraryDays);
  const missingDays: number[] = [];
  for (let day = 1; day <= input.durationDays; day += 1) {
    if (!present.has(day)) missingDays.push(day);
  }
  return {
    summary,
    primaryDestination,
    missingDays,
    ready: summary && primaryDestination && missingDays.length === 0,
  };
}
