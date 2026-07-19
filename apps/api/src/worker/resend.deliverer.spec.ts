import { EmailType } from '../generated/prisma/enums.js';
import type { HttpPostCall, HttpPostResponse } from '../lib/provider-http.js';
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../modules/newsletter/unsubscribe-token.js';
import { ResendDeliverer, renderEmail } from './resend.deliverer.js';

const OPTS = {
  apiKey: 're_unit_key',
  from: 'Tourism <noreply@tourism.test>',
  frontendUrl: 'https://tourism.test',
};

const BOOKING_PAYLOAD = {
  bookingId: 'b-1',
  code: 'BK-1',
  email: 'buyer@example.com',
  name: 'Alice',
  title: 'Ha Long Bay Cruise',
  amount: '117.00',
  currency: 'USD',
};

function stub(response: HttpPostResponse = { status: 200, body: '{"id":"email-1"}' }) {
  const calls: HttpPostCall[] = [];
  const post = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, ...init });
    return response;
  };
  return { calls, deliverer: new ResendDeliverer(OPTS, post) };
}

describe('renderEmail type → subject mapping', () => {
  const cases: Array<[EmailType, RegExp]> = [
    [EmailType.BOOKING_CONFIRMATION, /Booking BK-1 confirmed/],
    [EmailType.BOOKING_REFUNDED, /Refund issued for booking BK-1/],
    [EmailType.REVIEW_APPROVED, /review/i],
    [EmailType.ENQUIRY_RECEIVED, /enquiry/i],
    [EmailType.ENQUIRY_ADMIN_ALERT, /New enquiry from/],
    [EmailType.CANCELLATION_REQUESTED, /Cancellation request received for booking BK-1/],
    [EmailType.CANCELLATION_APPROVED, /Cancellation approved for booking BK-1/],
    [EmailType.CANCELLATION_DENIED, /Cancellation request denied for booking BK-1/],
    [EmailType.NEWSLETTER_WELCOME, /newsletter/i],
    [EmailType.EMAIL_CHANGED, /email address/i],
  ];

  it.each(cases)('%s has a dedicated subject', (type, expected) => {
    const { subject } = renderEmail(type, BOOKING_PAYLOAD);
    expect(subject).toMatch(expected);
  });

  it('covers every EmailType enum value', () => {
    expect(new Set(cases.map(([type]) => type)).size).toBe(Object.values(EmailType).length);
  });
});

