import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import {
  DepartureSelectionProvider,
  useDepartureSelection,
} from '@/components/tours/departure-selection';
import type { DepartureVM } from '@/lib/api/tours';
import { DepartureDialog } from './departure-dialog';

/**
 * 12 đợt trải ba tháng (Sep/Oct/Nov 2026) — đủ để canh cả phép nhóm theo tháng
 * lẫn bộ lọc "only open". `n4` (23 Nov) là đợt hết chỗ DUY NHẤT: vừa dùng để
 * canh disabled (test cuối) vừa để canh bộ lọc ẩn "Sold out" (test lọc).
 */
const DEPARTURES: DepartureVM[] = [
  {
    id: 's1',
    startDate: '2026-09-02',
    endDate: '2026-09-05',
    seatsLeft: 6,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 's2',
    startDate: '2026-09-09',
    endDate: '2026-09-12',
    seatsLeft: 9,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 's3',
    startDate: '2026-09-16',
    endDate: '2026-09-19',
    seatsLeft: 2,
    effectivePrice: '329.00',
    compareAtPrice: '379.00',
  },
  {
    id: 's4',
    startDate: '2026-09-23',
    endDate: '2026-09-26',
    seatsLeft: 8,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 's5',
    startDate: '2026-09-30',
    endDate: '2026-10-03',
    seatsLeft: 4,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'o1',
    startDate: '2026-10-07',
    endDate: '2026-10-10',
    seatsLeft: 5,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'o2',
    startDate: '2026-10-14',
    endDate: '2026-10-17',
    seatsLeft: 9,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'o3',
    startDate: '2026-10-21',
    endDate: '2026-10-24',
    seatsLeft: 1,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'n1',
    startDate: '2026-11-02',
    endDate: '2026-11-05',
    seatsLeft: 6,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'n2',
    startDate: '2026-11-09',
    endDate: '2026-11-12',
    seatsLeft: 9,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'n3',
    startDate: '2026-11-16',
    endDate: '2026-11-19',
    seatsLeft: 3,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
  {
    id: 'n4',
    startDate: '2026-11-23',
    endDate: '2026-11-26',
    seatsLeft: 0,
    effectivePrice: '349.00',
    compareAtPrice: null,
  },
];

/** Mở sẵn modal — khuôn từ `tour-media-panel.spec.tsx`, chỉ thêm một bước gọi
    `openAllDates()` qua context ngay khi mount vì `DepartureDialog` không nhận
    prop `open`. Gọi trong `useEffect`, KHÔNG gọi thẳng trong thân component:
    `openAllDates` set state của `DepartureSelectionProvider` — một ancestor
    khác — nên phải đợi qua effect thay vì set state của component khác ngay
    giữa render.
    Deps RỖNG CÓ CHỦ ĐÍCH: `value` của context là một object dựng lại mỗi khi
    BẤT KỲ field nào đổi (kể cả `selectedId`), nên `openAllDates` đổi tham
    chiếu mỗi lần chọn một đợt. Nếu để nó vào deps, effect chạy lại và MỞ LẠI
    modal ngay sau khi test 3 vừa `closeAllDates()` — dính đúng bug này lúc
    viết test, xem báo cáo Task 5. Ở đây chỉ cần mở MỘT LẦN lúc mount. */
function OpenOnMount({ children }: { children: ReactNode }) {
  const { openAllDates } = useDepartureSelection();
  // biome-ignore lint/correctness/useExhaustiveDependencies: cố ý chỉ chạy một lần lúc mount, xem chú thích trên hàm.
  useEffect(() => {
    openAllDates();
  }, []);
  return <>{children}</>;
}

function openWrapper({ children }: { children: ReactNode }) {
  return (
    <DepartureSelectionProvider departures={DEPARTURES}>
      <OpenOnMount>{children}</OpenOnMount>
    </DepartureSelectionProvider>
  );
}

describe('DepartureDialog', () => {
  it('nhóm theo tháng và liệt kê đủ mọi đợt', () => {
    render(<DepartureDialog currency="USD" />, { wrapper: openWrapper });
    expect(screen.getAllByRole('button', { name: /→/ })).toHaveLength(12);
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('lọc "only open" bỏ đợt hết chỗ', async () => {
    const user = userEvent.setup();
    render(<DepartureDialog currency="USD" />, { wrapper: openWrapper });
    // `getAllByLabelText`, KHÔNG `getByLabelText`: Base UI `Checkbox` render
    // MỘT `<span role="checkbox">` thấy được VÀ một `<input>` ẩn cạnh nó, cả
    // hai đều khớp `<label>` bọc ngoài — span khớp qua `aria-labelledby` Base
    // UI tự nối, input khớp qua `.labels` gốc của trình duyệt. Phần tử [0] là
    // span — đúng thứ người dùng thật nhìn thấy và bấm vào.
    await user.click(screen.getAllByLabelText(/seats left/i)[0] as HTMLElement);
    expect(screen.queryByText(/Sold out/)).toBeNull();
  });

  it('chọn một đợt thì đóng modal và cập nhật lựa chọn dùng chung', async () => {
    const user = userEvent.setup();
    render(<DepartureDialog currency="USD" />, { wrapper: openWrapper });
    await user.click(screen.getAllByRole('button', { name: /→/ })[6] as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('đợt hết chỗ không bấm được', () => {
    render(<DepartureDialog currency="USD" />, { wrapper: openWrapper });
    expect(screen.getByRole('button', { name: /23 Nov/ })).toBeDisabled();
  });
});
