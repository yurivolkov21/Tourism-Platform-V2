import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CancelDepartureAction, UpdateDepartureAction } from '@/lib/departures-write';
import { withRole } from '@/test/access';
import { type DepartureRowFixture, makeDepartureRow, serverRow, vmAt } from '@/test/departure-row';
import { DepartureRowActions } from './departure-row-actions';

/**
 * Các nút của một hàng bảng chuyến (spec P4e-1 F12, F13, F16). Phần đáng pin
 * là chuyện nút nào HIỆN và ĐƯỢC BẤM:
 *
 *  ① chuyến đã HUỶ không còn nút nào — bản ghi đóng;
 *  ② mở lại sau hạn chót thì nút tắt, chứ không mời bấm để ăn một 409;
 *  ③ hộp xác nhận ĐÓNG nói thẳng thứ KHÔNG xảy ra (khách cũ không được báo,
 *    không ai được hoàn tiền) — đó là câu phân biệt "đóng" với "huỷ";
 *  ④ từ ngày khởi hành chỉ còn Sửa (F16) — hai nút kia nhường chỗ cho ô giữ
 *    chỗ, và ô ấy không phải một nút.
 */
const t = messages.admin.departures;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

/** Chuyến 10/10 → 14/10, hạn chót 03/10. */
const ROW = makeDepartureRow();

const BEFORE_DEADLINE = '2026-10-01';
const AFTER_DEADLINE = '2026-10-04';

