import type {
  AdminDepartureCancelInput,
  AdminDepartureCreateInput,
  AdminDepartureRow,
  AdminDepartureSetStatusInput,
  AdminDepartureUpdateInput,
} from '@tourism/contract';
import { cancellationDeadline, DEPARTURE_SEATS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của ba hành vi ghi vùng chuyến (spec P4e-1 F12) — cùng khuôn
 * `enquiries-write.ts`: codec lỗi derive từ khối i18n, hợp đồng vận chuyển
 * của server action, và validate form để component không tự chế luật.
 *
 * BA codec chứ không một: ba endpoint có mã trùng tên (`NOT_FOUND`) nhưng ba
 * câu phải khác nhau — "tour biến mất nên chuyến không được tạo" và "chuyến
 * biến mất nên sửa không lưu" là hai việc khác nhau với người vừa gõ xong một
 * form.
 */

const t = messages.admin.departures;

/**
 * Mã TRẠNG-THÁI-CŨ: thế giới đã đổi dưới chân dialog, nên UI đóng lại + toast
 * + refresh thay vì mời bấm lại (bấm lại vào cùng một thực tại thì lần nào
 * cũng hỏng như nhau).
 *
 * `INVALID_DATE_RANGE` và `START_IN_PAST` KHÔNG nằm trong tập này, có chủ
 * đích: chúng nói về thứ đang nằm trong ô nhập, sửa tại chỗ là xong — đóng
 * dialog ở đó là bắt người ta gõ lại từ đầu.
 */
const createCodec = createWriteErrorCodec(t.create.errors, { stale: ['NOT_FOUND'] });
const updateCodec = createWriteErrorCodec(t.edit.errors, {
  stale: [
    'NOT_FOUND',
    'DEPARTURE_HAS_BOOKINGS',
    'SEATS_BELOW_BOOKED',
    'DEPARTURE_CANCELLED',
    // Ai đó vừa sửa chính chuyến này: thế giới đã đổi dưới chân dialog, bấm
    // lại cùng một payload cũ thì lần nào cũng hỏng như nhau.
    'DEPARTURE_STALE',
  ],
});
const setStatusCodec = createWriteErrorCodec(t.setStatus.errors, {
  stale: ['NOT_FOUND', 'DEADLINE_PASSED', 'DEPARTURE_CANCELLED'],
});

export const CREATE_CONTRACT_CODES = createCodec.codes;
export const UPDATE_CONTRACT_CODES = updateCodec.codes;
export const SET_STATUS_CONTRACT_CODES = setStatusCodec.codes;

export type CreateContractCode = keyof typeof t.create.errors;
export type UpdateContractCode = keyof typeof t.edit.errors;
export type SetStatusContractCode = keyof typeof t.setStatus.errors;

export const classifyCreateError = createCodec.classify;
export const createErrorCopy = createCodec.copy;
export const isCreateStale = createCodec.isStale;

export const classifyUpdateError = updateCodec.classify;
export const updateErrorCopy = updateCodec.copy;
export const isUpdateStale = updateCodec.isStale;

export const classifySetStatusError = setStatusCodec.classify;
export const setStatusErrorCopy = setStatusCodec.copy;
export const isSetStatusStale = setStatusCodec.isStale;

/**
 * Kết quả một lệnh ghi — hợp đồng vận chuyển giữa `actions.ts` (server) và
 * dialog (client), sống ở lib để tầng server không import tầng trình bày.
 *
 * Nhánh thành công chở NGUYÊN hàng server vừa ghi: toast kể lại chuyện thật
 * (ngày sau khi sửa, không phải ngày đã gửi đi), và bảng có sẵn dữ liệu tươi
 * nếu sau này cần dùng tới.
 */
export type DepartureWriteResult<Code extends string> =
  | { ok: true; row: AdminDepartureRow }
  | { ok: false; code: Code | TransportFailureCode };

export type CreateDepartureAction = (
  input: AdminDepartureCreateInput,
) => Promise<DepartureWriteResult<CreateContractCode>>;

export type UpdateDepartureAction = (
  input: AdminDepartureUpdateInput,
) => Promise<DepartureWriteResult<UpdateContractCode>>;

export type SetDepartureStatusAction = (
  input: AdminDepartureSetStatusInput,
) => Promise<DepartureWriteResult<SetStatusContractCode>>;

/**
 * Mã TRẠNG-THÁI-CŨ của huỷ chuyến: cả ba đều nói "thế giới đã đổi dưới chân
 * dialog", không cái nào sửa tại chỗ được.
 */
const cancelCodec = createWriteErrorCodec(t.cancel.errors, {
  stale: ['NOT_FOUND', 'DEPARTURE_CANCELLED', 'DEPARTURE_STARTED'],
});

export const CANCEL_CONTRACT_CODES = cancelCodec.codes;
export type CancelContractCode = keyof typeof t.cancel.errors;
export const classifyCancelError = cancelCodec.classify;
export const cancelErrorCopy = cancelCodec.copy;
export const isCancelStale = cancelCodec.isStale;

export type CancelDepartureAction = (
  input: AdminDepartureCancelInput,
) => Promise<DepartureWriteResult<CancelContractCode>>;

/** Copy của `ConfirmWriteDialog` cho lệnh huỷ chuyến — ô lý do BẮT BUỘC. */
export function cancelDialogCopy() {
  const d = t.cancel.dialog;
  return {
    title: d.title,
    body: d.body,
    warning: d.warning,
    noteLabel: d.noteLabel,
    notePlaceholder: d.notePlaceholder,
    submit: d.submit,
    submitting: d.submitting,
    cancel: t.form.cancel,
  };
}

/**
 * Ngữ cảnh hàng trong hộp xác nhận huỷ: chuyến nào, bao nhiêu người ĐƯỢC HOÀN
 * TIỀN, bao nhiêu phiên thanh toán bị huỷ.
 *
 * Hai con số chứ không một, vì hai nhóm nhận hai hệ quả khác nhau: người đã
 * trả được hoàn trọn phần còn lại, người đang trả chỉ mất phiên thanh toán.
 * Dòng "checkouts" chỉ hiện khi khác 0 — cùng lý lẽ với hộp xác nhận Close.
 */
export function cancelConfirmRows(row: {
  dates: string;
  paidBookingCount: number;
  pendingBookingCount: number;
}): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: t.cancel.rows.departure, value: row.dates },
    { label: t.cancel.rows.toRefund, value: String(row.paidBookingCount) },
  ];
  if (row.pendingBookingCount > 0) {
    rows.push({ label: t.cancel.rows.checkouts, value: String(row.pendingBookingCount) });
  }
  return rows;
}

