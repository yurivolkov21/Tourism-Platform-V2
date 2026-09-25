import type { Destination } from '@tourism/contract';

/**
 * Ba vùng cố định của Home (H1 — bản vẽ 18/09): Bắc · Trung · Nam, LUÔN đủ ba
 * nhóm kể cả khi một vùng chưa có địa danh nào (H4) — rail vẫn phải bấm được.
 * Mỗi địa danh thuộc đúng MỘT vùng (`DestinationSchema.region`); giá trị lạ
 * hoặc `null` bị bỏ qua thay vì rơi vào một nhóm "khác" không có trên rail.
 */
export const HOME_REGIONS = ['Northern Vietnam', 'Central Vietnam', 'Southern Vietnam'] as const;

export type HomeRegion = (typeof HOME_REGIONS)[number];

export interface RegionGroup {
  region: HomeRegion;
  /** Xếp `tourCount` giảm dần (handoff §5). */
  destinations: Destination[];
}

export function groupDestinationsByRegion(destinations: Destination[]): RegionGroup[] {
  return HOME_REGIONS.map((region) => ({
    region,
    destinations: destinations
      .filter((d) => d.region === region)
      .sort((a, b) => b.tourCount - a.tourCount),
  }));
}