function renderActions(
  row: DepartureRowFixture,
  today: string,
  setStatus = vi.fn(async () => ({
    ok: true as const,
    row: serverRow({ ...row, status: 'CLOSED' as const }, today),
  })),
  role?: string,
) {
  const update = vi.fn();
  render(
    <DepartureRowActions
      row={vmAt(row, today)}
      basePriceLabel="$129.00"
      durationDays={5}
      update={update}
      setStatus={setStatus}
      cancel={vi.fn()}
      disabled={false}
      onSettled={vi.fn()}
    />,
    role ? { wrapper: withRole(role) } : undefined,
  );
  return { update, setStatus, dates: vmAt(row, today).dates };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('DepartureRowActions — nút nào được bấm', () => {
  it('chuyến OPEN còn hạn: có Sửa và có Đóng', () => {
    const { dates } = renderActions(ROW, BEFORE_DEADLINE);

    expect(screen.getByRole('button', { name: t.edit.actionLabel(dates) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
  });

  it('chuyến CLOSED còn hạn: nút đổi thành Mở lại và bấm được', () => {
    const { dates } = renderActions({ ...ROW, status: 'CLOSED' }, BEFORE_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.reopenLabel(dates) })).toBeEnabled();
  });

  it('QUÁ HẠN CHÓT: nút Mở lại tắt — server sẽ từ chối, mời bấm là mời ăn lỗi', () => {
    const { dates } = renderActions({ ...ROW, status: 'CLOSED' }, AFTER_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.reopenLabel(dates) })).toBeDisabled();
  });

  it('chuyến đã khởi hành: ô nút huỷ giữ chỗ, nhưng KHÔNG phải một nút', () => {
    // Lượt thử tay F14 (23/09): hàng không huỷ được thì thiếu hẳn nút cuối,
    // cụm nút canh phải nên Sửa và Đóng bị dồn lệch khỏi cột của hàng trên. Ô
    // giữ chỗ vá chuyện bố cục — nhưng nó TUYỆT ĐỐI không được lộ ra như một
    // nút, không thì trình đọc màn hình mời bấm một thứ không tồn tại.
    renderActions(ROW, '2026-10-10');

    expect(
      screen.queryByRole('button', {
        name: t.cancel.actionLabel(vmAt(ROW, '2026-10-10').dates),
      }),
    ).not.toBeInTheDocument();
    // Từ F16 hàng đã khởi hành chỉ còn Sửa — nút đóng/mở cũng nhường chỗ.
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('chuyến ĐÃ HUỶ: KHÔNG có nút nào', () => {
    // Khách của nó đã được hoàn tiền (F13) — mỗi nút ở đây là một cách đi
    // vòng quanh việc ấy.
    renderActions({ ...ROW, status: 'CANCELLED' }, BEFORE_DEADLINE);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('QUÁ HẠN CHÓT mà chưa đi: Close VẪN bấm được — checkout mở trước hạn có thể đang dở', () => {
    const { dates } = renderActions(ROW, AFTER_DEADLINE);

    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.cancel.actionLabel(dates) })).toBeEnabled();
  });

  it.each([
    ['đang chạy', ROW, '2026-10-12'],
    ['đã về', { ...ROW, status: 'CLOSED' as const }, '2026-10-20'],
  ] as const)('chuyến %s: chỉ còn Sửa, không Close cũng không Reopen', (_label, row, today) => {
    const { dates } = renderActions(row, today);

    expect(screen.getByRole('button', { name: t.edit.actionLabel(dates) })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: t.setStatus.closeLabel(dates) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.setStatus.reopenLabel(dates) }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('ô giữ chỗ của nút đóng/mở là một vùng `aria-hidden`, không phải một nút', () => {
    // Giữ cột cho thẳng (lượt thử tay F14) mà không mời trình đọc màn hình bấm
    // một thứ không tồn tại. `getByText` không lọc cây trợ năng, nên nó tìm
    // thấy chữ nằm trong ô giữ chỗ.
    renderActions(ROW, '2026-10-12');

    const placeholder = screen.getByText(t.setStatus.close).closest('[aria-hidden="true"]');
    expect(placeholder?.tagName).toBe('SPAN');
    expect(placeholder?.closest('button')).toBeNull();
  });

  it('Staff (ADR-0052): không nút huỷ chuyến, không cả ô giữ chỗ của nó — Close vẫn còn', () => {
    const { dates } = renderActions(ROW, AFTER_DEADLINE, undefined, 'STAFF');

    expect(
      screen.queryByRole('button', { name: t.cancel.actionLabel(dates) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(t.cancel.action)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) })).toBeEnabled();
  });
});

describe('DepartureRowActions — hộp xác nhận đóng chuyến', () => {
  it('nêu ngữ cảnh hàng, nói thẳng khách cũ KHÔNG bị đụng tới, và chưa bắn gì', async () => {
    const user = userEvent.setup();
    const { dates, setStatus } = renderActions(ROW, BEFORE_DEADLINE);

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));

    expect(await screen.findByText(t.setStatus.dialog.closeTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setStatus.dialog.closeWarning)).toBeInTheDocument();
    // Ba dòng ngữ cảnh: chuyến nào, mấy khách ĐÃ trả, hạn chót ngày nào.
    expect(screen.getByText(dates)).toBeInTheDocument();
    expect(screen.getByText(t.setStatus.rows.paidBookings)).toBeInTheDocument();
    // Không ai đang thanh toán dở → dòng ấy không có mặt, câu cảnh báo cũng vậy.
    expect(screen.queryByText(t.setStatus.rows.pendingBookings)).not.toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('CÒN checkout đang dở: thêm một dòng và một câu — họ sẽ bị hoàn tiền kèm email', async () => {
    // Câu gốc hứa khách "are told nothing", đúng với người ĐÃ trả nhưng sai
    // với người ĐANG trả: claim đòi chuyến còn mở, nên lượt thanh toán về sau
    // khi đóng sẽ bị từ chối rồi hoàn tiền tự động.
    const user = userEvent.setup();
    const { dates } = renderActions(
      { ...ROW, liveBookingCount: 5, pendingBookingCount: 2 },
      BEFORE_DEADLINE,
    );

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));

    expect(await screen.findByText(t.setStatus.rows.pendingBookings)).toBeInTheDocument();
    // Hai câu nằm trong CÙNG một thẻ cảnh báo của kit, nên tìm theo câu đầu
    // rồi soi nội dung — khớp trọn chuỗi sẽ trượt.
    expect(screen.getByText(t.setStatus.dialog.closeWarning, { exact: false })).toHaveTextContent(
      t.setStatus.dialog.closePendingWarning(2),
    );
  });

  it('xác nhận: gửi đúng `CLOSED` và toast đọc trạng thái TỪ RESPONSE', async () => {
    const user = userEvent.setup();
    const { dates, setStatus } = renderActions(ROW, BEFORE_DEADLINE);

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(dates) }));
    await user.click(await screen.findByRole('button', { name: t.setStatus.dialog.closeSubmit }));

    expect(setStatus).toHaveBeenCalledWith({ id: ROW.id, status: 'CLOSED' });
    expect(success).toHaveBeenCalledWith(t.setStatus.toast.closedTitle, {
      description: t.setStatus.toast.closedBody(dates),
    });
  });

  it('hộp GIỮ chiều đã chụp lúc bấm, kể cả khi bảng vẽ lại dưới chân nó', async () => {
    // Admin khác đóng chuyến trong lúc hộp đang mở, bảng refresh. Nếu hộp đọc
    // lại chiều từ hàng mới thì chữ trong hộp đổi thành "Reopen" ngay dưới
    // ngón tay người dùng, và nút xác nhận gửi lệnh ngược với lệnh họ đã chọn
    // — cùng nếp token phiên bản của form sửa: chụp lúc mở, không đọc lại.
    const user = userEvent.setup();
    const setStatus = vi.fn(async () => ({
      ok: true as const,
      row: serverRow({ ...ROW, status: 'CLOSED' as const }, BEFORE_DEADLINE),
    }));
    const props = {
      basePriceLabel: '$129.00',
      durationDays: 5,
      update: vi.fn(),
      setStatus,
      cancel: vi.fn(),
      disabled: false,
      onSettled: vi.fn(),
    };
    const vm = vmAt(ROW, BEFORE_DEADLINE);
    const { rerender } = render(<DepartureRowActions row={vm} {...props} />);

    await user.click(screen.getByRole('button', { name: t.setStatus.closeLabel(vm.dates) }));
    await screen.findByText(t.setStatus.dialog.closeTitle);

    rerender(
      <DepartureRowActions row={vmAt({ ...ROW, status: 'CLOSED' }, BEFORE_DEADLINE)} {...props} />,
    );
    await user.click(screen.getByRole('button', { name: t.setStatus.dialog.closeSubmit }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ id: ROW.id, status: 'CLOSED' }));
  });
});

