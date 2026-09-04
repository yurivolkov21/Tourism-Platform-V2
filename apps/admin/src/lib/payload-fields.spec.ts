import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toPayloadFields } from './payload-fields';

/**
 * Chế độ xem "Simple" của khối payload (kit `JsonDrawer`, user chốt 03/09):
 * JSON bất kỳ → danh sách nhãn · giá trị PHẲNG.
 *
 * Phẳng chứ không lồng là quyết định của user: khối lồng thụt vào cũng khó
 * đọc như JSON và không phải ai cũng hiểu. Nên mỗi giá trị lá là MỘT dòng, và
 * đường dẫn tới nó nằm gọn trong nhãn.
 *
 * Hàm thuần, không đụng React — bài toán thật ở đây là đường dẫn và định
 * dạng giá trị, hai thứ mà một test DOM sẽ đo rất vòng vo.
 */
const t = messages.admin.payload;
const EMPTY = messages.admin.bookings.detail.empty;

describe('toPayloadFields', () => {
  it('payload phẳng: mỗi khoá một dòng, nhãn thành chữ người đọc được', () => {
    // Đúng shape thật của `BOOKING_REFUNDED` (`refunds.service.ts`).
    const fields = toPayloadFields({
      bookingId: '1f0a7c92',
      code: 'BK-7QK2M4',
      amount: '418.00',
    });

    expect(fields).toEqual([
      { path: 'bookingId', label: 'Booking id', value: '1f0a7c92', muted: false },
      { path: 'code', label: 'Code', value: 'BK-7QK2M4', muted: false },
      { path: 'amount', label: 'Amount', value: '418.00', muted: false },
    ]);
  });

  it('khoá snake_case và camelCase cùng ra một kiểu chữ', () => {
    const fields = toPayloadFields({
      unsubscribeToken: 'a',
      billing_details: 'b',
      'total-count': 1,
    });

    expect(fields.map((f) => f.label)).toEqual([
      'Unsubscribe token',
      'Billing details',
      'Total count',
    ]);
  });

  it('object lồng bị TRẢI PHẲNG — đường dẫn nằm trong nhãn, không thụt lề', () => {
    const fields = toPayloadFields({
      data: { object: { metadata: { bookingCode: 'BK-7QK2M4' } } },
    });

    expect(fields).toEqual([
      {
        path: 'data.object.metadata.bookingCode',
        label: 'Data › Object › Metadata › Booking code',
        value: 'BK-7QK2M4',
        muted: false,
      },
    ]);
  });

  it('mảng đánh số TỪ 1 — index từ 0 là chữ của lập trình viên', () => {
    const fields = toPayloadFields({ charges: [{ id: 'ch_1' }, { id: 'ch_2' }] });

    expect(fields.map((f) => f.label)).toEqual([
      `Charges › ${t.item(1)} › Id`,
      `Charges › ${t.item(2)} › Id`,
    ]);
    // `path` giữ index THÔ: nó là khoá React, phải ổn định và duy nhất.
    expect(fields.map((f) => f.path)).toEqual(['charges.0.id', 'charges.1.id']);
  });

  it('boolean đọc thành lời, null thành gạch ngang, chuỗi rỗng nói rõ là rỗng', () => {
    const fields = toPayloadFields({ paid: true, livemode: false, reason: null, note: '' });

    expect(fields).toEqual([
      { path: 'paid', label: 'Paid', value: t.yes, muted: false },
      { path: 'livemode', label: 'Livemode', value: t.no, muted: false },
      // `null` = KHÔNG có giá trị; chuỗi rỗng = có khoá, giá trị rỗng. Hai
      // chuyện khác nhau nên hai câu khác nhau.
      { path: 'reason', label: 'Reason', value: EMPTY, muted: true },
      { path: 'note', label: 'Note', value: t.emptyValue, muted: true },
    ]);
  });

  it('số giữ nguyên, kể cả 0 — 0 KHÔNG phải là vắng', () => {
    const fields = toPayloadFields({ amount: 0, attempts: 5 });

    expect(fields.map((f) => [f.value, f.muted])).toEqual([
      ['0', false],
      ['5', false],
    ]);
  });

  it('object/mảng rỗng LỒNG vẫn ra một dòng — khoá tồn tại thì phải thấy', () => {
    const fields = toPayloadFields({ metadata: {}, tags: [] });

    expect(fields).toEqual([
      { path: 'metadata', label: 'Metadata', value: t.emptyValue, muted: true },
      { path: 'tags', label: 'Tags', value: t.emptyValue, muted: true },
    ]);
  });

  it('payload rỗng ở TẦNG NGOÀI trả mảng rỗng — vùng tự nói "không có field"', () => {
    expect(toPayloadFields({})).toEqual([]);
    expect(toPayloadFields([])).toEqual([]);
  });

  it('payload không phải object thì vẫn xem được — một dòng "Value"', () => {
    expect(toPayloadFields('just a string')).toEqual([
      { path: '', label: t.scalar, value: 'just a string', muted: false },
    ]);
    expect(toPayloadFields(null)).toEqual([
      { path: '', label: t.scalar, value: EMPTY, muted: true },
    ]);
  });

  it('KHÔNG bỏ sót field nào của một payload lồng sâu', () => {
    // Bề mặt vận hành mà lọc bớt field là bề mặt nói dối: đếm lá phải khớp.
    const fields = toPayloadFields({
      id: 'evt_1',
      data: {
        object: {
          id: 'pi_1',
          amount: 41800,
          charges: { total_count: 1, data: [{ id: 'ch_1', paid: true }] },
        },
      },
    });

    expect(fields).toHaveLength(6);
    expect(new Set(fields.map((f) => f.path)).size).toBe(6);
  });

  /**
   * Phương án B (user chốt 03/09 sau bản demo): payload payment event là
   * nguyên văn webhook Stripe/PayPal, nên cột trái đang là tên trường của
   * provider. Hai phép vá, cả hai chỉ đụng NHÃN — `path` và tập field giữ
   * nguyên:
   *
   * 1. Cắt khúc BAO BÌ (`data.object` của Stripe, `resource` của PayPal) —
   *    mọi dòng đều mở đầu bằng nó và nó không mang nghĩa nào.
   * 2. Từ điển cho trường provider THẬT SỰ gửi về; trường lạ vẫn rơi êm về
   *    cách đọc bằng máy.
   */
  describe('hints — bao bì và từ điển (phương án B)', () => {
    const HINTS = {
      envelopes: [['data', 'object'], ['resource']],
      labels: {
        // Khoá theo ĐƯỜNG DẪN ĐẦY ĐỦ — phân biệt được hai `id` khác tầng.
        id: 'Event reference',
        'data.object.id': 'Checkout reference',
        // CHỈ khoá theo đường dẫn đầy đủ (vòng vá review polish 2): khoá trần
        // khớp mọi độ sâu làm `resource.id`/`amount.value` mang nhãn sai.
        'data.object.amount_total': 'Amount charged',
        'data.object.payment_intent': 'Payment reference',
      },
    } as const;

    it('cắt bao bì khỏi nhãn nhưng GIỮ nguyên path', () => {
      const [field] = toPayloadFields({ data: { object: { payment_status: 'paid' } } }, HINTS);

      expect(field?.label).toBe('Payment status');
      // `path` là khoá React và là sự thật về vị trí — không được cắt theo.
      expect(field?.path).toBe('data.object.payment_status');
    });

    it('từ điển thắng cách đọc bằng máy, trường lạ vẫn ra bình thường', () => {
      const fields = toPayloadFields(
        { data: { object: { amount_total: 11700, some_new_field: 'x' } } },
        HINTS,
      );

      expect(fields.map((f) => f.label)).toEqual(['Amount charged', 'Some new field']);
    });

    it('khoá theo ĐƯỜNG DẪN thắng khoá theo tên trường — hai `id` khác tầng không trùng nhãn', () => {
      // Không có luật này thì cả `id` sự kiện lẫn `id` phiên checkout đều ra
      // một chữ sau khi cắt bao bì — hai dòng cùng tên, khác giá trị.
      const fields = toPayloadFields({ id: 'evt_1', data: { object: { id: 'cs_1' } } }, HINTS);

      expect(fields.map((f) => f.label)).toEqual(['Event reference', 'Checkout reference']);
      expect(new Set(fields.map((f) => f.label)).size).toBe(2);
    });

    it('bao bì chỉ cắt khi đứng ĐÚNG đầu đường dẫn', () => {
      // `data` lồng bên trong không phải bao bì của webhook.
      const fields = toPayloadFields({ other: { data: { object: { n: 1 } } } }, HINTS);

      expect(fields[0]?.label).toBe('Other › Data › Object › N');
    });

    it('cắt bao bì mà không còn gì thì GIỮ nhãn đầy đủ, không ra dòng trống', () => {
      const fields = toPayloadFields({ data: { object: {} } }, HINTS);

      expect(fields).toEqual([
        { path: 'data.object', label: 'Data › Object', value: t.emptyValue, muted: true },
      ]);
    });

    it('không truyền hints thì hành xử y như cũ — `/outbox` không đổi gì', () => {
      const fields = toPayloadFields({ data: { object: { amount_total: 1 } } });

      expect(fields[0]?.label).toBe('Data › Object › Amount total');
    });
  });

  /**
   * Diễn giải GIÁ TRỊ (user chốt 03/09 sau phương án B). Hai kiểu duy nhất,
   * và cả hai chỉ chạy khi vùng KHAI TƯỜNG MINH trường nào thuộc kiểu nào —
   * không đoán theo tên khoá.
   *
   * Đây là bề mặt TIỀN: đoán sai đơn vị một lần là in ra con số sai trên màn
   * hình đối soát. Nên mọi ca không chắc đều rơi về in thô, và ca chắc thì vẫn
   * GIỮ số thô bên cạnh (`raw`) để người đối soát kiểm được.
   */
  describe('diễn giải giá trị — tiền và thời gian', () => {
    const VALUE_HINTS = {
      envelopes: [['data', 'object']],
      minorUnitAmounts: ['amount_total'],
      unixSeconds: ['created', 'expires_at'],
    } as const;

    it('số tiền đơn vị nhỏ nhất thành tiền thật, GIỮ số thô bên cạnh', () => {
      const [field] = toPayloadFields(
        { data: { object: { amount_total: 11700, currency: 'usd' } } },
        VALUE_HINTS,
      );

      expect(field?.value).toBe('$117.00');
      expect(field?.raw).toBe('11700');
    });

    it('tiền tệ BA chữ số minor (KWD): chia 1000 và in đủ ba chữ số, không làm tròn về hai', () => {
      const field = toPayloadFields(
        { data: { object: { amount_total: 1175, currency: 'kwd' } } },
        { minorUnitAmounts: ['amount_total'] },
      ).find((item) => item.path === 'data.object.amount_total');
      expect(field?.value).toContain('1.175');
      expect(field?.raw).toBe('1175');
    });

    it('tiền tệ KHÔNG có đơn vị nhỏ thì không chia — VND 11700 là 11700 đồng', () => {
      // Cái bẫy đắt nhất của phép đổi này: chia 100 cho VND là sai 100 LẦN.
      // Số chữ số minor đọc từ ICU chứ không từ danh sách chép tay, nên VND
      // (0 chữ số) và KWD (3 chữ số) đều đúng mà không ai phải nuôi bảng.
      const [field] = toPayloadFields(
        { data: { object: { amount_total: 11700, currency: 'vnd' } } },
        VALUE_HINTS,
      );

      expect(field?.value).toContain('11,700');
      expect(field?.raw).toBe('11700');
    });

    it('KHÔNG tìm thấy tiền tệ trong tầm thì để nguyên số thô', () => {
      // Thà hiện `11700` trơ còn hơn đoán một đơn vị tiền.
      const [field] = toPayloadFields({ data: { object: { amount_total: 11700 } } }, VALUE_HINTS);

      expect(field?.value).toBe('11700');
      expect(field?.raw).toBeUndefined();
    });

    it('mã tiền tệ DỊ DẠNG thì để nguyên, không nổ', () => {
      // Đo được: ICU chỉ ném với mã sai HÌNH DẠNG (không đủ 3 chữ cái). Mã ba
      // chữ cái chưa được gán thì nó nhận và mặc định 2 chữ số — xem test kế.
      const [field] = toPayloadFields(
        { data: { object: { amount_total: 11700, currency: 'us' } } },
        VALUE_HINTS,
      );

      expect(field?.value).toBe('11700');
      expect(field?.raw).toBeUndefined();
    });

    it('mã ba chữ cái lạ vẫn đổi theo mặc định 2 chữ số — và số thô ở ngay cạnh', () => {
      // Đây là biên của phép đổi, ghi lại cho rõ chứ không phải để tự hào: ICU
      // không phân biệt được "mã chưa gán" với "mã có thật", nên `zzz` ăn mặc
      // định 2 chữ số của ISO-4217. Chấp nhận được vì (a) provider chỉ gửi mã
      // thật, (b) số thô vẫn nằm bên cạnh để đối soát.
      const [field] = toPayloadFields(
        { data: { object: { amount_total: 11700, currency: 'zzz' } } },
        VALUE_HINTS,
      );

      expect(field?.value).toContain('117.00');
      expect(field?.raw).toBe('11700');
    });

    it('tiền tệ lấy từ tầng GẦN NHẤT bao quanh số tiền', () => {
      const fields = toPayloadFields(
        {
          currency: 'vnd',
          data: { object: { amount_total: 11700, currency: 'usd' } },
        },
        VALUE_HINTS,
      );
      const amount = fields.find((f) => f.raw === '11700');

      // `usd` ở cùng object với số tiền phải thắng `vnd` ở tầng ngoài.
      expect(amount?.value).toBe('$117.00');
    });

    it('giây Unix thành mốc đọc được, GIỮ số thô bên cạnh', () => {
      const fields = toPayloadFields({ created: 1756876800 }, VALUE_HINTS);

      expect(fields[0]?.value).toBe('3 Sep 2025, 05:20 UTC');
      expect(fields[0]?.raw).toBe('1756876800');
    });

    it('trường KHÔNG khai thì không đụng tới, dù tên nghe giống', () => {
      // `create_time` của PayPal đã là chuỗi ISO — diễn giải nó là làm hỏng.
      const fields = toPayloadFields(
        { create_time: '2026-09-03T04:00:00Z', amount: 418 },
        VALUE_HINTS,
      );

      expect(fields.map((f) => f.value)).toEqual(['2026-09-03T04:00:00Z', '418']);
      expect(fields.every((f) => f.raw === undefined)).toBe(true);
    });

    it('giá trị không phải số nguyên hữu hạn thì để nguyên', () => {
      const fields = toPayloadFields(
        { data: { object: { amount_total: '11700', currency: 'usd' } } },
        VALUE_HINTS,
      );

      expect(fields[0]?.value).toBe('11700');
      expect(fields[0]?.raw).toBeUndefined();
    });

    it('không khai hints thì KHÔNG diễn giải gì — `/outbox` giữ nguyên', () => {
      const fields = toPayloadFields({ amount_total: 11700, currency: 'usd', created: 1 });

      expect(fields.map((f) => f.value)).toEqual(['11700', 'usd', '1']);
      expect(fields.every((f) => f.raw === undefined)).toBe(true);
    });
  });
});
