import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_FILTER_VALUE, StatusFilterTabs } from './status-filter-tabs';

/**
 * Bộ lọc trạng thái DÙNG CHUNG của bảng admin (kit P4b, review F3 31/08), nay
 * dựng bằng `ToggleGroup` có pill trượt (`toggle-group-01`, user chốt 01/09).
 *
 * Đổi primitive từ `Tabs` sang `ToggleGroup` kéo theo một cái bẫy KHÔNG có ở
 * bản cũ: toggle group cho phép THẢ mục đang chọn, tức bấm lại chính nó sẽ
 * trả về mảng rỗng. Bộ lọc thì luôn phải có đúng một mục — nên phần lớn spec
 * này canh đúng chỗ đó.
 */
const onSelect = vi.fn();

/** Icon giả — spec chỉ cần biết kit CÓ vẽ nó ra, không quan tâm hình gì. */
function StubIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="stub-icon" {...props} />;
}

const ITEMS = [
  { label: 'All', value: ALL_FILTER_VALUE, icon: StubIcon },
  { label: 'Pending', value: 'PENDING', icon: StubIcon },
  { label: 'Paid', value: 'PAID' },
];

const PROPS = {
  items: ITEMS,
  label: 'Filter by status',
  selectId: 'test-status-selector',
  onSelect,
};

beforeEach(() => {
  onSelect.mockReset();
});

describe('StatusFilterTabs', () => {
  it('mỗi mục một nút, và mục đang lọc là mục được nhấn', () => {
    render(<StatusFilterTabs {...PROPS} value="PENDING" />);

    expect(screen.getByRole('button', { name: 'Pending', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All', pressed: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paid', pressed: false })).toBeInTheDocument();
  });

  it('bấm mục khác thì báo đúng value đó lên vùng', async () => {
    const user = userEvent.setup();
    render(<StatusFilterTabs {...PROPS} value={ALL_FILTER_VALUE} />);

    await user.click(screen.getByRole('button', { name: 'Paid' }));

    expect(onSelect).toHaveBeenCalledWith('PAID');
  });

  it('bấm lại CHÍNH mục đang chọn thì không bỏ lọc — bộ lọc luôn có một mục', async () => {
    // `ToggleGroup` với `multiple=false` vẫn cho THẢ mục đang nhấn, và lúc đó
    // nó trả về mảng RỖNG. Không chặn thì một cú bấm nhầm sẽ đẩy `undefined`
    // lên vùng, vùng dựng href từ đó, và bảng lặng lẽ nhảy về một bộ lọc
    // không ai chọn.
    const user = userEvent.setup();
    render(<StatusFilterTabs {...PROPS} value="PENDING" />);

    await user.click(screen.getByRole('button', { name: 'Pending' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('mục nào khai icon thì vẽ icon, mục không khai vẫn chạy bình thường', () => {
    // Icon là TUỲ CHỌN ở kit (vùng tự cấp), nên bộ nhãn thiếu icon không được
    // làm vỡ gì — `/reviews` từng chạy đúng như thế trước 01/09.
    render(<StatusFilterTabs {...PROPS} value={ALL_FILTER_VALUE} />);

    expect(screen.getAllByTestId('stub-icon')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Paid' })).toBeInTheDocument();
  });

  it('cả cụm có nhãn riêng, không bắt trình đọc màn hình tự đoán', () => {
    render(<StatusFilterTabs {...PROPS} value={ALL_FILTER_VALUE} />);

    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
  });

  it('màn hẹp: Select tương đương cũng báo lên cùng một đường', async () => {
    const user = userEvent.setup();
    render(<StatusFilterTabs {...PROPS} value={ALL_FILTER_VALUE} />);

    // Truy vấn theo ROLE chứ không `getByLabelText`: dải nút mang
    // `aria-label` cùng chuỗi, nên nhãn một mình khớp CẢ HAI. Trên trình
    // duyệt chỉ một cái hiện tại mỗi lúc (`@4xl/main`), nhưng jsdom không áp
    // CSS nên thấy đủ cả hai.
    await user.click(screen.getByRole('combobox', { name: 'Filter by status' }));
    await user.click(await screen.findByRole('option', { name: 'Pending' }));

    expect(onSelect).toHaveBeenCalledWith('PENDING');
  });
});
