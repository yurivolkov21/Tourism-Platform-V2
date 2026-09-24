import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TagLike } from '@/lib/blog';
import { BlogFilterSidebar } from './blog-filter-sidebar';

const NO_COUNTS = { get: () => 0 };

function renderSidebar({
  topics = [],
  places = [],
  selectedTopics = [],
  selectedPlaces = [],
}: {
  topics?: TagLike[];
  places?: TagLike[];
  selectedTopics?: string[];
  selectedPlaces?: string[];
}) {
  const onTogglePlace = vi.fn();
  render(
    <BlogFilterSidebar
      topics={topics}
      places={places}
      topicCounts={NO_COUNTS}
      placeCounts={NO_COUNTS}
      selectedTopics={selectedTopics}
      selectedPlaces={selectedPlaces}
      query=""
      onToggleTopic={vi.fn()}
      onTogglePlace={onTogglePlace}
      onQueryChange={vi.fn()}
      onClearAll={vi.fn()}
      resultCount={0}
    />,
  );
  return { onTogglePlace };
}

// Vòng review F15: ẩn một điểm đến làm tag cùng slug chuyển từ họ Place sang
// Topic. Link cũ `/blog?place=hoi-an` vẫn lọc bài, nhưng chip bị bỏ vì slug
// không còn trong `places` — không chip, không "Clear all": một bộ lọc vô hình.
describe('BlogFilterSidebar — slug đang lọc mà không còn trong họ của nó', () => {
  it('tag vừa đổi họ vẫn có chip, tên lấy từ họ mới, và gỡ được', async () => {
    const user = userEvent.setup();
    // Tên có dấu, khác hẳn slug viết thành chữ ("Hoi An") — nên ca này chỉ xanh
    // khi tên thật sự được tra ở họ Topic.
    const { onTogglePlace } = renderSidebar({
      topics: [{ slug: 'hoi-an', name: 'Hội An' }],
      selectedPlaces: ['hoi-an'],
    });

    await user.click(screen.getByRole('button', { name: 'Remove filter Hội An' }));

    expect(onTogglePlace).toHaveBeenCalledWith('hoi-an');
  });

  it('slug không có ở họ nào vẫn có chip, nhãn là slug viết thành chữ', () => {
    renderSidebar({ selectedPlaces: ['phong-nha'] });

    expect(screen.getByRole('button', { name: 'Remove filter Phong Nha' })).toBeInTheDocument();
  });

  it('còn slug đang lọc thì nút "Clear all" luôn có mặt', () => {
    renderSidebar({ selectedPlaces: ['phong-nha'] });

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });
});
