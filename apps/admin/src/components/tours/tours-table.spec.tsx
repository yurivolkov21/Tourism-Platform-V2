import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { TourCategoryOption } from '@/lib/api/tours';
import type { ToursQuery } from '@/lib/tours-query';
import type { TourRowVM } from '@/lib/tours-view';
import { ToursTable } from './tours-table';

/**
 * Bảng `/tours` (spec P4e-1 §3-F11) — soi phần RIÊNG của vùng, không soi lại
 * kit: cột "chuyến sắp tới" đọc được kể cả ở số 0, đường sang màn chuyến có ở
 * đúng hai chỗ, và cả hàng KHÔNG phải một cú bấm (nó sẽ nuốt vùng bấm của
 * công tắc).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.tours.list;

const row = (patch: Partial<TourRowVM> = {}): TourRowVM => ({
  id: '7f2a1b3c-0000-4000-8000-000000000001',
  slug: 'hoi-an-lantern-evening',
  title: 'Hoi An Lantern Evening',
  category: 'Day Tours',
  price: '$39.00',
  openDepartureCount: 3,
  countLabel: t.openDepartures(3),
  isPublished: true,
  isFeatured: false,
  heroUrl: null,
  departuresHref: '/tours/hoi-an-lantern-evening/departures',
  departuresLabel: t.manageDepartures('Hoi An Lantern Evening'),
  ...patch,
});

const QUERY: ToursQuery = { page: 1, limit: 20 };
const CATEGORIES: TourCategoryOption[] = [
  { id: 'b0000001-0000-4000-8000-000000000001', name: 'Day Tours', isActive: true },
  // Danh mục đã ẩn vẫn có trong menu — admin phải lọc ra được tour thuộc nó.
  { id: 'b0000001-0000-4000-8000-000000000004', name: 'Trekking & Adventure', isActive: false },
];

function renderTable(rows: TourRowVM[]) {
  return render(
    <ToursTable
      rows={rows}
      query={QUERY}
      categories={CATEGORIES}
      monthOptions={[{ value: '2026-09', label: 'September 2026' }]}
      total={rows.length}
      totalPages={1}
      setPublished={vi.fn()}
    />,
  );
}

describe('ToursTable', () => {
  it('tên tour là link sang màn chuyến, và cột Actions có một link nữa', () => {
    renderTable([row()]);
    expect(screen.getByRole('link', { name: 'Hoi An Lantern Evening' })).toHaveAttribute(
      'href',
      '/tours/hoi-an-lantern-evening/departures',
    );
    expect(
      screen.getByRole('link', { name: t.manageDepartures('Hoi An Lantern Evening') }),
    ).toHaveAttribute('href', '/tours/hoi-an-lantern-evening/departures');
  });

  it('con số chuyến đi kèm một câu nói nó là số GÌ', () => {
    renderTable([row({ openDepartureCount: 3, countLabel: t.openDepartures(3) })]);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(t.openDepartures(3))).toBeInTheDocument();
  });

  it('số 0 vẫn in ra — "không còn chuyến nào" là câu trả lời, không phải ô trống', () => {
    renderTable([row({ openDepartureCount: 0, countLabel: t.openDepartures(0) })]);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(t.openDepartures(0))).toBeInTheDocument();
  });

  it('mỗi hàng có ĐÚNG MỘT công tắc, mang tên riêng của tour', () => {
    renderTable([row()]);
    expect(
      screen.getByRole('switch', {
        name: messages.admin.tours.publish.toggleLabel('Hoi An Lantern Evening'),
      }),
    ).toBeChecked();
  });

  it('tour đang ẩn vẫn có công tắc (để bật lại), chỉ khác trạng thái', () => {
    // Khác `/subscribers`, nơi hàng đã huỷ KHÔNG có nút: ở đây chiều ngược lại
    // là một thao tác hợp lệ và thường xuyên.
    renderTable([row({ isPublished: false })]);
    expect(
      screen.getByRole('switch', {
        name: messages.admin.tours.publish.toggleLabel('Hoi An Lantern Evening'),
      }),
    ).not.toBeChecked();
  });

  it('huy hiệu Featured chỉ hiện ở tour được gắn cờ', () => {
    const { unmount } = renderTable([row({ isFeatured: true })]);
    expect(screen.getByText(t.featured)).toBeInTheDocument();
    unmount();

    renderTable([row({ isFeatured: false })]);
    expect(screen.queryByText(t.featured)).not.toBeInTheDocument();
  });

  it('tour đã có ảnh bìa in đúng URL API trả về', () => {
    const heroUrl = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tours/hoi-an';
    renderTable([row({ heroUrl })]);
    // `alt=""` có chủ đích: tên tour nằm ngay cạnh, một alt lặp lại nó là hai
    // lần đọc cùng một chuỗi.
    const img = document.querySelector('img');
    expect(img).toHaveAttribute('src', heroUrl);
    expect(img).toHaveAttribute('alt', '');
  });

  it('danh sách rỗng nói đúng câu của vùng', () => {
    renderTable([]);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});

describe('ToursTable — menu lọc danh mục', () => {
  it('danh mục đã ẩn có mặt trong menu, KÈM dấu (hidden)', async () => {
    // Lượt thử tay F14 (23/09): menu đã có đủ danh mục ẩn (vòng review F14)
    // nhưng in chúng y hệt danh mục đang bật — admin không biết vì sao một nhóm
    // tour đang bán lại không có chip nào trên web.
    const user = userEvent.setup();
    renderTable([row()]);

    await user.click(screen.getByRole('button', { name: new RegExp(t.categoryLabel) }));

    expect(await screen.findByRole('menuitemradio', { name: 'Day Tours' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: t.categoryHidden('Trekking & Adventure') }),
    ).toBeInTheDocument();
  });
});
