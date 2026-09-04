import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';

/**
 * JSON bất kỳ → danh sách nhãn · giá trị PHẲNG, cho chế độ xem "Simple" của
 * khối payload trong drawer chi tiết (kit `JsonDrawer`, user chốt 03/09).
 *
 * Vì sao có chế độ này: back-office không phải ai cũng đọc được JSON, và một
 * bức tường dấu ngoặc là thứ khiến người ta không dám mở drawer ra xem.
 *
 * Vì sao PHẲNG chứ không lồng (user chốt): khối lồng thụt vào cũng khó đọc y
 * như JSON — nó vẫn bắt người đọc dựng lại cây trong đầu. Ở đây mỗi giá trị lá
 * là ĐÚNG một dòng, và đường dẫn tới nó nằm gọn trong nhãn
 * ("Data › Object › Metadata › Booking code").
 *
 * Hai luật không được vi phạm:
 *
 * 1. **Không bỏ sót.** Payload payment event là webhook thật của Stripe/PayPal;
 *    một bề mặt vận hành mà lọc bớt field là bề mặt nói dối. Hàm này chỉ đổi
 *    CÁCH TRÌNH BÀY — mọi lá đều ra một dòng, kể cả object rỗng lồng bên trong.
 * 2. **Nhãn sinh bằng máy là MẶC ĐỊNH.** Thêm một loại email mới với khoá
 *    payload mới là nó tự chạy; không ai phải nhớ cập nhật bảng tra, và không
 *    có khoá nào rơi ra thành chữ thô vì bị quên. Vùng nào có lý do riêng thì
 *    ĐÈ bằng `PayloadHints` — xem JSDoc của nó.
 */
const t = messages.admin.payload;

/** Giá trị VẮNG — dùng chung dấu gạch của admin, không tự chế ký tự khác. */
const ABSENT = messages.admin.bookings.detail.empty;

/**
 * Phần vá NHÃN của một vùng (phương án B, user chốt 03/09 sau bản demo). Chỉ
 * đụng chữ hiển thị — `path` và TẬP field không đổi, nên luật "không bỏ sót"
 * ở trên vẫn nguyên vẹn.
 *
 * Chỉ `/payment-events` dùng: payload của nó là nguyên văn webhook
 * Stripe/PayPal, tức tên trường do NGƯỜI KHÁC đặt và ta không sở hữu. Một từ
 * điển ở đó không mục theo tính năng của mình — khác hẳn từ điển cho payload
 * của chính ta, thứ đã cố ý không làm (xem luật 2 bên trên).
 */
export interface PayloadHints {
  /**
   * Tiền tố đường dẫn cắt khỏi NHÃN: vỏ bọc của webhook (`data.object` bên
   * Stripe, `resource` bên PayPal) đứng đầu mọi dòng mà không mang nghĩa nào.
   * Chỉ cắt khi khớp ĐÚNG từ đầu đường dẫn.
   */
  envelopes?: ReadonlyArray<readonly string[]>;
  /**
   * Tên đời thường cho trường đã biết. Khoá tra theo HAI cách, đường dẫn đầy
   * đủ trước (`data.object.id`) rồi mới tới tên trường trần (`amount_total`) —
   * cần cả hai vì sau khi cắt bao bì thì `id` của sự kiện và `id` của phiên
   * checkout sẽ đọc ra cùng một chữ.
   */
  labels?: Readonly<Record<string, string>>;
  /**
   * Trường mang số tiền ở ĐƠN VỊ NHỎ NHẤT của provider (Stripe gửi
   * `amount_total: 11700` cho 117,00 USD). Khai theo tên trường hoặc đường dẫn
   * đầy đủ, giống `labels`.
   *
   * Khai TƯỜNG MINH chứ không đoán theo tên: `resource.purchase_units.0.amount.value`
   * của PayPal đã là chuỗi decimal sẵn — "đổi" nó là làm hỏng.
   */
  minorUnitAmounts?: readonly string[];
  /** Trường mang mốc thời gian dạng GIÂY Unix (Stripe `created`, `expires_at`). */
  unixSeconds?: readonly string[];
}

export interface PayloadField {
  /**
   * Đường dẫn THÔ (`charges.0.id`) — khoá React, phải duy nhất và ổn định.
   * Giữ index từ 0 vì đây là định danh máy, không phải chữ cho người đọc.
   */
  path: string;
  /** Nhãn người đọc được, đã gồm cả đường dẫn. */
  label: string;
  value: string;
  /** Giá trị vắng hoặc rỗng — vùng tô nhạt để mắt lướt qua được. */
  muted: boolean;
  /**
   * Giá trị THÔ, chỉ có khi `value` đã được diễn giải. Vùng in nhạt bên cạnh:
   * đây là bề mặt đối soát, người đọc phải kiểm được con số gốc mà provider
   * gửi. Vắng = `value` chính là thứ có trong payload.
   */
  raw?: string;
}