describe('renderEmail payload rendering', () => {
  it('renders name, tour title and money fields into the confirmation html', () => {
    const { html } = renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).toContain('Alice');
    expect(html).toContain('Ha Long Bay Cruise');
    expect(html).toContain('117.00');
    expect(html).toContain('USD');
    expect(html).toContain('BK-1');
  });

  it('renders the refund reason when present', () => {
    const { html } = renderEmail(EmailType.BOOKING_REFUNDED, {
      ...BOOKING_PAYLOAD,
      reason: 'overbooked',
    });
    expect(html).toContain('overbooked');
  });

  it('renders the denial note when present', () => {
    const { html } = renderEmail(EmailType.CANCELLATION_DENIED, {
      ...BOOKING_PAYLOAD,
      note: 'Departure is within 24h',
    });
    expect(html).toContain('Departure is within 24h');
  });

  it('escapes HTML in user-supplied fields', () => {
    const { html } = renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('degrades gracefully on missing optional fields', () => {
    const { subject, html } = renderEmail(EmailType.NEWSLETTER_WELCOME, {
      email: 'x@example.com',
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('ResendDeliverer.deliver', () => {
  it('POSTs the rendered email to the Resend API', async () => {
    const { calls, deliverer } = stub();

    await deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://api.resend.com/emails');
    expect(call?.headers.authorization).toBe(`Bearer ${OPTS.apiKey}`);
    expect(call?.headers['content-type']).toBe('application/json');
    const body = JSON.parse(call?.body ?? '{}');
    expect(body.from).toBe(OPTS.from);
    expect(body.to).toEqual(['buyer@example.com']);
    expect(body.subject).toBe('Booking BK-1 confirmed');
    expect(body.html).toContain('Alice');
  });

  it('propagates an API error so the outbox drain retries', async () => {
    const { deliverer } = stub({
      status: 422,
      body: '{"message":"Invalid `to`"}',
    });
    await expect(
      deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD),
    ).rejects.toThrow(/Resend/);
  });

  it('throws when the payload has no recipient email', async () => {
    const { calls, deliverer } = stub();
    await expect(
      deliverer.deliver(EmailType.BOOKING_CONFIRMATION, { code: 'BK-1' }),
    ).rejects.toThrow(/email/i);
    expect(calls).toHaveLength(0); // never calls the API with a broken payload
  });

  it('gửi tới `to` khi payload có, thay vì `email`', async () => {
    // ENQUIRY_ADMIN_ALERT: `email` là địa chỉ KHÁCH (để admin đọc trong
    // nội dung), người nhận phải là admin. Không tách hai vai trò này thì
    // alert bay về hộp thư khách và không admin nào biết có lead mới.
    const { calls, deliverer } = stub();
    await deliverer.deliver(EmailType.ENQUIRY_ADMIN_ALERT, {
      to: 'admin@tourism.test',
      name: 'Jane',
      email: 'jane@example.com',
      message: 'hi',
      tourTitle: null,
    });

    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.to).toEqual(['admin@tourism.test']);
    expect(body.to).not.toContain('jane@example.com');
    // Email khách vẫn phải hiện trong NỘI DUNG để admin liên hệ lại.
    expect(body.html).toContain('jane@example.com');
  });

  it('vẫn dùng `email` làm người nhận khi payload không có `to`', async () => {
    const { calls, deliverer } = stub();
    await deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.to).toEqual([BOOKING_PAYLOAD.email]);
  });

  it('subject KHÔNG escape HTML nhưng body thì CÓ', () => {
    // Subject là plain text: escape ở đó khiến khách tên O'Brien hiện thành
    // `O&#39;Brien` trong hộp thư admin. Body là HTML nên bắt buộc escape.
    const { subject, html } = renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
      name: "O'Brien & <Sons>",
      email: 'obrien@example.com',
      message: '<script>alert(1)</script>',
      tourTitle: null,
    });

    expect(subject).toBe("New enquiry from O'Brien & <Sons>");
    expect(subject).not.toContain('&#39;');

    // Body: thẻ script phải bị vô hiệu hoá, không lọt nguyên văn.
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&#39;');
  });

  it('cắt CR/LF khỏi subject — chặn header injection', () => {
    // Xuống dòng trong header là đường chèn thêm Bcc/To vào email.
    const { subject } = renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
      name: 'Jane\r\nBcc: attacker@evil.com',
      email: 'jane@example.com',
      message: 'hi',
      tourTitle: null,
    });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe('New enquiry from Jane Bcc: attacker@evil.com');
  });

  // Vá review Task 6 — Khoản 2: "chưa email nào chứa link huỷ đăng ký".
  // NewsletterService.subscribe() sinh sẵn subscriberId + unsubscribeToken
  // lúc enqueue (newsletter.service.ts); deliverer chỉ ghép URL, không tự
  // tính lại token.
  it('email NEWSLETTER_WELCOME chứa link huỷ đăng ký đúng id + token', async () => {
    const { calls, deliverer } = stub();
    const subscriberId = '01920000-0000-7000-8000-0000000000aa';
    const unsubscribeToken = makeUnsubscribeToken(subscriberId, 'welcome-link-test-secret');

    await deliverer.deliver(EmailType.NEWSLETTER_WELCOME, {
      email: 'new.subscriber@example.com',
      subscriberId,
      unsubscribeToken,
    });

    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.html).toContain(subscriberId);
    expect(body.html).toContain(unsubscribeToken);
    expect(body.html).toContain(`${OPTS.frontendUrl}/newsletter/unsubscribe?id=${subscriberId}`);

    // Token trong link vẫn verify được — deliverer không được làm hỏng/escape
    // token khi ghép vào HTML.
    expect(verifyUnsubscribeToken(subscriberId, unsubscribeToken, 'welcome-link-test-secret')).toBe(
      true,
    );
  });

  it('email NEWSLETTER_WELCOME mang header List-Unsubscribe trỏ về đúng URL huỷ đăng ký', async () => {
    // KHÔNG dùng one-click RFC 8058 (List-Unsubscribe-Post): one-click khiến
    // mail client POST thẳng `List-Unsubscribe=One-Click` vào endpoint của
    // ta, không khớp schema JSON {id, token} nên sẽ fail toàn bộ — chỉ dùng
    // List-Unsubscribe trỏ tới trang xác nhận (GET, đọc thuần).
    const { calls, deliverer } = stub();
    const subscriberId = '01920000-0000-7000-8000-0000000000bb';
    const unsubscribeToken = makeUnsubscribeToken(subscriberId, 'welcome-header-test-secret');

    await deliverer.deliver(EmailType.NEWSLETTER_WELCOME, {
      email: 'new.subscriber@example.com',
      subscriberId,
      unsubscribeToken,
    });

    const body = JSON.parse(calls[0]?.body ?? '{}');
    const expectedUrl = `${OPTS.frontendUrl}/newsletter/unsubscribe?id=${subscriberId}&token=${unsubscribeToken}`;
    expect(body.headers?.['List-Unsubscribe']).toBe(`<${expectedUrl}>`);
    expect(body.headers?.['List-Unsubscribe-Post']).toBeUndefined();
  });

  it('email khác NEWSLETTER_WELCOME không bị gắn header List-Unsubscribe', async () => {
    const { calls, deliverer } = stub();
    await deliverer.deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.headers).toBeUndefined();
  });
});
