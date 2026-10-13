import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { rescueTarget, useRowFocusRescue } from './row-focus-rescue';

/**
 * Hàng giả của bảng: mỗi hàng có ô chữ và ô hành động. `actions` rỗng là ô trống (hàng không còn
 * nút nào, như chuyến đã huỷ).
 */
interface Row {
  id: string;
  actions: { label: string; disabled?: 'native' | 'aria' }[];
}

function RescueTable({ rows }: { rows: Row[] }) {
  const tableRef = useRef<HTMLTableElement>(null);
  useRowFocusRescue(tableRef);
  return (
    <table ref={tableRef} aria-label="Rows">
      <thead>
        <tr>
          <th>Name</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-row-id={row.id}>
            <td>{row.id}</td>
            <td>
              {row.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={action.disabled === 'native'}
                  aria-disabled={action.disabled === 'aria' ? true : undefined}
                >
                  {action.label}
                </button>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const row = (id: string, ...labels: string[]): Row => ({
  id,
  actions: labels.map((label) => ({ label })),
});

describe('useRowFocusRescue — focus không rơi về <body> khi nút rời bảng (G6 phần còn hở)', () => {
  it('hàng rời bảng: focus sang nút cùng cột của hàng thế chỗ', () => {
    const { rerender } = render(
      <RescueTable
        rows={[row('a', 'Unsubscribe a'), row('b', 'Unsubscribe b'), row('c', 'Unsubscribe c')]}
      />,
    );
    act(() => screen.getByRole('button', { name: 'Unsubscribe b' }).focus());

    rerender(<RescueTable rows={[row('a', 'Unsubscribe a'), row('c', 'Unsubscribe c')]} />);

    expect(screen.getByRole('button', { name: 'Unsubscribe c' })).toHaveFocus();
  });

  it('hàng cuối rời bảng: focus lùi lên hàng ngay trên', () => {
    const { rerender } = render(<RescueTable rows={[row('a', 'Retry a'), row('b', 'Retry b')]} />);
    act(() => screen.getByRole('button', { name: 'Retry b' }).focus());

    rerender(<RescueTable rows={[row('a', 'Retry a')]} />);

    expect(screen.getByRole('button', { name: 'Retry a' })).toHaveFocus();
  });

  it('hàng còn đó nhưng nút đổi: focus ở lại hàng, sang phần tử đầu của cùng ô', () => {
    // Approve xong thì cụm nút thành Unpublish + Reject; Retry xong thì ô chỉ còn View.
    const { rerender } = render(
      <RescueTable rows={[row('a', 'Approve a', 'Reject a'), row('b', 'Approve b', 'Reject b')]} />,
    );
    act(() => screen.getByRole('button', { name: 'Approve a' }).focus());

    rerender(
      <RescueTable
        rows={[row('a', 'Unpublish a', 'Reject a'), row('b', 'Approve b', 'Reject b')]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Unpublish a' })).toHaveFocus();
  });

  it('hàng còn đó mà ô trống hẳn: sang hàng sau, bỏ qua nút `disabled` thật, nhận nút `aria-disabled`', () => {
    // Chuyến vừa huỷ không còn nút nào; hàng kế có nút khoá thật trước một nút khoá-mà-nhận-focus.
    const next: Row = {
      id: 'b',
      actions: [
        { label: 'Reopen b', disabled: 'native' },
        { label: 'Edit b', disabled: 'aria' },
      ],
    };
    const { rerender } = render(<RescueTable rows={[row('a', 'Cancel a'), next]} />);
    act(() => screen.getByRole('button', { name: 'Cancel a' }).focus());

    rerender(<RescueTable rows={[row('a'), next]} />);

    expect(screen.getByRole('button', { name: 'Edit b' })).toHaveFocus();
  });

  it('bảng không còn gì để focus: focus chính bảng, và bảng thôi nhận focus khi focus đi', () => {
    const { rerender } = render(<RescueTable rows={[row('a', 'Unsubscribe a')]} />);
    act(() => screen.getByRole('button', { name: 'Unsubscribe a' }).focus());

    rerender(<RescueTable rows={[]} />);

    const table = screen.getByRole('table', { name: 'Rows' });
    expect(table).toHaveFocus();
    expect(table).toHaveAttribute('tabindex', '-1');
    act(() => table.blur());
    expect(table).not.toHaveAttribute('tabindex');
  });

  it('focus đã tự đi chỗ khác thì không giành về', () => {
    const { rerender } = render(
      <>
        <input aria-label="Search" />
        <RescueTable rows={[row('a', 'Unsubscribe a'), row('b', 'Unsubscribe b')]} />
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Unsubscribe a' }).focus());
    act(() => screen.getByRole('textbox', { name: 'Search' }).focus());

    rerender(
      <>
        <input aria-label="Search" />
        <RescueTable rows={[row('b', 'Unsubscribe b')]} />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });

  it('focus ra vùng trống rồi hàng mới đi: không giành về', () => {
    const { rerender } = render(
      <RescueTable rows={[row('a', 'Unsubscribe a'), row('b', 'Unsubscribe b')]} />,
    );
    act(() => screen.getByRole('button', { name: 'Unsubscribe a' }).focus());
    // Bấm ra vùng trống: focus về <body> trong khi nút vẫn còn trong DOM.
    act(() => screen.getByRole('button', { name: 'Unsubscribe a' }).blur());

    rerender(<RescueTable rows={[row('b', 'Unsubscribe b')]} />);

    expect(document.body).toHaveFocus();
  });

  it('hộp thoại mở từ hàng rồi trả focus về nút: lượt làm mới gỡ nút thì vẫn cứu', () => {
    const { rerender } = render(
      <>
        <button type="button">Dialog submit</button>
        <RescueTable rows={[row('a', 'Unsubscribe a'), row('b', 'Unsubscribe b')]} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Unsubscribe a' });
    act(() => trigger.focus());
    // Focus sang hộp (ngoài bảng) rồi Base UI trả về nút lúc hộp đóng.
    act(() => screen.getByRole('button', { name: 'Dialog submit' }).focus());
    act(() => trigger.focus());

    rerender(
      <>
        <button type="button">Dialog submit</button>
        <RescueTable rows={[row('b', 'Unsubscribe b')]} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Unsubscribe b' })).toHaveFocus();
  });

  it('nút còn sống qua lượt làm mới (G6) thì không đụng tới', () => {
    const { rerender } = render(<RescueTable rows={[row('a', 'Edit a'), row('b', 'Edit b')]} />);
    act(() => screen.getByRole('button', { name: 'Edit a' }).focus());

    rerender(<RescueTable rows={[row('a', 'Edit a'), row('b', 'Edit b'), row('c', 'Edit c')]} />);

    expect(screen.getByRole('button', { name: 'Edit a' })).toHaveFocus();
  });
});

describe('rescueTarget — luật chọn đích, hàm thuần trên DOM', () => {
  function tableOf(rows: Row[]) {
    render(<RescueTable rows={rows} />);
    return screen.getByRole('table', { name: 'Rows' }) as HTMLTableElement;
  }

  it('hàng cũ đã đi và ở cuối bảng: hàng gần nhất phía trên', () => {
    const table = tableOf([row('a', 'A'), row('b'), row('c')]);
    // Hàng `d` từng đứng thứ tư; b và c không có nút nào.
    expect(rescueTarget(table, { rowId: 'd', rowIndex: 3, cellIndex: 1 })).toBe(
      screen.getByRole('button', { name: 'A' }),
    );
  });

  it('chỉ tìm trong ĐÚNG cột đã đứng', () => {
    const table = tableOf([row('a', 'A')]);
    // Cột 0 là ô chữ, không có gì focus được: rơi về chính bảng.
    expect(rescueTarget(table, { rowId: 'x', rowIndex: 0, cellIndex: 0 })).toBe(table);
  });
});
