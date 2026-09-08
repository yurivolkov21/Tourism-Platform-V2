import type { Prisma } from '../../generated/prisma/client.js';

/**
 * MỘT định nghĩa "subscriber còn được gửi bản tin" (ADR-0039 §2, vòng vá
 * review W4): consent hai bước đã xác nhận (`confirmedAt` khác null) VÀ chưa
 * rút (`unsubscribedAt` null). Mọi đợt gửi hàng loạt tương lai lọc bằng
 * predicate này — không ai được tự ghép hai cột lại theo cách riêng (bản
 * đầu của `confirmSubscription` chỉ nhìn `confirmedAt` nên sinh được row
 * "đã xác nhận × đã huỷ", một tập mà campaign lọc `confirmedAt` sẽ gửi tới
 * người đã rút).
 *
 * Thư XÁC NHẬN (NEWSLETTER_WELCOME) cố ý KHÔNG dùng predicate này — nó là thư
 * đi xin consent nên gửi tới row chưa xác nhận là đúng; nó chỉ tránh row đã
 * huỷ (xem `OutboxService`).
 */
export const MAILABLE_SUBSCRIBER_WHERE = {
  unsubscribedAt: null,
  confirmedAt: { not: null },
} as const satisfies Prisma.SubscriberWhereInput;

/** Bản thuần của {@link MAILABLE_SUBSCRIBER_WHERE} cho row đã đọc lên. */
export function isMailableSubscriber(subscriber: {
  unsubscribedAt: Date | null;
  confirmedAt: Date | null;
}): boolean {
  return subscriber.unsubscribedAt === null && subscriber.confirmedAt !== null;
}
