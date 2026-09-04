import { render, screen, waitFor, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentEventLoadResult } from '@/lib/payment-events-detail';
import type { PaymentEventRowVM } from '@/lib/payment-events-view';
import { PaymentEventDetailSheet } from './payment-event-detail-sheet';

/**
 * Drawer chi tiết một payment event (spec P4c §3-F8) — consumer thứ hai của
 * kit `JsonDrawer`, và là consumer đầu tiên PHẢI TẢI payload khi mở (list
 * không mang JSON). Test pin vòng đời tải: gọi loader đúng id đúng một lần
 * mỗi lần mở, hiện nhãn chờ → JSON, lỗi ra câu i18n, đóng thì không gọi.
 */
const t = messages.admin.paymentEvents;

const ROW: PaymentEventRowVM = {
  id: '11111111-1111-4111-8111-111111111111',
  provider: 'STRIPE',
  providerLabel: t.provider.STRIPE,
  eventId: 'evt_1Pabc123',
  type: 'payment.completed',
  typeLabel: t.type['payment.completed'],
  amount: '$117.00',
  bookingCode: 'BK-ABCD1234',
  received: '1 Sep 2026, 10:00 UTC',
  processed: '1 Sep 2026, 10:00 UTC',
};

const PAYLOAD = { id: 'evt_1Pabc123', data: { object: { amount_total: 11700 } } };

/** Loader giả: trả kết quả cho sẵn sau một tick, ghi lại input. */
function loader(result: PaymentEventLoadResult) {
  return vi.fn(async (_input: { id: string }) => result);
}

