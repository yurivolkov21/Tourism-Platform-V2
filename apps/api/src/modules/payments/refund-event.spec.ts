import { Prisma } from '../../generated/prisma/client.js';
import { PaymentProvider } from '../../generated/prisma/enums.js';
import { buildRefundEventRow } from './refund-event.js';

/**
 * Builder THUẦN dựng row `payment_events` cho một khoản hoàn (ADR-0043 §3).
 * Ba chỗ có luật, và cả ba đều là chỗ dễ ghi sai âm thầm:
 * `eventId` lấy id refund của CỔNG (không phải id dòng sổ), hai mốc thời gian
 * bằng ĐÚNG `refunds.created_at` (bất biến nghiệm thu seed so bằng `=`), và
 * tiền trong payload là chuỗi 2 số lẻ chứ không phải Decimal.
 */

const AT = new Date('2026-09-21T03:04:05.000Z');

const admin = {
  provider: PaymentProvider.STRIPE,
  bookingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  refundId: '4f2a1b3c-0000-4000-8000-000000000001',
  providerRefundId: 're_1Pabc123',
  providerPaymentId: 'pi_1Pxyz789',
  amount: new Prisma.Decimal('117.00'),
  currency: 'USD',
  cause: 'admin',
  at: AT,
} as const;

describe('buildRefundEventRow', () => {
  it('dựng đủ row cho khoản hoàn thiện chí của admin', () => {
    expect(buildRefundEventRow(admin)).toEqual({
      provider: PaymentProvider.STRIPE,
      eventId: 're_1Pabc123',
      type: 'payment.refunded',
      payload: {
        source: 'refund-core',
        cause: 'admin',
        refundId: '4f2a1b3c-0000-4000-8000-000000000001',
        providerRefundId: 're_1Pabc123',
        providerPaymentId: 'pi_1Pxyz789',
        amount: '117.00',
        currency: 'USD',
      },
      amount: admin.amount,
      currency: 'USD',
      bookingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      processedAt: AT,
      receivedAt: AT,
    });
  });

  it('eventId là id refund của CỔNG, không phải id dòng sổ', () => {
    // Khoá `@@unique([provider, eventId])` chỉ chống trùng thật khi nó mang id
    // provider: dán id dòng sổ vào đây là để một webhook echo về sau chèn thêm
    // một row nữa cho cùng một khoản hoàn.
    expect(buildRefundEventRow(admin).eventId).toBe(admin.providerRefundId);
  });

  it('hai mốc thời gian bằng đúng mốc dòng sổ, không phải "bây giờ"', () => {
    const row = buildRefundEventRow({ ...admin, at: new Date('2026-01-02T00:00:00.000Z') });
    expect(row.processedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(row.receivedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('tiền trong payload là chuỗi 2 số lẻ, giữ số 0 cuối', () => {
    const row = buildRefundEventRow({ ...admin, amount: new Prisma.Decimal('117.5') });
    expect(row.payload).toMatchObject({ amount: '117.50' });
  });

  it('đường khách tự huỷ và đường tự động ghi đúng nguyên nhân của mình', () => {
    expect(buildRefundEventRow({ ...admin, cause: 'cancel' }).payload).toMatchObject({
      cause: 'cancel',
    });
    expect(
      buildRefundEventRow({
        ...admin,
        provider: PaymentProvider.PAYPAL,
        providerRefundId: 'PAYPALRF-9K2',
        cause: 'auto',
      }),
    ).toMatchObject({
      provider: PaymentProvider.PAYPAL,
      eventId: 'PAYPALRF-9K2',
      payload: { cause: 'auto' },
    });
  });
});
