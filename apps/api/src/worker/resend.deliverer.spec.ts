import { EmailType } from '../generated/prisma/enums.js';
import type { HttpPostCall, HttpPostResponse } from '../lib/provider-http.js';
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../modules/newsletter/unsubscribe-token.js';
import { DeliveryHttpError } from './deliverer.js';
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
    [EmailType.BOOKING_CONFIRMATION, /Booking confirmed — BK-1 · Ha Long Bay Cruise/],
    [EmailType.BOOKING_REFUNDED, /Refund on its way — BK-1/],
    [EmailType.REVIEW_APPROVED, /review/i],
    [EmailType.REVIEW_REJECTED, /About your review/],
    [EmailType.ENQUIRY_RECEIVED, /enquiry/i],
    [EmailType.ENQUIRY_ADMIN_ALERT, /New enquiry from/],
    [EmailType.NEWSLETTER_WELCOME, /newsletter/i],
    [EmailType.EMAIL_CHANGED, /email address/i],
    [EmailType.PASSWORD_RESET, /reset your password/i],
    [EmailType.EMAIL_VERIFICATION, /verify your email/i],
    [EmailType.EMAIL_OTP, /verification code/i],
    [EmailType.BOOKING_CANCELLED, /Booking cancelled — BK-1/],
  ];

  it.each(cases)('%s has a dedicated subject', async (type, expected) => {
    const { subject } = await renderEmail(type, BOOKING_PAYLOAD);
    expect(subject).toMatch(expected);
  });

  it('covers every EmailType enum value', () => {
    expect(new Set(cases.map(([type]) => type)).size).toBe(Object.values(EmailType).length);
  });

  // ADR-0025: mọi loại mail đều đi qua EmailLayout — wordmark "nexora" phải
  // có mặt trong HTML của CẢ 13 type (đổi layout mà rơi mất một type sẽ đỏ).
  it.each(cases)('%s render trong layout Nexora chung', async (type) => {
    const { html } = await renderEmail(type, BOOKING_PAYLOAD);
    expect(html).toContain('nex');
    expect(html).toContain('ora');
    expect(html).toMatch(/<!DOCTYPE html/i);
  });

  it('alert nội bộ ENQUIRY_ADMIN_ALERT mang footer nội bộ, không phải câu cho khách', async () => {
    // Mail gửi ADMIN — dòng "why you got this" phải là bản nội bộ.
    const { html } = await renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
      name: 'Jane',
      email: 'jane@example.com',
      message: 'hi',
      tourTitle: null,
    });
    expect(html).toContain('Internal alert for the Nexora team');
    expect(html).not.toContain('receiving this because');
  });

  it('W4 E1 (ADR-0039 §1): ack ENQUIRY_RECEIVED KHÔNG lặp lại message của khách', async () => {
    // Bỏ khối "YOUR MESSAGE": in nguyên message vào email gửi tới địa chỉ
    // người lạ điền là trao cho kẻ lạ một máy gửi thư có nội dung tự chọn.
    // Alert admin (test riêng dưới) VẪN phải mang message.
    const marker = 'NOI-DUNG-KHACH-TU-CHON-abc123';
    const { html, text } = await renderEmail(EmailType.ENQUIRY_RECEIVED, {
      name: 'Jane',
      email: 'jane@example.com',
      message: marker,
      tourTitle: null,
    });
    expect(html).not.toContain(marker);
    expect(text).not.toContain(marker);
  });

  it('W4 E1: alert admin ENQUIRY_ADMIN_ALERT VẪN mang trọn message của khách', async () => {
    const marker = 'NOI-DUNG-CHO-ADMIN-doc-xyz789';
    const { html } = await renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
      name: 'Jane',
      email: 'jane@example.com',
      message: marker,
      tourTitle: null,
    });
    expect(html).toContain(marker);
  });

  it('W4 E3: NEWSLETTER_WELCOME có confirmToken → thư XÁC NHẬN với CTA /newsletter/confirm', async () => {
    const { subject, html } = await renderEmail(
      EmailType.NEWSLETTER_WELCOME,
      {
        email: 'optin@example.com',
        subscriberId: '01920000-0000-7000-8000-000000000009',
        unsubscribeToken: 'v1.unsubscribe.aaaa',
        confirmToken: 'v1.confirm.bbbb',
      },
      'https://www.example.test',
    );
    expect(subject.toLowerCase()).toContain('confirm');
    expect(html).toContain(
      'https://www.example.test/newsletter/confirm?id=01920000-0000-7000-8000-000000000009&amp;token=v1.confirm.bbbb',
    );
  });

  it('W4 E3: NEWSLETTER_WELCOME KHÔNG có confirmToken (row cũ trước W4) → giữ welcome cũ', async () => {
    const { subject } = await renderEmail(EmailType.NEWSLETTER_WELCOME, {
      email: 'legacy@example.com',
      subscriberId: '01920000-0000-7000-8000-000000000008',
      unsubscribeToken: 'deadbeef',
    });
    expect(subject).toBe('Welcome to the Nexora newsletter');
  });

  it('mail gửi khách có dòng "why you got this" ở footer (chuẩn hệ Barebone)', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).toContain('receiving this because of a booking');
  });

  it('renderEmail trả kèm bản text thuần (deliverability, 2 part như Nexora cũ)', async () => {
    const { text } = await renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(text).toContain('BK-1');
    expect(text).not.toContain('<');
  });
});

