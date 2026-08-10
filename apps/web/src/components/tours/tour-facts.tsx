import { messages } from '@tourism/i18n';
import {
  BriefcaseIcon,
  HeartIcon,
  type LucideIcon,
  UserIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';
import type { MockTravellerType } from '@/mocks/types';

// Hai khối nhỏ "chuyến này là chuyến gì" — không có trong bảng file của plan
// nhưng spec §6.4 đòi cả hai (`highlights[]` → Why this trip, `suitableFor[]` →
// Good for). Để cùng một file vì chúng trả lời cùng một câu hỏi và đều là danh
// sách phẳng, không có logic.

/**
 * `highlights[]` — chấm vuông, KHÔNG đánh số. Đánh số chỉ dùng ở itinerary, nơi
 * thứ tự thật sự mang nghĩa (ngày 1 rồi ngày 2). Highlights là tập hợp không có
 * thứ tự; số hoá nó là ngụ ý một trình tự không tồn tại.
 */
export function WhyThisTrip({ highlights }: { highlights: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {highlights.map((highlight) => (
        <li key={highlight} className="flex gap-3 text-pretty">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-primary" />
          <span className="max-w-[68ch] text-muted-foreground">{highlight}</span>
        </li>
      ))}
    </ul>
  );
}

const TRAVELLER_ICON: Record<MockTravellerType, LucideIcon> = {
  FAMILY: UsersRoundIcon,
  COUPLE: HeartIcon,
  FRIENDS: UsersIcon,
  SOLO: UserIcon,
  BUSINESS: BriefcaseIcon,
};

/** `suitableFor[]` — hàng chip có icon. Rỗng thì `page.tsx` đã loại section. */
export function GoodFor({ suitableFor }: { suitableFor: MockTravellerType[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {suitableFor.map((type) => {
        const Icon = TRAVELLER_ICON[type];
        return (
          <li
            key={type}
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm text-foreground"
          >
            <Icon className="size-4 shrink-0 text-primary-emphasis" aria-hidden="true" />
            {messages.travellerTypes[type]}
          </li>
        );
      })}
    </ul>
  );
}
