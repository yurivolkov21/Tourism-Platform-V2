import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Timeline, TimelineItem } from './timeline';

describe('Timeline (kit)', () => {
  it('không mục nào → in câu empty, không có <ol>', () => {
    render(<Timeline empty="Nothing yet">{[]}</Timeline>);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('có mục → <ol> với từng <li>, giữ nguyên thứ tự nơi gọi đưa vào', () => {
    render(
      <Timeline empty="Nothing yet">
        {['first', 'second'].map((text) => (
          <TimelineItem key={text}>{text}</TimelineItem>
        ))}
      </Timeline>,
    );
    expect(screen.queryByText('Nothing yet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'first',
      'second',
    ]);
  });
});