// ── Form tạo/sửa ────────────────────────────────────────────────────────────

/** Bốn ô của form, thô như người gõ — chuỗi hết, kể cả số. */
export interface DepartureFormValues {
  startDate: string;
  endDate: string;
  seats: string;
  /** Rỗng = thừa hưởng `basePrice` của tour. */
  price: string;
}

export interface DepartureFormErrors {
  startDate?: string;
  endDate?: string;
  seats?: string;
  price?: string;
}

/** Ngày lịch `YYYY-MM-DD` — đúng thứ `<input type="date">` trả về. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Tiền: tối đa 2 số lẻ, khớp `Decimal(14,2)` của cột. */
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Soi gương luật server để lỗi đọc-thấy-ngay không phải đi một vòng mạng.
 * KHÔNG soi hai luật phụ thuộc thời gian và dữ liệu sống (ngày đã trôi qua,
 * chuyến đã có booking): cả hai do SERVER phán, vì chỉ server biết hôm nay là
 * ngày nào theo giờ Việt Nam và có ai vừa đặt chỗ hay không.
 *
 * `seatsBooked` thì có soi: nó nằm ngay trên hàng đang sửa, và một câu "đã có
 * 4 khách" hiện ngay dưới ô còn hữu ích hơn hẳn một vòng 409.
 */
export function validateDepartureForm(
  values: DepartureFormValues,
  limits: { seatsBooked: number },
): DepartureFormErrors {
  const errors: DepartureFormErrors = {};
  const e = t.form.errors;

  if (!ISO_DATE.test(values.startDate)) errors.startDate = e.startRequired;
  if (!ISO_DATE.test(values.endDate)) errors.endDate = e.endRequired;
  // So chuỗi ISO: thứ tự từ điển đúng bằng thứ tự thời gian.
  if (!errors.startDate && !errors.endDate && values.endDate < values.startDate) {
    errors.endDate = e.range;
  }

  const seats = Number(values.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > DEPARTURE_SEATS_MAX) {
    errors.seats = e.seats(DEPARTURE_SEATS_MAX);
  } else if (seats < limits.seatsBooked) {
    errors.seats = e.seatsBelowBooked(limits.seatsBooked);
  }

  const price = values.price.trim();
  if (price !== '' && !AMOUNT.test(price)) errors.price = e.price;

  return errors;
}

/**
 * Chuyến SẮP tạo đã quá hạn nhận đặt chưa — câu cảnh báo, hoặc `undefined`.
 *
 * Vì sao cần: hạn đặt là `ngày khởi hành − N` với N tới 7 ngày cho tour dài
 * (ADR-0041 §2), nên một chuyến 5 ngày khởi hành TUẦN SAU đã quá hạn ngay lúc
 * tạo. Server vẫn cho tạo (ghi nhận một chuyến chốt ngoài hệ thống là việc
 * thật) nhưng nó sẽ không bán được — và copy cũ hứa "goes on sale straight
 * away" thì nói sai đúng chỗ đó.
 *
 * Luật tính hạn lấy TỪ CONTRACT (`cancellationDeadline`), một nguồn duy nhất
 * cho cả API lẫn web lẫn đây (ADR-0041 §8) — không chép lại phép trừ.
 *
 * `today` là ngày lịch VIỆT NAM do server đưa xuống, cùng lý do với
 * `toDepartureRowVM`: đồng hồ trình duyệt không quyết định luật tiền.
 */
