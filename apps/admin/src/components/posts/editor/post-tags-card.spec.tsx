import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPostTag } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PostTagsCard } from './post-tags-card';

/** Card Tags (spec P4e-4 §4.4): gõ thẳng, Enter để thêm, gợi ý từ tag sẵn có, tối đa 5. */
const g = messages.admin.posts.editor.tags;

function Harness({ initial, options = [] }: { initial: string[]; options?: AdminPostTag[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <PostTagsCard tags={tags} options={options} onChange={setTags} />
      <output data-testid="tags">{tags.join('|')}</output>
    </>
  );
}

const input = () => screen.getByLabelText(g.inputLabel);

describe('PostTagsCard', () => {
  it('Enter thêm tag mới; ô nhập trống lại và giữ tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Food']} />);

    await user.type(input(), 'Street food{Enter}');

    expect(screen.getByTestId('tags')).toHaveTextContent('Food|Street food');
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
  });

  it('gợi ý tag sẵn có chưa gắn bài này; bấm gợi ý thì thêm', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={['Food']}
        options={[
          { slug: 'food', name: 'Food', count: 5 },
          { slug: 'hoi-an', name: 'Hội An', count: 2 },
        ]}
      />,
    );

    expect(screen.queryByRole('button', { name: g.useSuggestion('Food') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: g.useSuggestion('Hội An') }));

    expect(screen.getByTestId('tags')).toHaveTextContent('Food|Hội An');
  });

  it('trùng theo slug: báo ngay dưới ô, không thêm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Hội An']} />);

    await user.type(input(), 'hoi an{Enter}');

    expect(await screen.findByText(g.duplicate('hoi an'))).toBeInTheDocument();
    expect(screen.getByTestId('tags')).toHaveTextContent('Hội An');
  });

  it('đủ 5: thêm nữa thì báo trần; gợi ý ẩn', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={['A1', 'B2', 'C3', 'D4', 'E5']}
        options={[{ slug: 'food', name: 'Food', count: 5 }]}
      />,
    );

    expect(screen.queryByRole('button', { name: g.useSuggestion('Food') })).not.toBeInTheDocument();
    await user.type(input(), 'F6{Enter}');

    expect(await screen.findByText(g.full(5))).toBeInTheDocument();
  });

  it('gỡ tag: tiêu điểm về ô nhập, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Food']} />);

    await user.click(screen.getByRole('button', { name: g.remove('Food') }));

    expect(screen.getByTestId('tags')).toHaveTextContent('');
    expect(input()).toHaveFocus();
  });
});
