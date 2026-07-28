import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MockItineraryDay } from '@/mocks/types';
import { ItineraryTimeline } from './itinerary-timeline';

// Ngày 2 có `description: null` — nhánh này tồn tại trong mock thật (test bất
// biến ở mocks.spec.ts canh sẵn) và chỉ kiểm được ở tầng render.
const DAYS: MockItineraryDay[] = [
  { dayNumber: 1, title: 'Hanoi to the bay', description: 'Morning transfer through the delta.' },
  { dayNumber: 2, title: 'Slow morning, late flight', description: null },
];

describe('ItineraryTimeline', () => {
  it('ngày không có mô tả vẫn render, chỉ mất phần mô tả', () => {
    render(<ItineraryTimeline days={DAYS} meetingPoint={null} />);
    expect(screen.getByText('Slow morning, late flight')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('số ngày đọc được thành "Day N", không phải "01" trần', () => {
    render(<ItineraryTimeline days={DAYS} meetingPoint={null} />);
    // Trình đọc màn hình nghe "01" thì không biết đó là số gì — ngày, giờ, hay
    // thứ tự. Nhãn đầy đủ nằm ở sr-only.
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });

  it('điểm hẹn gắn vào Day 1 và chỉ xuất hiện MỘT lần', () => {
    render(<ItineraryTimeline days={DAYS} meetingPoint="Hanoi Opera House — 7:45am" />);
    const meet = screen.getAllByText(/Meet at Hanoi Opera House/);
    expect(meet).toHaveLength(1);
    // Phải nằm trong mục của Day 1, không trôi xuống mục khác.
    const firstItem = screen.getAllByRole('listitem')[0];
    expect(firstItem).toContainElement(meet[0] ?? null);
  });

  it('meetingPoint null thì không render thẻ điểm hẹn nào', () => {
    render(<ItineraryTimeline days={DAYS} meetingPoint={null} />);
    expect(screen.queryByText(/Meet at/)).not.toBeInTheDocument();
  });
});