describe('renderEmail — bác bỏ review (ADR-0031 §6)', () => {
  const REJECTED = { ...BOOKING_PAYLOAD, note: 'Nội dung không nói về chuyến đi.' };

  it('NÓI vì sao, bằng đúng lời người duyệt viết', async () => {
    // Cả điểm của §6 nằm ở đây: một mail "review của bạn không được đăng" mà
    // không nói vì sao là đúng thứ ADR sinh ra để chặn.
    const { html } = await renderEmail(EmailType.REVIEW_REJECTED, REJECTED);

    expect(html).toContain('will not appear on the site');
    expect(html).toContain('Nội dung không nói về chuyến đi.');
  });

  it('thiếu lý do thì BỎ HẲN khối trích dẫn, không để một ô trống có nhãn "vì sao"', async () => {
    const { html } = await renderEmail(EmailType.REVIEW_REJECTED, BOOKING_PAYLOAD);

    expect(html).toContain('will not appear on the site');
    expect(html).not.toContain('WHY');
  });

  it('mở một cửa để hỏi lại — bác bỏ không phải một cánh cửa đóng sập', async () => {
    const { html } = await renderEmail(EmailType.REVIEW_REJECTED, REJECTED);
    expect(html).toContain('take another look');
  });
});

describe('renderEmail — khách tự huỷ (BOOKING_CANCELLED, ADR-0041)', () => {
  // Payload đúng Hợp đồng C của plan 15/09 — lõi huỷ (Task 6) ghi đúng bộ khoá này.
  const REFUNDED = {
    ...BOOKING_PAYLOAD,
    amount: '117.00',
    refunded: true,
    deadline: '2026-10-17',
    initiator: 'customer',
  };
  const NOT_REFUNDED = { ...REFUNDED, amount: '0.00', refunded: false };

  it('trong hạn: in số tiền đã hoàn, nơi tiền về và thời gian tiền về', async () => {
    const { subject, html } = await renderEmail(EmailType.BOOKING_CANCELLED, REFUNDED);

    expect(subject).toBe('Booking cancelled — BK-1');
    expect(html).toContain('Refund issued');
    expect(html).toContain('117.00');
    expect(html).toContain('Original payment method');
    expect(html).toContain('business days');
    // Biến thể đã hoàn không nhắc hạn chót — khách không cần biết luật khi đã được hoàn đủ.
    expect(html).not.toContain('free-cancellation deadline');
  });

  it('quá hạn: KHÔNG in tiền, nói rõ hạn chót đã qua kèm ngày, mở cửa ngoại lệ', async () => {
    const { subject, html } = await renderEmail(
      EmailType.BOOKING_CANCELLED,
      NOT_REFUNDED,
      OPTS.frontendUrl,
    );

    expect(subject).toBe('Booking cancelled — BK-1');
    expect(html).not.toContain('Refund issued');
    expect(html).not.toContain('0.00');
    expect(html).toContain('free-cancellation deadline');
    expect(html).toContain('Oct 17, 2026');
    // Ngoại lệ đi qua đội hỗ trợ (ADR-0041 §5) — mail phải chỉ đường tới chính sách.
    expect(html).toContain('/cancellation-policy');
  });

  it('cờ refunded lệch với số tiền 0 → vẫn là biến thể không hoàn, không loan báo khoản bằng 0', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CANCELLED, {
      ...REFUNDED,
      amount: '0.00',
    });

    expect(html).not.toContain('Refund issued');
    expect(html).not.toContain('0.00');
  });
});