describe('PaymentEventDetailSheet', () => {
  it('đóng (row null): không render, KHÔNG gọi loader', () => {
    const load = loader({ ok: false, code: 'GENERIC' });
    render(<PaymentEventDetailSheet row={null} onClose={vi.fn()} load={load} />);
    expect(screen.queryByText(t.detail.title)).not.toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it('mở: field từ VM hiện ngay, nhãn chờ trong lúc tải, rồi JSON thụt lề của payload', async () => {
    const load = loader({
      ok: true,
      event: {
        id: ROW.id,
        provider: 'STRIPE',
        eventId: ROW.eventId,
        type: ROW.type,
        amount: '117.00',
        currency: 'USD',
        bookingCode: 'BK-ABCD1234',
        receivedAt: '2026-09-01T10:00:00.000Z',
        processedAt: '2026-09-01T10:00:01.000Z',
        payload: PAYLOAD,
      },
    });
    render(<PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />);

    expect(screen.getByText(t.detail.title)).toBeInTheDocument();
    expect(screen.getByText(t.detail.description(ROW.eventId))).toBeInTheDocument();
    expect(screen.getByText(t.provider.STRIPE)).toBeInTheDocument();
    expect(screen.getByText('$117.00')).toBeInTheDocument();
    // Booking là LINK sang trang chi tiết, không phải chữ trần.
    expect(screen.getByRole('link', { name: 'BK-ABCD1234' })).toHaveAttribute(
      'href',
      '/bookings/BK-ABCD1234',
    );
    expect(screen.getByText(t.detail.loading)).toBeInTheDocument();

    // Mặc định là chế độ Simple (kit đổi 03/09) — payload lồng bị trải phẳng,
    // đường dẫn nằm trong nhãn.
    await waitFor(() => expect(screen.getByTestId('json-drawer-simple')).toBeInTheDocument());
    // Nhãn đi qua từ điển provider (user chốt 03/09, phương án B): tên trường
    // Stripe thành chữ đời thường, và khúc bao bì `data › object` bị cắt.
    const payload = within(screen.getByTestId('json-drawer-simple'));
    expect(payload.getByText(t.detail.payloadFields.id)).toBeInTheDocument();
    expect(payload.getByText('evt_1Pabc123')).toBeInTheDocument();
    expect(
      payload.getByText(t.detail.payloadFields['data.object.amount_total']),
    ).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ id: ROW.id });
  });

  it('loader trả NOT_FOUND → câu lỗi i18n thay khối JSON', async () => {
    const load = loader({ ok: false, code: 'NOT_FOUND' });
    render(<PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t.detail.errors.NOT_FOUND);
    expect(screen.queryByTestId('json-drawer-json')).not.toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-simple')).not.toBeInTheDocument();
  });

  it('hàng chưa xử lý: cột Processed trong drawer là badge "Unprocessed", không phải gạch trống', async () => {
    const load = loader({ ok: false, code: 'GENERIC' });
    render(
      <PaymentEventDetailSheet
        row={{ ...ROW, processed: null, bookingCode: null }}
        onClose={vi.fn()}
        load={load}
      />,
    );
    expect(screen.getByText(t.list.unprocessed)).toBeInTheDocument();
    expect(screen.getByText(t.list.noBooking)).toBeInTheDocument();
    await screen.findByRole('alert');
  });

  it('đổi sang hàng khác → tải lại theo id mới; kết quả của hàng cũ về muộn bị bỏ qua', async () => {
    const detail = (id: string, marker: string): PaymentEventLoadResult => ({
      ok: true,
      event: {
        id,
        provider: 'STRIPE',
        eventId: marker,
        type: 'other',
        amount: null,
        currency: null,
        bookingCode: null,
        receivedAt: '2026-09-01T10:00:00.000Z',
        processedAt: null,
        payload: { marker },
      },
    });
    // Hàng 1 trả CHẬM, hàng 2 trả ngay — panel phải hiện hàng 2, không bị
    // hàng 1 ghi đè khi nó về muộn.
    let releaseFirst: () => void = () => {};
    const first = new Promise<PaymentEventLoadResult>((resolve) => {
      releaseFirst = () => resolve(detail(ROW.id, 'first'));
    });
    const secondId = '22222222-2222-4222-8222-222222222222';
    const load = vi.fn((input: { id: string }) =>
      input.id === ROW.id ? first : Promise.resolve(detail(secondId, 'second')),
    );
    const { rerender } = render(
      <PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />,
    );
    rerender(
      <PaymentEventDetailSheet
        row={{ ...ROW, id: secondId, eventId: 'second' }}
        onClose={vi.fn()}
        load={load}
      />,
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('json-drawer-simple')).getByText('Marker'),
      ).toBeInTheDocument(),
    );
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Kết quả hàng CŨ về muộn không được ghi đè hàng đang mở.
    expect(
      within(screen.getByTestId('json-drawer-simple')).getByText('second'),
    ).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('đổi hàng: frame ĐẦU của hàng mới đã là "đang tải", không lộ JSON của hàng cũ', async () => {
    const load = vi.fn(
      async (input: { id: string }): Promise<PaymentEventLoadResult> => ({
        ok: true,
        event: {
          id: input.id,
          provider: 'STRIPE',
          eventId: input.id,
          type: 'other',
          amount: null,
          currency: null,
          bookingCode: null,
          receivedAt: '2026-09-01T10:00:00.000Z',
          processedAt: null,
          payload: { marker: input.id },
        },
      }),
    );
    const { rerender } = render(
      <PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />,
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('json-drawer-simple')).getByText(ROW.id),
      ).toBeInTheDocument(),
    );
    const secondId = '22222222-2222-4222-8222-222222222222';
    rerender(
      <PaymentEventDetailSheet
        row={{ ...ROW, id: secondId, eventId: 'second' }}
        onClose={vi.fn()}
        load={load}
      />,
    );
    // Đồng bộ ngay sau rerender — effect chưa chạy — đã phải là nhãn chờ.
    expect(screen.getByText(t.detail.loading)).toBeInTheDocument();
    expect(screen.queryByTestId('json-drawer-simple')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByTestId('json-drawer-simple')).getByText(secondId),
      ).toBeInTheDocument(),
    );
  });

  it('loader NÉM (action đứt giữa chừng) → câu lỗi GENERIC, không treo ở "Loading…"', async () => {
    const load = vi.fn(async (_input: { id: string }): Promise<PaymentEventLoadResult> => {
      throw new Error('network');
    });
    render(<PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t.detail.transportErrors.GENERIC);
    expect(screen.queryByText(t.detail.loading)).not.toBeInTheDocument();
  });

  it('nhãn payload đọc được cho người không biết code (user chốt 03/09, phương án B)', async () => {
    const load = loader({
      ok: true,
      event: {
        ...ROW,
        payload: {
          id: 'evt_1Pabc123',
          livemode: false,
          data: { object: { id: 'cs_test_1', amount_total: 11700, payment_intent: 'pi_1' } },
        },
      } as never,
    });
    render(<PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />);

    const payload = within(await screen.findByTestId('json-drawer-simple'));
    const t2 = t.detail.payloadFields;

    // 1. Khúc bao bì `data › object` bị cắt khỏi nhãn.
    expect(payload.queryByText(/Data › Object/)).toBeNull();
    // 2. Trường đã biết gọi bằng tên đời thường.
    expect(payload.getByText(t2['data.object.amount_total'])).toBeInTheDocument();
    expect(payload.getByText(t2['data.object.payment_intent'])).toBeInTheDocument();
    expect(payload.getByText(t2.livemode)).toBeInTheDocument();
    // 3. Hai `id` khác tầng KHÔNG trùng nhãn — nếu trùng thì hai dòng cùng tên
    //    mà khác giá trị, đúng thứ khoá-theo-đường-dẫn sinh ra để chặn.
    expect(payload.getByText(t2.id)).toBeInTheDocument();
    expect(payload.getByText(t2['data.object.id'])).toBeInTheDocument();
    // 4. Không bỏ sót: 5 lá vào, 5 dòng ra.
    expect(payload.getAllByRole('definition')).toHaveLength(5);
  });

  it('tiền và thời gian của webhook đọc được, số thô giữ nguyên bên cạnh', async () => {
    const load = loader({
      ok: true,
      event: {
        ...ROW,
        payload: {
          created: 1756876800,
          data: { object: { amount_total: 11700, currency: 'usd' } },
        },
      } as never,
    });
    render(<PaymentEventDetailSheet row={ROW} onClose={vi.fn()} load={load} />);

    const payload = within(await screen.findByTestId('json-drawer-simple'));

    // `11700` là ĐƠN VỊ NHỎ NHẤT — người không đọc code sẽ hiểu là 11.700.
    expect(payload.getByText('$117.00')).toBeInTheDocument();
    expect(payload.getByText('3 Sep 2025, 05:20 UTC')).toBeInTheDocument();
    // Cả hai đều giữ số gốc để đối soát.
    const raws = payload.getAllByTestId('payload-raw').map((node) => node.textContent);
    expect(raws).toEqual(['1756876800', '11700']);
  });
});