/**
 * `bookingId` → "Booking id" · `billing_details` → "Billing details".
 *
 * Cố ý KHÔNG có danh sách viết-hoa-đặc-biệt (ID/URL/OTP): một từ điển như thế
 * là thứ phải nhớ cập nhật, và quên là chữ lệch. "Booking id" đọc vẫn ra.
 */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    // Chỗ camelCase gãy: `bookingId` → `booking Id`.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Giá trị lá → chuỗi in được, kèm cờ "đây là chỗ trống". */
function formatLeaf(value: unknown): { value: string; muted: boolean } {
  if (value === null || value === undefined) return { value: ABSENT, muted: true };
  if (value === true) return { value: t.yes, muted: false };
  if (value === false) return { value: t.no, muted: false };
  if (value === '') return { value: t.emptyValue, muted: true };

  return { value: String(value), muted: false };
}

/**
 * Số chữ số của đơn vị nhỏ nhất theo ICU — 2 cho USD/EUR, **0 cho VND/JPY**,
 * 3 cho KWD. `null` khi mã SAI HÌNH DẠNG (không đủ ba chữ cái) — đo được: mã
 * ba chữ cái chưa được gán như `zzz` thì ICU vẫn nhận và mặc định 2 chữ số,
 * nó không phân biệt được "chưa gán" với "có thật". Chấp nhận được vì provider
 * chỉ gửi mã thật, và số thô luôn nằm ngay bên cạnh để đối soát.
 *
 * Đọc từ ICU chứ KHÔNG chép danh sách zero-decimal của `apps/api`: một bản
 * chép thứ hai là một bản sẽ lệch, và danh sách nhị phân bên đó còn coi mọi
 * tiền tệ không-zero là 2 chữ số, tức sai với KWD. Đây cũng là chỗ nguy nhất
 * của cả phép đổi — chia 100 cho VND là sai đúng 100 lần.
 */
/** Cache theo mã tiền — constructor `Intl.NumberFormat` đắt (bài học `AMOUNT_FORMATTERS`). */
const MINOR_DIGITS = new Map<string, number | null>();
const MINOR_FORMATTERS = new Map<string, Intl.NumberFormat>();

function minorUnitDigits(currency: string): number | null {
  const cached = MINOR_DIGITS.get(currency);
  if (cached !== undefined) return cached;
  let digits: number | null;
  try {
    // `maximumFractionDigits` khai `number | undefined` trong lib TS — vắng
    // thì coi như không biết, và không biết thì KHÔNG đổi.
    digits =
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? null;
  } catch {
    digits = null;
  }
  MINOR_DIGITS.set(currency, digits);
  return digits;
}

/**
 * In số tiền với ĐÚNG số chữ số minor của tiền tệ đó (vòng vá review polish
 * 2): `formatAmount` của bảng ép 2 chữ số nên KWD (3) bị làm tròn mất fils
 * và VND (0) dư hai số 0 — trên bề mặt đối soát, làm tròn là sai số.
 */
function formatMinorAmount(major: number, currency: string, digits: number): string {
  const key = `${currency}:${digits}`;
  let formatter = MINOR_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    MINOR_FORMATTERS.set(key, formatter);
  }
  return formatter.format(major);
}

