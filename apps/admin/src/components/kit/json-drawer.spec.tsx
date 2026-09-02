import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JsonDrawer, JsonDrawerField, JsonDrawerFields, JsonDrawerText } from './json-drawer';

/**
 * Hợp đồng của drawer JSON (kit P4c — nâng từ `OutboxDetailSheet` của F7 khi
 * F8 là consumer thứ hai, spec §2.6): panel trượt phải, tiêu đề + dòng mô tả
 * mono, các field của vùng ở trên, khối JSON thụt lề ở dưới. Kit lo BA trạng
 * thái của khối JSON (đang tải · có dữ liệu · lỗi) vì F8 fetch payload khi mở
 * — F7 thì đưa thẳng dữ liệu đã có.
 */

const PAYLOAD = { code: 'BK-ABCD1234', nested: { n: 1, list: [1, 'a'] } };

function renderDrawer(props: Partial<React.ComponentProps<typeof JsonDrawer>> = {}) {
  const onClose = vi.fn();
  const view = render(
    <JsonDrawer
      open
      onClose={onClose}
      title="Outbox row"
      description="booking-confirmed:uuid"
      jsonLabel="Payload (JSON)"
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

  it('mở: tiêu đề, mô tả, field của vùng, khối chữ và JSON thụt lề 2 khoảng', () => {
    renderDrawer();
    expect(screen.getByText('Outbox row')).toBeInTheDocument();
    expect(screen.getByText('booking-confirmed:uuid')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmation')).toBeInTheDocument();
    expect(screen.getByText('Resend: 401 invalid api key')).toBeInTheDocument();
    // JSON là DỮ LIỆU để soi (spec §2.3): nguyên văn, thụt lề, không map thành form.
    expect(screen.getByTestId('json-drawer-json')).toHaveTextContent(
      JSON.stringify(PAYLOAD, null, 2).replace(/\s+/g, ' '),
    );
    expect(screen.getByTestId('json-drawer-json').textContent).toBe(
      JSON.stringify(PAYLOAD, null, 2),
    );
  });

  it('json = undefined → đang tải: in nhãn chờ, KHÔNG có khối JSON', () => {
    renderDrawer({ json: undefined });
    expect(screen.getByText('Loading payload…')).toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
  });

  it('error → thay khối JSON bằng câu lỗi, không còn nhãn chờ', () => {
    renderDrawer({ json: undefined, error: 'This payment event no longer exists.' });
    expect(screen.getByRole('alert')).toHaveTextContent('This payment event no longer exists.');
    expect(screen.queryByText('Loading payload…')).not.toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
  });

  it('đổi json → khối JSON thụt lề lại theo dữ liệu mới (useMemo khoá theo json)', () => {
    const { rerender, onClose } = renderDrawer();
    rerender(
      <JsonDrawer
        open
        onClose={onClose}
        title="Outbox row"
        description="x"
        jsonLabel="Payload (JSON)"
        json={{ other: true }}
        loadingLabel="Loading payload…"
      />,
    );
    expect(screen.getByTestId('json-drawer-json').textContent).toBe(
      JSON.stringify({ other: true }, null, 2),
    );
  });

  it('nút Close của panel gọi onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
