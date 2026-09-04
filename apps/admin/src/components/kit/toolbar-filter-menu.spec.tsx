import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_FILTER_VALUE } from './status-filter-tabs';
import { ToolbarFilterMenu, type ToolbarFilterMenuGroup } from './toolbar-filter-menu';

/**
 * Menu lọc DÙNG CHUNG của hàng điều khiển bảng admin, dựng theo khuôn
 * `dropdown-menu-10` của Shadcn Studio (user chốt 03/09). Nâng lên kit ở đợt
 * 2 khi có consumer thứ ba: `/outbox` (loại email), `/payment-events` (type),
 * `/subscribers` (source) — đúng ngưỡng ≥2 của luật kit.
 *
 * Spec canh vào hợp đồng của KIT, không phải của vùng nào: kit lo hình dạng
 * và trạng thái chọn, vùng lo giá trị và URL. Bốn chỗ đáng khoá:
 *
 * 1. Nút hiện GIÁ TRỊ đang lọc (không phải một chữ cố định), nên tên đọc-màn-
 *    hình phải tự mang mục đích vào.
 * 2. `onSelect` nhận chuỗi THÔ — vùng tự giải mã (`fromFreeValue`) hoặc
 *    `safeParse`; kit không được đụng vào.
 * 3. `MenuRadioItem` của Base UI mặc định `closeOnClick = false`, SAI ở đây
 *    vì chọn xong là điều hướng.
 * 4. Icon là TUỲ CHỌN: `/subscribers` lọc theo chuỗi tự do nên có mục không
 *    có icon nào để khai.
 * 5. Mục "tất cả" cũng TUỲ CHỌN: ô tháng của `/reports` luôn có đúng một
 *    tháng, không có trạng thái "mọi tháng" nào để bày.
 */
const onSelect = vi.fn();

function StubIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="item-icon" {...props} />;
}

const ALL_ITEM = { value: ALL_FILTER_VALUE, label: 'All types', icon: StubIcon };

const GROUPS: ToolbarFilterMenuGroup[] = [
  {
    key: 'bookings',
    items: [
      { value: 'v:confirmation', label: 'Booking confirmation', icon: StubIcon },
      { value: 'v:refund', label: 'Booking refunded', icon: StubIcon },
    ],
  },
  // Nhóm thứ hai CỐ Ý không khai icon — ca `/subscribers`.
  { key: 'free', items: [{ value: 'v:footer', label: 'footer' }] },
];

const PROPS = { label: 'Filter by type', allItem: ALL_ITEM, groups: GROUPS, onSelect };

beforeEach(() => {
  onSelect.mockReset();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Filter by type/ }));
  await screen.findByRole('menuitemradio', { name: 'All types' });
}

describe('ToolbarFilterMenu', () => {
  it('nút đọc ra mục ĐANG lọc, và tên đọc-màn-hình mang cả mục đích lẫn giá trị', () => {
    render(<ToolbarFilterMenu {...PROPS} value="v:refund" />);

    const trigger = screen.getByRole('button', { name: /Filter by type/ });
    // Nhãn nhìn thấy nằm TRONG tên đọc-màn-hình (WCAG 2.5.3 Label in Name).
    expect(trigger).toHaveTextContent('Booking refunded');
    expect(trigger).toHaveAccessibleName('Filter by type: Booking refunded');
  });

  it('value không khớp mục nào thì nút rơi về mục "tất cả"', () => {
    // Đây là ca chưa lọc (value = sentinel), và cũng là lưới an toàn khi vùng
    // quên bơm mục tạm cho một giá trị lạ trên URL.
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);

    expect(screen.getByRole('button', { name: /Filter by type/ })).toHaveTextContent('All types');
  });

  it('mở ra có nhãn mục đích, mục "tất cả" và đủ mục của mọi nhóm', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);
    await openMenu(user);

    // Nhãn trong menu KHÔNG lặp chữ trên nút: nút đang nói giá trị, câu này
    // nói việc menu làm.
    expect(screen.getByText('Filter by type')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(4);
    expect(screen.getByRole('menuitemradio', { name: 'footer' })).toBeInTheDocument();
  });

  it('mục đang lọc mang dấu tích — thứ bản registry gốc không có', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} value="v:footer" />);
    await openMenu(user);

    expect(screen.getByRole('menuitemradio', { name: 'footer' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'All types' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('báo lên vùng chuỗi THÔ — kit không giải mã tiền tố hộ ai', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'footer' }));

    expect(onSelect).toHaveBeenCalledWith('v:footer');
  });

  it('chọn xong menu phải ĐÓNG — mặc định của Base UI là để mở', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'Booking confirmation' }));

    expect(screen.queryByRole('menuitemradio', { name: 'Booking confirmation' })).toBeNull();
  });

  it('icon là tuỳ chọn: mục không khai vẫn ra, chỉ mất chỗ đứng đầu dòng', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} value={ALL_FILTER_VALUE} />);
    await openMenu(user);

    // Đếm TRONG menu (`RadioGroup` render ra `role="group"`), không đếm cả
    // trang: nút trigger cũng vẽ icon của mục đang chọn.
    const menu = screen.getByRole('group');
    expect(within(menu).getAllByTestId('item-icon')).toHaveLength(3);
    expect(screen.getByRole('menuitemradio', { name: 'footer' })).toBeInTheDocument();
  });

  it('mục đang lọc không có icon thì nút cũng không có, chứ không mượn icon mục khác', () => {
    render(<ToolbarFilterMenu {...PROPS} value="v:footer" />);

    const trigger = screen.getByRole('button', { name: /Filter by type/ });
    // Mượn icon của mục "tất cả" ở đây sẽ nói dối: nút trông như đang không
    // lọc trong khi bảng đang lọc theo `footer`.
    expect(trigger.querySelector('[data-testid="item-icon"]')).toBeNull();
  });

  it('bỏ mục "tất cả" thì menu chỉ có các nhóm — ca ô tháng của /reports', async () => {
    const user = userEvent.setup();
    render(<ToolbarFilterMenu {...PROPS} allItem={undefined} value="v:refund" />);

    await user.click(screen.getByRole('button', { name: /Filter by type/ }));
    await screen.findByRole('menuitemradio', { name: 'Booking refunded' });

    expect(screen.queryByRole('menuitemradio', { name: 'All types' })).toBeNull();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });

  it('không có mục "tất cả" mà value cũng lạ thì nút in chính value, không im lặng', () => {
    // Lưới cuối: thà hiện `2026-99` trên nút còn hơn hiện một nhãn của mục
    // khác — người dùng phải đọc được thứ đang nằm trên URL.
    render(<ToolbarFilterMenu {...PROPS} allItem={undefined} value="2026-99" />);

    expect(screen.getByRole('button', { name: /Filter by type/ })).toHaveTextContent('2026-99');
  });
});
