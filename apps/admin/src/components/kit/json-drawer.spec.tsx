import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { JsonDrawer, JsonDrawerField, JsonDrawerFields, JsonDrawerText } from './json-drawer';

/**
 * Hợp đồng của drawer chi tiết (kit P4c — nâng từ `OutboxDetailSheet` của F7
 * khi F8 là consumer thứ hai, spec §2.6): panel trượt phải, tiêu đề + dòng mô
 * tả mono, các field của vùng ở trên, khối payload ở dưới. Kit lo BA trạng
 * thái của khối payload (đang tải · có dữ liệu · lỗi) vì F8 fetch payload khi
 * mở — F7 thì đưa thẳng dữ liệu đã có.
 *
 * ĐỔI 03/09 (user chốt): vỏ sang `Drawer` khuôn `drawer-02`, và khối payload
 * có HAI chế độ xem. Mặc định là **Simple** — đó là cả lý do tính năng này tồn
 * tại: back-office không phải ai cũng đọc được JSON, nên người không biết mà
 * bấm cũng phải xem được. Ai cần nguyên văn thì đổi sang Developer.
 */
const t = messages.admin.payload;

const PAYLOAD = { code: 'BK-ABCD1234', nested: { n: 1, list: [1, 'a'] } };

function renderDrawer(props: Partial<React.ComponentProps<typeof JsonDrawer>> = {}) {
  const onClose = vi.fn();
  const view = render(
    <JsonDrawer
      open
      onClose={onClose}
      title="Outbox row"
      description="booking-confirmed:uuid"
      jsonLabel="Payload"
      json={PAYLOAD}
      loadingLabel="Loading payload…"
      {...props}
    >
      <JsonDrawerFields>
        <JsonDrawerField label="Type" value="Booking confirmation" />
      </JsonDrawerFields>
      <JsonDrawerText label="Last error" text="Resend: 401 invalid api key" />
    </JsonDrawer>,
  );
  return { ...view, onClose };
}

describe('JsonDrawer', () => {
  it('đóng thì không render gì — bảng giữ MỘT instance, 50 hàng không mount 50 panel', () => {
    renderDrawer({ open: false });
    expect(screen.queryByText('Outbox row')).not.toBeInTheDocument();
  });

  it('mở: tiêu đề, mô tả, field của vùng, khối chữ — và payload ở chế độ Simple', () => {
    renderDrawer();
    expect(screen.getByText('Outbox row')).toBeInTheDocument();
    expect(screen.getByText('booking-confirmed:uuid')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation')).toBeInTheDocument();
    expect(screen.getByText('Resend: 401 invalid api key')).toBeInTheDocument();

    // Mặc định KHÔNG phải JSON: khối nguyên văn chỉ hiện khi đổi sang Developer.
    expect(screen.getByTestId('json-drawer-simple')).toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('BK-ABCD1234')).toBeInTheDocument();
    // Lồng bị trải PHẲNG, đường dẫn nằm trong nhãn (user chốt: không lồng).
    expect(screen.getByText('Nested › N')).toBeInTheDocument();
  });

  it('đổi sang Developer thì hiện JSON nguyên văn, thụt lề 2 khoảng', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole('button', { name: t.developer }));

    // JSON là DỮ LIỆU để soi (spec §2.3): nguyên văn, không map thành form.
    expect(screen.getByTestId('json-drawer-json').textContent).toBe(
      JSON.stringify(PAYLOAD, null, 2),
    );
    expect(screen.queryByTestId('json-drawer-simple')).not.toBeInTheDocument();
  });

  it('bấm lại chính chế độ đang chọn KHÔNG bỏ chọn — luôn phải có một chế độ', async () => {
    const user = userEvent.setup();
    renderDrawer();

    // `ToggleGroup` với `multiple=false` vẫn cho THẢ mục đang nhấn và trả về
    // mảng rỗng — cùng cái bẫy `StatusFilterTabs` đã chặn.
    await user.click(screen.getByRole('button', { name: t.simple }));

    expect(screen.getByTestId('json-drawer-simple')).toBeInTheDocument();
  });

  it('payload rỗng: nói thẳng "không có field", không vẽ danh sách trống', () => {
    renderDrawer({ json: {} });
    expect(screen.getByText(t.none)).toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-simple')).not.toBeInTheDocument();
  });

  it('json = undefined → đang tải: in nhãn chờ, KHÔNG có khối payload nào', () => {
    renderDrawer({ json: undefined });
    expect(screen.getByText('Loading payload…')).toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-simple')).not.toBeInTheDocument();
  });

  it('error → thay khối JSON bằng câu lỗi, không còn nhãn chờ', () => {
    renderDrawer({ json: undefined, error: 'This payment event no longer exists.' });
    expect(screen.getByRole('alert')).toHaveTextContent('This payment event no longer exists.');
    expect(screen.queryByText('Loading payload…')).not.toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
  });

  it('đổi json → khối payload nấu lại theo dữ liệu mới (useMemo khoá theo json)', () => {
    const { rerender, onClose } = renderDrawer();
    rerender(
      <JsonDrawer
        open
        onClose={onClose}
        title="Outbox row"
        description="x"
        jsonLabel="Payload"
        json={{ other: true }}
        loadingLabel="Loading payload…"
      />,
    );
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText(t.yes)).toBeInTheDocument();
  });

  it('nút Close của panel gọi onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(screen.getByRole('button', { name: t.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('giá trị đã diễn giải thì in kèm SỐ THÔ (user chốt 03/09)', () => {
    renderDrawer({
      json: { amount_total: 11700, currency: 'usd' },
      payloadHints: { minorUnitAmounts: ['amount_total'] },
    });

    const payload = screen.getByTestId('json-drawer-simple');
    expect(payload).toHaveTextContent('$117.00');
    // Bề mặt đối soát: không có số gốc bên cạnh là bắt người ta tin phép đổi.
    expect(screen.getByTestId('payload-raw')).toHaveTextContent('11700');
  });

  it('không diễn giải thì KHÔNG có số thô — không rác thêm một cột', () => {
    renderDrawer({ json: { amount_total: 11700, currency: 'usd' } });

    expect(screen.queryByTestId('payload-raw')).toBeNull();
  });
});
