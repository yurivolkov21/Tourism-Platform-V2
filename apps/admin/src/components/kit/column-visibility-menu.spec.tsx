import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { ColumnVisibilityMenu } from './data-table-body';
import { serverTableFeatures } from './table-features';

/**
 * Menu Columns dùng chung của ba bảng admin, dựng theo khuôn
 * `dropdown-menu-12` (user chốt 01/09): icon trái · nhãn · dấu tích phải.
 *
 * Spec canh vào chỗ ghép: bản registry là menu THƯỜNG, checkbox là phần thêm
 * vào — nên thứ đáng khoá là hai nửa đó còn sống chung được (bấm vẫn ẩn/hiện
 * được cột, icon không nuốt mất nhãn, cột không khai icon vẫn ra).
 */
type Row = { code: string; tourTitle: string; amount: number };

const helper = createColumnHelper<typeof serverTableFeatures, Row>();

const columns = helper.columns([
  // Cột không ẩn được — phải VẮNG MẶT trong menu.
  helper.accessor('code', { header: 'Code', enableHiding: false }),
  helper.accessor('tourTitle', { header: 'Tour' }),
  helper.accessor('amount', { header: 'Amount' }),
]);

const LABELS = { tourTitle: 'Tour', amount: 'Amount' };

function StubIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="col-icon" {...props} />;
}

/** Chỉ `tourTitle` khai icon — để kiểm luôn ca cột KHÔNG có icon. */
const ICONS = { tourTitle: StubIcon };

function Harness() {
  // Cùng cách nối như ba bảng thật: `columnVisibilityFeature` chỉ mọc ra
  // `getCanHide`/`toggleVisibility` khi state VÀ handler đều được truyền.
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    columns,
    data: [{ code: 'NX-1', tourTitle: 'Ha Long', amount: 100 }],
    state: { columnVisibility },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return <ColumnVisibilityMenu table={table} labels={LABELS} icons={ICONS} />;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(messages.admin.table.columns) }));
}

describe('ColumnVisibilityMenu', () => {
  it('mở ra thấy tiêu đề nhóm và một checkbox cho mỗi cột ẩn được', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    expect(await screen.findByText(messages.admin.table.columnsMenuLabel)).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /Tour/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /Amount/ })).toBeInTheDocument();
  });

  it('cột KHÔNG ẩn được thì không vào menu — đừng mời bấm một nút không làm gì', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    await screen.findByText(messages.admin.table.columnsMenuLabel);
    expect(screen.queryByRole('menuitemcheckbox', { name: /Code/ })).not.toBeInTheDocument();
  });

  it('icon chỉ mọc ở cột có khai, cột không khai vẫn ra bình thường', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    await screen.findByText(messages.admin.table.columnsMenuLabel);
    // Icon là TUỲ CHỌN: một cột khai thì đúng một icon, và cột kia vẫn còn đó.
    expect(screen.getAllByTestId('col-icon')).toHaveLength(1);
    expect(screen.getByRole('menuitemcheckbox', { name: /Amount/ })).toBeInTheDocument();
  });

  it('bấm một mục thì ẩn cột đó thật — checkbox không phải đồ trang trí', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    const item = await screen.findByRole('menuitemcheckbox', { name: /Tour/ });
    expect(item).toHaveAttribute('aria-checked', 'true');

    // Checkbox item KHÔNG đóng menu sau mỗi cú bấm (khác menu item thường) —
    // đó là điều đúng ở đây: ẩn/hiện cột thường làm vài cái một lượt.
    await user.click(item);

    expect(screen.getByRole('menuitemcheckbox', { name: /Tour/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    // …và menu còn mở để bấm tiếp cái nữa.
    expect(screen.getByText(messages.admin.table.columnsMenuLabel)).toBeInTheDocument();
  });
});
