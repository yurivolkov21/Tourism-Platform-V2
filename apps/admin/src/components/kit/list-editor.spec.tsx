import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { type Keyed, newItemKey } from '@/lib/list-editor';
import { ListEditor } from './list-editor';

interface Line extends Keyed {
  text: string;
}

function Harness({
  initial,
  max = 3,
  reorderable,
  labelledRows,
}: {
  initial: string[];
  max?: number;
  reorderable?: boolean;
  labelledRows?: boolean;
}) {
  const [items, setItems] = useState<Line[]>(initial.map((text) => ({ key: newItemKey(), text })));
  return (
    <>
      <ListEditor
        items={items}
        onChange={setItems}
        max={max}
        newItem={() => ({ key: newItemKey(), text: '' })}
        addLabel="Add highlight"
        reorderable={reorderable}
        labelledRows={labelledRows}
        itemName={(index) => `highlight ${index + 1}`}
        renderItem={(item, index) => (
          <input
            aria-label={`Highlight ${index + 1}`}
            value={item.text}
            onChange={(event) =>
              setItems((current) =>
                current.map((line) =>
                  line.key === item.key ? { ...line, text: event.target.value } : line,
                ),
              )
            }
          />
        )}
      />
      <output data-testid="order">{items.map((item) => item.text).join('|')}</output>
    </>
  );
}

describe('ListEditor', () => {
  it('danh sách không có thứ tự (reorderable={false}) thì không có nút lên/xuống', () => {
    // Vòng review F17: điểm đến không có cột thứ tự — nút dời chỉ làm form
    // "có thay đổi", lưu xong thứ tự lại quay về.
    render(<Harness initial={['a', 'b']} reorderable={false} />);

    expect(screen.queryByRole('button', { name: 'Move highlight 1 up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move highlight 1 down' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove highlight 1' })).toBeInTheDocument();
  });

  const actionsOf = (rowName: string) =>
    screen.getByRole('button', { name: `Remove ${rowName}` }).closest('[data-slot="row-actions"]');

  it('dòng mở đầu bằng nhãn (labelledRows): cụm nút hạ xuống ngang ô nhập đầu tiên', () => {
    // Thử tay F17: dòng điểm đến, FAQ, chính sách, chi phí mở đầu bằng nhãn của
    // FormField — cụm nút canh mép trên của dòng thì nằm ngang NHÃN, lệch khỏi ô nhập.
    render(<Harness initial={['a']} labelledRows />);

    expect(actionsOf('highlight 1')).toHaveAttribute('data-align', 'field');
    expect(actionsOf('highlight 1')).toHaveClass('pt-5');
  });

  it('dòng không nhãn (mặc định): cụm nút giữ ở mép trên, vốn đã ngang ô nhập', () => {
    render(<Harness initial={['a']} />);

    expect(actionsOf('highlight 1')).not.toBeNull();
    expect(actionsOf('highlight 1')).not.toHaveAttribute('data-align');
    expect(actionsOf('highlight 1')).not.toHaveClass('pt-5');
  });

  it('dời lên / xuống đổi thứ tự; nút lên của dòng đầu bị khoá nhưng vẫn giữ được tiêu điểm', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak', 'Cave']} />);

    const up = screen.getByRole('button', { name: 'Move highlight 2 up' });
    await user.click(up);

    expect(screen.getByTestId('order').textContent).toBe('Kayak|Sunset|Cave');
    // Cùng nút DOM (dòng giữ key) — giờ là dòng đầu nên khoá, và tiêu điểm KHÔNG rơi về <body>.
    expect(up).toHaveAttribute('aria-disabled', 'true');
    expect(up).toHaveFocus();
  });

  it('dời xuống: tiêu điểm đi theo dòng vừa dời, kể cả khi dòng ấy thành dòng cuối', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak', 'Cave']} />);

    const down = screen.getByRole('button', { name: 'Move highlight 2 down' });
    await user.click(down);

    expect(screen.getByTestId('order').textContent).toBe('Sunset|Cave|Kayak');
    // Dòng Kayak giờ là dòng cuối: nút "xuống" của nó khoá mà vẫn giữ tiêu điểm.
    expect(screen.getByRole('button', { name: 'Move highlight 3 down' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Move highlight 3 down' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('xoá một dòng chuyển tiêu điểm sang nút xoá của dòng thay chỗ nó', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak']} />);

    await user.click(screen.getByRole('button', { name: 'Remove highlight 1' }));

    expect(screen.getByTestId('order').textContent).toBe('Kayak');
    expect(screen.getByRole('button', { name: 'Remove highlight 1' })).toHaveFocus();
  });

  it('thêm dòng đưa tiêu điểm vào ô đầu tiên của dòng mới; đủ trần thì nút thêm khoá và nói trần', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Sunset', 'Kayak']} max={3} />);

    const add = screen.getByRole('button', { name: 'Add highlight' });
    await user.click(add);

    expect(screen.getByRole('textbox', { name: 'Highlight 3' })).toHaveFocus();
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('You can add up to 3.')).toBeInTheDocument();
    await user.click(add);
    expect(screen.getByTestId('order').textContent).toBe('Sunset|Kayak|');
  });
});