describe('DepartureRowActions — form sửa mang theo token phiên bản', () => {
  it('gửi kèm `version` CHỤP LÚC MỞ, không phải giá trị mới nhất của hàng', async () => {
    // Token là thứ duy nhất phát hiện được ghi đè mù giữa hai tab: `FOR UPDATE`
    // tuần tự hoá hai lệnh ghi nhưng không biết cái nào cũ, vì payload mang
    // giá trị từ FORM chứ không từ hàng vừa khoá. Đọc lại `row.version` lúc
    // gửi là tự vô hiệu hoá lớp ấy — một `router.refresh()` dưới chân dialog
    // sẽ đẩy token mới vào payload và server thấy hai giá trị bằng nhau.
    const user = userEvent.setup();
    const update = vi.fn(async () => ({ ok: true as const, row: serverRow(ROW, BEFORE_DEADLINE) }));
    const vm = vmAt(ROW, BEFORE_DEADLINE);
    const { rerender } = render(
      <DepartureRowActions
        row={vm}
        basePriceLabel="$129.00"
        durationDays={5}
        update={update}
        setStatus={vi.fn()}
        cancel={vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.dates) }));
    await screen.findByText(t.edit.dialog.title);

    // Bảng được vẽ lại dưới chân dialog đang mở — token của hàng đã đổi.
    rerender(
      <DepartureRowActions
        row={vmAt({ ...ROW, version: '2026-09-21T09:00:00.000Z' }, BEFORE_DEADLINE)}
        basePriceLabel="$129.00"
        durationDays={5}
        update={update}
        setStatus={vi.fn()}
        cancel={vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.edit.dialog.submit }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: ROW.id, version: ROW.version }),
    );
  });
});

