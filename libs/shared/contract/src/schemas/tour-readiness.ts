import { z } from 'zod';

/**
 * "Tour này đã đủ để bán chưa" (ADR-0047 §4) — THUẦN, dùng ở ba nơi: API chặn
 * `setPublished(true)` và chặn lệnh sửa làm một tour ĐANG BÁN trở nên thiếu;
 * admin in khung readiness và báo trước khi lưu. Một luật, một bản.
 *
 * Bốn điều kiện: có tóm tắt, đúng một điểm đến chính, lịch trình đủ mọi ngày 1..N,
 * và có ảnh bìa (F18, ADR-0048 §8). Cả 29 tour hiện có đều đạt cả bốn (đo 28/09).
 */
export interface TourReadinessInput {
  summary: string | null;
  destinations: readonly { isPrimary: boolean }[];
  durationDays: number;
  /** `dayNumber` của các ngày ĐÃ có hàng — hàng lịch trình luôn có tiêu đề. */
  itineraryDays: readonly number[];
  /** Tour có dòng `media_assets` role `hero` — ảnh đầu danh sách ảnh (ADR-0048 §1). */
  hasCover: boolean;
}

export const TourReadinessSchema = z.object({
  summary: z.boolean(),
  primaryDestination: z.boolean(),
  /** Ngày 1..N chưa có lịch trình, tăng dần. */
  missingDays: z.array(z.int().positive()),
  cover: z.boolean(),
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
  const cover = input.hasCover;
  return {
    summary,
    primaryDestination,
    missingDays,
    cover,
    ready: summary && primaryDestination && missingDays.length === 0 && cover,
  };
}