function isBranch(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

export function toPayloadFields(payload: unknown, hints?: PayloadHints): PayloadField[] {
  // Không phải object: vẫn xem được, một dòng — thà thế còn hơn màn hình trắng.
  if (!isBranch(payload)) {
    const leaf = formatLeaf(payload);
    return [{ path: '', label: t.scalar, ...leaf }];
  }

  const fields: PayloadField[] = [];

  /**
   * Một khúc đường dẫn. `raw` để tra từ điển và cắt bao bì; `display` chỉ có ở
   * phần tử MẢNG ("Item 1") — chữ ấy do ta đặt chứ không có khoá nào để tra,
   * và khúc `"0"` thì `humanizeKey` cũng chỉ trả lại `"0"`.
   */
  interface Segment {
    raw: string;
    display?: string;
  }

  /**
   * Nhãn của một dòng: cắt bao bì rồi dịch từng khúc. Cắt xong mà rỗng thì
   * GIỮ đường dẫn đầy đủ — thà dài còn hơn một dòng không có tên (điều kiện
   * `prefix.length < raws.length` chính là chỗ chặn đó).
   */
  function labelFor(segments: Segment[]): string {
    const raws = segments.map((segment) => segment.raw);
    const envelope = hints?.envelopes?.find(
      (prefix) => prefix.length < raws.length && prefix.every((seg, i) => raws[i] === seg),
    );
    const from = envelope ? envelope.length : 0;

    return segments
      .slice(from)
      .map((segment, index) => {
        if (segment.display !== undefined) return segment.display;
        // Tra theo đường dẫn ĐẦY ĐỦ (tính cả khúc bao bì đã cắt) — CHỈ đường
        // dẫn, không tra tên trường trần (vòng vá review polish 2): khoá trần
        // như `id`/`amount`/`value` khớp ở MỌI độ sâu nên `resource.id` của
        // PayPal từng đọc thành 'Event reference' và `amount.value` thành
        // 'Amount charged › Amount charged'. Không khớp thì đọc bằng máy.
        const fullPath = raws.slice(0, from + index + 1).join('.');
        return hints?.labels?.[fullPath] ?? humanizeKey(segment.raw);
      })
      .join(' › ');
  }

  /** Khai theo tên trường HOẶC đường dẫn đầy đủ — cùng luật với `labels`. */
  function declared(list: readonly string[] | undefined, segments: Segment[]): boolean {
    if (!list?.length) return false;
    const raws = segments.map((segment) => segment.raw);
    return list.includes(raws[raws.length - 1] ?? '') || list.includes(raws.join('.'));
  }

  /**
   * Tiền tệ áp cho một số tiền: lấy ở tầng GẦN NHẤT bao quanh nó. Một số tiền
   * thuộc về chính object cũng mang currency của nó, nên tìm từ trong ra ngoài
   * chứ không phải một đường dẫn viết cứng.
   */
  function currencyIn(scopes: Array<Record<string, unknown>>): string | null {
    for (let i = scopes.length - 1; i >= 0; i -= 1) {
      const scope = scopes[i];
      const found = scope?.currency ?? scope?.currency_code;
      if (typeof found === 'string' && found !== '') return found;
    }
    return null;
  }

  /**
   * Diễn giải giá trị nếu vùng có khai. MỌI ca không chắc đều trả `null` để
   * rơi về in thô — thà hiện `11700` trơ còn hơn in một con số sai trên bề
   * mặt đối soát.
   */
  function interpret(
    value: unknown,
    segments: Segment[],
    scopes: Array<Record<string, unknown>>,
  ): { value: string; raw: string } | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    if (declared(hints?.minorUnitAmounts, segments)) {
      if (!Number.isInteger(value)) return null;
      const currency = currencyIn(scopes);
      if (!currency) return null;
      const digits = minorUnitDigits(currency);
      if (digits === null) return null;
      // `minorUnitDigits` đã chứng minh ICU nhận mã này (không ném), nên
      // formatter cùng mã bên dưới cũng an toàn; số thô vẫn nằm ngay bên cạnh.
      return {
        value: formatMinorAmount(value / 10 ** digits, currency.toUpperCase(), digits),
        raw: String(value),
      };
    }

    if (declared(hints?.unixSeconds, segments)) {
      if (!Number.isInteger(value)) return null;
      const date = new Date(value * 1000);
      if (Number.isNaN(date.getTime())) return null;
      return { value: formatDateTime(date.toISOString()), raw: String(value) };
    }

    return null;
  }

  function push(segments: Segment[], leaf: { value: string; muted: boolean }, raw?: string) {
    fields.push({
      path: segments.map((segment) => segment.raw).join('.'),
      label: labelFor(segments),
      ...leaf,
      ...(raw === undefined ? {} : { raw }),
    });
  }

  function walk(
    node: Record<string, unknown> | unknown[],
    segments: Segment[],
    scopes: Array<Record<string, unknown>>,
  ) {
    const entries: Array<[Segment, unknown]> = Array.isArray(node)
      ? // Phần tử mảng đánh số TỪ 1 cho người đọc; `raw` giữ index từ 0 vì nó
        // là khoá React.
        node.map((item, index) => [{ raw: String(index), display: t.item(index + 1) }, item])
      : Object.entries(node).map(([key, item]) => [{ raw: key }, item]);

    for (const [segment, value] of entries) {
      const next = [...segments, segment];

      // Nhánh RỖNG vẫn ra một dòng: khoá có tồn tại trong payload, và giấu nó
      // đi là nói dối về hình dạng dữ liệu.
      if (isBranch(value) && Object.keys(value).length === 0) {
        push(next, { value: t.emptyValue, muted: true });
        continue;
      }

      if (isBranch(value)) {
        walk(value, next, Array.isArray(value) ? scopes : [...scopes, value]);
        continue;
      }

      const shown = interpret(value, next, scopes);
      if (shown) {
        push(next, { value: shown.value, muted: false }, shown.raw);
        continue;
      }

      push(next, formatLeaf(value));
    }
  }

  walk(payload, [], Array.isArray(payload) ? [] : [payload]);

  // Tầng ngoài rỗng thì trả mảng rỗng — vùng nói "không có field nào" bằng
  // một câu tử tế, thay vì vẽ một danh sách trống trơn.
  return fields;
}