describe('renderEmail payload rendering', () => {
  it('renders name, tour title and money fields into the confirmation html', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).toContain('Alice');
    expect(html).toContain('Ha Long Bay Cruise');
    expect(html).toContain('117.00');
    expect(html).toContain('USD');
    expect(html).toContain('BK-1');
  });

  it('renders the refund reason when present', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_REFUNDED, {
      ...BOOKING_PAYLOAD,
      reason: 'overbooked',
    });
    // Mã nội bộ được dịch sang câu cho khách (vòng vá review 06/09) — không in
    // "Reason: overbooked" thô; mã lạ thì mới in nguyên.
    expect(html).toContain('sold out before your payment was confirmed');
    expect(html).not.toContain('Reason: overbooked');
    const { html: unknownReason } = await renderEmail(EmailType.BOOKING_REFUNDED, {
      ...BOOKING_PAYLOAD,
      reason: 'some-new-cause',
    });
    expect(unknownReason).toContain('some-new-cause');
  });

  it('renders the OTP code to-rõ trong body EMAIL_OTP', async () => {
    const { html } = await renderEmail(EmailType.EMAIL_OTP, {
      email: 'otp@example.com',
      otp: '123456',
    });
    expect(html).toContain('123456');
    expect(html).toMatch(/expires in 10 minutes/i);
  });

  it('escapes HTML in user-supplied fields', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('degrades gracefully on missing optional fields', async () => {
    const { subject, html } = await renderEmail(EmailType.NEWSLETTER_WELCOME, {
      email: 'x@example.com',
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders the reset link in the PASSWORD_RESET html (AUTH-2)', async () => {
    const { html } = await renderEmail(EmailType.PASSWORD_RESET, {
      email: 'x@example.com',
      url: 'https://tourism.test/reset?t=abc',
    });
    expect(html).toContain('https://tourism.test/reset?t=abc');
  });

  it('renders the verify link in the EMAIL_VERIFICATION html (AUTH-2)', async () => {
    const { html } = await renderEmail(EmailType.EMAIL_VERIFICATION, {
      email: 'x@example.com',
      url: 'https://tourism.test/verify?t=abc',
    });
    expect(html).toContain('https://tourism.test/verify?t=abc');
  });
});

/**
 * Mail xác nhận là tờ giấy khách giữ lại. Từ ADR-0041 nó phải mang cả hạn chót
 * huỷ miễn phí — tính tại chỗ từ `startDate`/`endDate` đã có sẵn trong payload,
 * không thêm field mới vào outbox (spec §5.4).
 */
describe('renderEmail — hạn chót huỷ trong mail xác nhận (ADR-0041)', () => {
  const DATED = { ...BOOKING_PAYLOAD, startDate: '2026-10-12', endDate: '2026-10-15' };

  it('chuyến 4 ngày → hạn chót 7 ngày trước ngày đi, kèm giờ Việt Nam', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, DATED);
    expect(html).toContain('Free cancellation until');
    expect(html).toContain('Oct 5, 2026');
    expect(html).toMatch(/11:59 pm Vietnam time/);
  });

  it('chuyến 1 ngày → hạn chót 1 ngày trước, không dùng chung con số với chuyến dài', async () => {
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      startDate: '2026-10-12',
      endDate: '2026-10-12',
    });
    expect(html).toContain('Oct 11, 2026');
  });

  it('payload cũ KHÔNG có ngày chuyến → khuyết một dòng, mail vẫn gửi được', async () => {
    // Dòng outbox ghi trước ADR-0041 vẫn nằm trong hàng đợi; một chuỗi thiếu
    // không được phép giết cả mail.
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD);
    expect(html).not.toContain('Free cancellation until');
    expect(html).toContain('BK-1');
  });

  it('ngày hỏng (ngày về trước ngày đi) → khuyết dòng chứ KHÔNG ném', async () => {
    // `cancellationDeadline` ném RangeError với dòng hỏng; DB chưa có CHECK
    // `end_date >= start_date` nên ca này vào được thật.
    const { html } = await renderEmail(EmailType.BOOKING_CONFIRMATION, {
      ...BOOKING_PAYLOAD,
      startDate: '2026-10-12',
      endDate: '2026-10-09',
    });
    expect(html).not.toContain('Free cancellation until');
    expect(html).toContain('BK-1');
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
    expect(body.subject).toBe('Booking confirmed — BK-1 · Ha Long Bay Cruise');
    expect(body.html).toContain('Alice');
  });

  it('ném DeliveryHttpError MANG status (W4 E5) — drain phân loại 4xx/5xx/429 từ đây', async () => {
    const { deliverer } = stub({
      status: 422,
      body: '{"message":"Invalid `to`"}',
    });
    // Ghim CẢ lớp lỗi lẫn status (vòng vá review W4): bản đầu chỉ assert
    // /Resend/ — deliverer ném Error trần cũng xanh, và khi đó mọi 4xx thành
    // "tạm" ở drain, retry 5 lượt cho một thư sai địa chỉ.
    const err = await deliverer
      .deliver(EmailType.BOOKING_CONFIRMATION, BOOKING_PAYLOAD)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeliveryHttpError);
    expect((err as DeliveryHttpError).status).toBe(422);
    expect((err as Error).message).toMatch(/Resend/);
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

  it('subject KHÔNG escape HTML nhưng body thì CÓ', async () => {
    // Subject là plain text: escape ở đó khiến khách tên O'Brien hiện thành
    // `O&#39;Brien` trong hộp thư admin. Body là HTML nên bắt buộc escape.
    const { subject, html } = await renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
      name: "O'Brien & <Sons>",
      email: 'obrien@example.com',
      message: '<script>alert(1)</script>',
      tourTitle: null,
    });

    expect(subject).toBe("New enquiry from O'Brien & <Sons>");
    expect(subject).not.toMatch(/&#x?27;|&#39;/);

    // Body: thẻ script phải bị vô hiệu hoá, không lọt nguyên văn.
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toMatch(/&#x?27;|&#39;/);
  });

  it('cắt CR/LF khỏi subject — chặn header injection', async () => {
    // Xuống dòng trong header là đường chèn thêm Bcc/To vào email.
    const { subject } = await renderEmail(EmailType.ENQUIRY_ADMIN_ALERT, {
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
