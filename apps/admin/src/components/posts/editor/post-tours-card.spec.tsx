import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { PostTourDraft, PostTourOption } from '@/lib/post-form';
import { TOUR_A, TOUR_B } from '@/test/post-detail';
import { PostToursCard } from './post-tours-card';

/** Card Related tours (spec P4e-4 §4.4): tối đa 3, có thứ tự, thêm bằng ô tìm. */
const r = messages.admin.posts.editor.tours;
const l = messages.admin.listEditor;

const HUE: PostTourOption = {
  id: '7a1b2c3d-0000-4000-8000-0000000000e3',
  slug: 'hue-citadel',
  title: 'Hue Citadel',
  isPublished: true,
};
const OPTIONS: PostTourOption[] = [TOUR_A, TOUR_B, HUE];

function Harness({
  initial,
  serverError = null,
}: {
  initial: PostTourOption[];
  serverError?: string | null;
}) {
  const [tours, setTours] = useState<PostTourDraft[]>(
    initial.map((tour) => ({ key: tour.id, ...tour })),
  );
  return (
    <>
      <PostToursCard
        tours={tours}
        options={OPTIONS}
        serverError={serverError}
        onChange={setTours}
      />
      <output data-testid="tours">{tours.map((tour) => tour.slug).join('|')}</output>
    </>
  );
}

const search = () => screen.getByLabelText(r.searchLabel);

describe('PostToursCard', () => {
  it('gõ tìm: bấm một tour thì thêm vào cuối, ô tìm trống lại và giữ tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A]} />);

    await user.type(search(), 'hue');
    await user.click(screen.getByRole('button', { name: r.add('Hue Citadel') }));

    expect(screen.getByTestId('tours')).toHaveTextContent('hoi-an-food-walk|hue-citadel');
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
  });

  it('không khớp tour nào: nói ra', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    await user.type(search(), 'zzz');

    expect(screen.getByText(r.noMatch)).toBeInTheDocument();
  });

  it('tour đang tắt bán: nhãn Off sale và câu nhắc web không hiện nó', () => {
    render(<Harness initial={[TOUR_B]} />);
    expect(screen.getByText(r.offSale)).toBeInTheDocument();
    expect(screen.getByText(r.offSaleNote)).toBeInTheDocument();
  });

  it('đủ 3: ô tìm chỉ còn đọc và nói trần, không gợi ý thêm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A, TOUR_B, HUE]} />);

    expect(search()).toHaveAttribute('readonly');
    expect(screen.getByText(r.full(3))).toBeInTheDocument();
    await user.type(search(), 'h');
    expect(screen.queryByRole('button', { name: r.add('Hue Citadel') })).not.toBeInTheDocument();
  });

  it('xuống một bậc đổi thứ tự — thứ tự là thứ tự web hiện', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A, TOUR_B]} />);

    await user.click(screen.getByRole('button', { name: l.moveDown(r.itemName(1)) }));

    expect(screen.getByTestId('tours')).toHaveTextContent('my-son-sunrise|hoi-an-food-walk');
  });

  it('gỡ dòng cuối cùng: tiêu điểm về ô tìm, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[TOUR_A]} />);

    await user.click(screen.getByRole('button', { name: l.remove(r.itemName(1)) }));

    expect(screen.getByTestId('tours')).toHaveTextContent('');
    await waitFor(() => expect(search()).toHaveFocus());
  });

  it('lỗi lần lưu trước (RELATED_TOUR_NOT_FOUND) hiện tại card', () => {
    render(<Harness initial={[TOUR_A]} serverError="A tour you picked no longer exists." />);
    expect(screen.getByRole('alert')).toHaveTextContent('A tour you picked no longer exists.');
  });
});