describe('DepartureRowActions — huỷ chuyến (F13)', () => {
  const REASON = 'The guide is unavailable';

  /** Chuyến 5 khách, 2 trong số đó đang thanh toán dở. */
  const BUSY = makeDepartureRow({ liveBookingCount: 5, pendingBookingCount: 2 });

  function renderCancellable(row: DepartureRowFixture, cancel = vi.fn()) {
    render(
      <DepartureRowActions
        row={vmAt(row, BEFORE_DEADLINE)}
        basePriceLabel="$129.00"
        durationDays={5}
        update={vi.fn()}
        setStatus={vi.fn()}
        cancel={cancel}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );
    return { cancel, dates: vmAt(row, BEFORE_DEADLINE).dates };
  }

  it('hộp xác nhận in ĐÚNG số khách phải hoàn và số checkout phải huỷ', async () => {
    // Hai con số, không phải một: khách đã trả được hoàn tiền, còn khách đang
    // thanh toán chỉ bị huỷ phiên. Gộp lại là nói sai với người sắp bấm.
    const user = userEvent.setup();
    const { dates } = renderCancellable(BUSY);

    await user.click(screen.getByRole('button', { name: t.cancel.actionLabel(dates) }));

    expect(await screen.findByText(t.cancel.dialog.title)).toBeInTheDocument();
    const toRefund = screen.getByText(t.cancel.rows.toRefund).closest('div');
    expect(toRefund).toHaveTextContent('3');
    const checkouts = screen.getByText(t.cancel.rows.checkouts).closest('div');
    expect(checkouts).toHaveTextContent('2');
  });

  it('ô lý do nói TRƯỚC khi gõ rằng khách đọc nguyên văn (ADR-0041 AMEND 2)', async () => {
    // Trước AMEND 2 lý do là ghi chép nội bộ; giờ khách đọc nó trên trang đơn và trong email báo
    // huỷ, nên admin phải biết điều đó lúc viết, không phải sau khi bấm.
    const user = userEvent.setup();
    const { dates } = renderCancellable(BUSY);

    await user.click(screen.getByRole('button', { name: t.cancel.actionLabel(dates) }));
    const field = await screen.findByLabelText(t.cancel.dialog.noteLabel);

    expect(field.getAttribute('placeholder')).toMatch(/^Travellers read this word for word/);
  });

  it('lý do TRỐNG thì không bắn lệnh nào', async () => {
    // Sổ trắng ở chỗ duy nhất còn lại sáu tháng sau.
    const user = userEvent.setup();
    const { cancel, dates } = renderCancellable(BUSY);

    await user.click(screen.getByRole('button', { name: t.cancel.actionLabel(dates) }));
    await user.click(await screen.findByRole('button', { name: t.cancel.dialog.submit }));

    expect(await screen.findByText(t.cancel.dialog.noteRequired)).toBeInTheDocument();
    // Câu báo nói vì sao phải có lý do: khách đọc nó — không còn "for your team".
    expect(t.cancel.dialog.noteRequired).toMatch(/travellers read it word for word/);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('có lý do thì gửi kèm nguyên văn, và toast đọc ngày từ RESPONSE', async () => {
    const user = userEvent.setup();
    const cancelFn = vi.fn(async () => ({
      ok: true as const,
      row: serverRow({ ...BUSY, status: 'CANCELLED' as const }, BEFORE_DEADLINE),
    }));
    const { dates } = renderCancellable(BUSY, cancelFn);

    await user.click(screen.getByRole('button', { name: t.cancel.actionLabel(dates) }));
    await user.type(await screen.findByLabelText(t.cancel.dialog.noteLabel), REASON);
    await user.click(screen.getByRole('button', { name: t.cancel.dialog.submit }));

    await waitFor(() => expect(cancelFn).toHaveBeenCalledWith({ id: ROW.id, reason: REASON }));
    expect(success).toHaveBeenCalledWith(t.cancel.toast.title, {
      description: t.cancel.toast.body(dates),
    });
  });

  it('chuyến ĐÃ huỷ: không còn nút nào, kể cả nút huỷ', async () => {
    renderCancellable({ ...ROW, status: 'CANCELLED' });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('DepartureRowActions — toast của chuyến một ngày (spec 2026-10-05 §4 #10)', () => {
  /** Chuyến một ngày 10/10 → 10/10 (N = 1, hạn chót 09/10). */
  const ONE_DAY = makeDepartureRow({ endDate: '2026-10-10' });
  const ONE_DAY_DATES = '10 Oct 2026';

  function renderWith(
    row: DepartureRowFixture,
    actions: { update?: UpdateDepartureAction; cancel?: CancelDepartureAction },
  ) {
    const vm = vmAt(row, BEFORE_DEADLINE);
    render(
      <DepartureRowActions
        row={vm}
        basePriceLabel="$129.00"
        durationDays={5}
        update={actions.update ?? vi.fn()}
        setStatus={vi.fn()}
        cancel={actions.cancel ?? vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />,
    );
    return vm.dates;
  }

  it('lệnh sửa trả về chuyến một ngày: toast in MỘT ngày, đọc từ RESPONSE', async () => {
    // Hàng đang hiện là chuyến 5 ngày; server trả về chuyến đã thành một ngày.
    const user = userEvent.setup();
    const update = vi.fn(async () => ({
      ok: true as const,
      row: serverRow(ONE_DAY, BEFORE_DEADLINE),
    }));
    const dates = renderWith(ROW, { update });

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(dates) }));
    await user.click(await screen.findByRole('button', { name: t.edit.dialog.submit }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.edit.toast.title, {
        description: t.edit.toast.body(ONE_DAY_DATES),
      }),
    );
  });

  it('huỷ chuyến một ngày: toast in MỘT ngày', async () => {
    const user = userEvent.setup();
    const cancel = vi.fn(async () => ({
      ok: true as const,
      row: serverRow({ ...ONE_DAY, status: 'CANCELLED' as const }, BEFORE_DEADLINE),
    }));
    const dates = renderWith(ONE_DAY, { cancel });

    await user.click(screen.getByRole('button', { name: t.cancel.actionLabel(dates) }));
    await user.type(await screen.findByLabelText(t.cancel.dialog.noteLabel), 'Storm warning');
    await user.click(screen.getByRole('button', { name: t.cancel.dialog.submit }));

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.cancel.toast.title, {
        description: t.cancel.toast.body(ONE_DAY_DATES),
      }),
    );
  });
});

/**
 * G6: hộp đóng ĐÚNG LÚC bảng đang làm mới — bảng hạ `disabled` xuống mọi nút của hàng trong
 * lúc ấy. Khoá bằng thuộc tính `disabled` thật thì Base UI không trả focus về nút đã mở hộp
 * được, và focus bàn phím rơi về `<body>`. Khuôn của vòng review F15: khoá bằng `aria-disabled`
 * (`focusableWhenDisabled`).
 *
 * jsdom cho focus cả nút mang `disabled` thật (Base UI vẫn gắn `tabindex="0"`, đo 13/10), nên ở
 * đây cặp thuộc tính mới là thứ phân biệt bản lỗi với bản vá; `toHaveFocus` chỉ canh rằng hộp
 * không đẩy focus đi chỗ khác.
 */
describe('DepartureRowActions — focus khi bảng đang làm mới (G6)', () => {
  const dates = vmAt(ROW, BEFORE_DEADLINE).dates;

  function actions(disabled: boolean) {
    return (
      <DepartureRowActions
        row={vmAt(ROW, BEFORE_DEADLINE)}
        basePriceLabel="$129.00"
        durationDays={5}
        update={vi.fn()}
        setStatus={vi.fn()}
        cancel={vi.fn()}
        disabled={disabled}
        onSettled={vi.fn()}
      />
    );
  }

  it.each([
    ['Edit', t.edit.actionLabel(dates)],
    ['Close', t.setStatus.closeLabel(dates)],
    ['Cancel', t.cancel.actionLabel(dates)],
  ])(
    'hộp %s đóng lúc bảng còn làm mới: focus về nút đã mở nó, khoá mà không rơi về body',
    async (_, label) => {
      const user = userEvent.setup();
      const { rerender } = render(actions(false));
      const button = screen.getByRole('button', { name: label });
      await user.click(button);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Bảng bắt đầu kéo dữ liệu tươi trong lúc hộp còn mở: mọi nút của hàng khoá.
      rerender(actions(true));
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toHaveAttribute('disabled');
      await waitFor(() => expect(button).toHaveFocus());

      // Khẳng định "không mở" chỉ có nghĩa khi ĐÃ bấm (bài học 15).
      await user.click(button);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('nút Reopen quá hạn chót vẫn TẮT thật — nó tắt vì luật, không vì bảng đang bận', () => {
    // `focusableWhenDisabled` chỉ dành cho nút khoá TẠM; nút server sẽ từ chối thì không có hộp
    // nào để trả focus về, và ca 'QUÁ HẠN CHÓT' ở trên giữ nó `disabled` thật.
    render(
      <DepartureRowActions
        row={vmAt({ ...ROW, status: 'CLOSED' }, AFTER_DEADLINE)}
        basePriceLabel="$129.00"
        durationDays={5}
        update={vi.fn()}
        setStatus={vi.fn()}
        cancel={vi.fn()}
        disabled
        onSettled={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: t.setStatus.reopenLabel(vmAt(ROW, AFTER_DEADLINE).dates),
      }),
    ).toBeDisabled();
  });

  it('đóng chuyến đã quá hạn chót: nút lật thành Reopen khoá theo luật mà vẫn GIỮ focus', async () => {
    // Hộp trả focus về nút Close; lượt làm mới lật nó thành Reopen, bị khoá vì hạn chót. `disabled`
    // thật lúc ấy đẩy focus về <body> — nút này vừa bắn lệnh nên khoá kiểu `aria-disabled`.
    const user = userEvent.setup();
    const closed = { ...ROW, status: 'CLOSED' as const };
    const setStatus = vi.fn(async () => ({
      ok: true as const,
      row: serverRow(closed, AFTER_DEADLINE),
    }));
    const actionsFor = (row: DepartureRowFixture) => (
      <DepartureRowActions
        row={vmAt(row, AFTER_DEADLINE)}
        basePriceLabel="$129.00"
        durationDays={5}
        update={vi.fn()}
        setStatus={setStatus}
        cancel={vi.fn()}
        disabled={false}
        onSettled={vi.fn()}
      />
    );
    const { rerender } = render(actionsFor(ROW));
    const dates = vmAt(ROW, AFTER_DEADLINE).dates;
    const toggle = screen.getByRole('button', { name: t.setStatus.closeLabel(dates) });

    await user.click(toggle);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t.setStatus.dialog.closeSubmit }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(toggle).toHaveFocus());

    rerender(actionsFor(closed));

    expect(toggle).toHaveAccessibleName(t.setStatus.reopenLabel(dates));
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).not.toHaveAttribute('disabled');
    expect(toggle).toHaveFocus();
  });
});