export function createDeadlineHint(values: DepartureFormValues, today: string): string | undefined {
  // Ngày chưa gõ xong / ngược nhau: `cancellationDeadline` sẽ ném `RangeError`.
  // Im lặng ở đây là đúng — ô ngày đã có câu lỗi riêng của nó.
  if (!ISO_DATE.test(values.startDate) || !ISO_DATE.test(values.endDate)) return undefined;
  if (values.endDate < values.startDate) return undefined;

  const deadline = cancellationDeadline(values.startDate, values.endDate);
  // Hạn hết lúc 23:59:59 giờ Việt Nam của CHÍNH ngày đó — bằng nhau là còn kịp.
  return today > deadline ? t.create.deadlinePassedHint : undefined;
}

/** Form có ô nào hỏng không — một chỗ hỏi, để không nơi nào tự đếm keys. */
export function hasFormErrors(errors: DepartureFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Bốn ô thô → đúng hình dạng contract. Gọi SAU khi validate đã sạch. */
export function departureFormPayload(values: DepartureFormValues): {
  startDate: string;
  endDate: string;
  seatsTotal: number;
  priceOverride: string | null;
} {
  const price = values.price.trim();
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    seatsTotal: Number(values.seats),
    priceOverride: price === '' ? null : price,
  };
}

// ── Dialog đóng/mở lại ──────────────────────────────────────────────────────

/**
 * Copy của `ConfirmWriteDialog` cho một trong hai chiều đóng/mở.
 *
 * `pendingBookingCount` chỉ đổi chiều ĐÓNG: kit chỉ có MỘT ô `warning`, nên
 * câu thứ hai nối vào đó thay vì phải nới hợp đồng của kit cho một vùng.
 *
 * Vì sao phải có câu thứ hai: câu gốc hứa khách "are told nothing" — đúng với
 * người ĐÃ trả, sai với người ĐANG trả. Đường claim đòi chuyến còn mở, nên một
 * lượt thanh toán về SAU khi đóng sẽ bị từ chối rồi hoàn tiền tự động kèm
 * email. Admin phải biết trước khi bấm, không phải đọc lại trong sổ sự kiện.
 */
export function setStatusDialogCopy(next: 'OPEN' | 'CLOSED', pendingBookingCount = 0) {
  const d = t.setStatus.dialog;
  return next === 'CLOSED'
    ? {
        title: d.closeTitle,
        body: d.closeBody,
        warning:
          pendingBookingCount > 0
            ? `${d.closeWarning} ${d.closePendingWarning(pendingBookingCount)}`
            : d.closeWarning,
        submit: d.closeSubmit,
        submitting: d.closeSubmitting,
        cancel: t.form.cancel,
      }
    : {
        title: d.reopenTitle,
        body: d.reopenBody,
        warning: d.reopenWarning,
        submit: d.reopenSubmit,
        submitting: d.reopenSubmitting,
        cancel: t.form.cancel,
      };
}

/**
 * Ngữ cảnh hàng trong dialog: ngày nào, mấy khách, hạn chót ngày nào. Mấy dòng
 * này là lớp bảo vệ duy nhất chống bấm nhầm hàng — bảng có thể dài, mà dialog
 * thì không nhớ hộ ai cả.
 *
 * Khách ĐÃ trả và khách ĐANG trả đứng thành HAI dòng, vì đóng chuyến gây cho
 * họ hai hệ quả khác hẳn nhau. Dòng "đang trả" chỉ hiện khi khác 0: một dòng
 * `0` cố định là nhiễu ở mọi chuyến bình thường, mà nhiễu thì người ta thôi đọc.
 */
export function setStatusConfirmRows(row: {
  dates: string;
  paidBookingCount: number;
  pendingBookingCount: number;
  deadline: string;
}): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: t.setStatus.rows.departure, value: row.dates },
    { label: t.setStatus.rows.paidBookings, value: String(row.paidBookingCount) },
  ];
  if (row.pendingBookingCount > 0) {
    rows.push({
      label: t.setStatus.rows.pendingBookings,
      value: String(row.pendingBookingCount),
    });
  }
  rows.push({ label: t.setStatus.rows.deadline, value: row.deadline });
  return rows;
}

/** Toast của nhánh thành công — hai giọng, đọc trạng thái TỪ RESPONSE. */
export function setStatusToast(row: AdminDepartureRow, dates: string) {
  const toast = t.setStatus.toast;
  return row.status === 'CLOSED'
    ? { title: toast.closedTitle, description: toast.closedBody(dates) }
    : { title: toast.reopenedTitle, description: toast.reopenedBody(dates) };
}
