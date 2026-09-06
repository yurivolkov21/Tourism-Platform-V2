'use client';

import { ORPCError } from '@orpc/client';
import type { MyReview } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Field } from '@tourism/ui/components/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from '@tourism/ui/components/input-group';
import { PenLineIcon, StarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';

/** Trần của contract: `title` max 120, `body` 10–2000. */
const BODY_MIN = 10;
const BODY_MAX = 2000;
const TITLE_MAX = 120;
const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Chọn sao bằng RADIO thật, không phải `<div>` bấm được.
 *
 * Radio cho sẵn: điều hướng bằng phím mũi tên, đọc được "3 of 5" trên trình
 * đọc màn hình, và submit form bằng Enter vẫn chạy. Một hàng div có `onClick`
 * trông giống hệt nhưng mất cả ba thứ đó.
 *
 * Từ bản composite 12/08 picker đứng trong addon phải của InputGroup —
 * legend tụt xuống sr-only (khung tự giải thích), radio giữ nguyên.
 */
function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = messages.reviews;
  return (
    <fieldset>
      <legend className="sr-only">{t.ratingLabel}</legend>
      <div className="flex items-center gap-0.5">
        {STARS.map((n) => (
          <label key={n} className="cursor-pointer p-0.5">
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only peer"
            />
            <span className="sr-only">{t.ratingValueLabel(n)}</span>
            <StarIcon
              aria-hidden="true"
              className={`size-5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
                n <= value ? 'fill-rating text-rating' : 'text-muted-foreground'
              }`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Form viết đánh giá cho một booking đã đi xong (cụm B, nửa 2; THAY DA
 * 12/08 theo mẫu InputGroup composite user chọn — mảnh 2 cụm review-ảnh):
 * MỘT khung nhập liệu thống nhất — icon addon trái, title (input không
 * viền) chồng textarea nội dung, addon phải là 5 sao + nút Submit. LOGIC
 * GIỮ NGUYÊN từ bản cũ: state/validate theo contract, submit oRPC + map mã
 * lỗi, `router.refresh()` để server tự đổi sang lời cảm ơn.
 *
 * Title/body mất Label nhìn thấy (khung tự giải thích bằng placeholder) →
 * `aria-label` gánh phần đọc máy; spec cũ truy vấn qua label vẫn sống.
 *
 * Điều kiện hiện form do `reviewSlot()` quyết, và hàm đó soi gương luật của
 * API — nếu hai bên nói khác nhau thì khách gõ hết bài rồi mới bị từ chối.
 *
 * `photos`/`photosBusy` (Task 9, ADR-0021) do `ReviewComposer` giữ và truyền
 * xuống — THỨ TỰ mảng `photos` là thứ tự Sortable ở panel ảnh, ảnh đầu là
 * ảnh đại diện; form không tự sắp lại. `photosBusy` khoá nút submit trong
 * lúc còn ảnh đang upload, tránh gửi review thiếu ảnh khách vừa chọn.
 */
export function ReviewForm({
  bookingCode,
  review,
  photos = [],
  photosBusy = false,
}: {
  bookingCode: string;
  /**
   * Có = chế độ SỬA (ADR-0032): điền sẵn nội dung cũ và gọi `reviews.update`
   * thay vì `create`. Vắng = lần viết đầu.
   *
   * Điền sẵn là bắt buộc chứ không phải tiện tay: bắt khách gõ lại từ đầu một
   * bài họ đã viết, chỉ vì một câu bị bác, là một đường quay lại trên danh
   * nghĩa.
   */
  review?: MyReview;
  photos?: string[];
  photosBusy?: boolean;
}) {
  const t = messages.reviews;
  const router = useRouter();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [title, setTitle] = useState(review?.title ?? '');
  const [body, setBody] = useState(review?.body ?? '');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyTooShort = body.trim().length < BODY_MIN;
  const invalid = rating === 0 || bodyTooShort;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    // Chặn ở client theo ĐÚNG ràng buộc contract (rating 1–5, body ≥10) —
    // để khách biết trước khi gửi, không phải sau khi ăn 400.
    if (invalid) return;
    setError(null);
    setPending(true);
    try {
      const content = {
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        body: body.trim(),
        // `photos` VẮNG ở nhánh sửa nghĩa là gỡ hết (ADR-0032 §3) — cùng ý
        // nghĩa với contract, nên không phải giữ lại danh sách cũ hộ ai.
        ...(photos.length > 0 ? { photos } : {}),
      };
      if (review) {
        await api.reviews.update({ id: review.id, ...content }, { context: withBrowserAuth() });
      } else {
        await api.reviews.create({ bookingCode, ...content }, { context: withBrowserAuth() });
      }
      // Trang server đọc lại `reviewedAt` và tự đổi sang lời cảm ơn — không
      // giữ state "đã gửi" ở client, vì như vậy tải lại trang là mất.
      router.refresh();
    } catch (err) {
      if (err instanceof ORPCError && err.status === 429) {
        setError(messages.accountActionErrors.throttle);
        return;
      }
      const code = err instanceof ORPCError ? err.code : '';
      setError(t.errors[code] ?? t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-foreground">{t.heading}</h3>

      <Field>
        <InputGroup className="h-auto flex-wrap items-start bg-background p-3 pl-4">
          <InputGroupAddon className="mt-1.5 inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted p-0">
            <PenLineIcon className="size-4 text-muted-foreground" />
          </InputGroupAddon>

          <div className="flex min-w-0 flex-1 flex-col pt-1 pl-1">
            <InputGroupInput
              aria-label={t.titleLabel}
              placeholder={t.titlePlaceholder}
              maxLength={TITLE_MAX}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 border-none text-base shadow-none focus-visible:ring-0"
            />
            {/* `resize-y` mở lại tay kéo dọc (base của InputGroupTextarea khoá
                resize-none) — khách viết dài kéo giãn ra xem lại được (góp ý
                user 12/08); max-h chặn kéo lố làm vỡ khung. */}
            <InputGroupTextarea
              aria-label={t.bodyLabel}
              placeholder={t.bodyPlaceholder}
              rows={4}
              maxLength={BODY_MAX}
              value={body}
              aria-invalid={touched && bodyTooShort}
              onChange={(event) => setBody(event.target.value)}
              className="max-h-80 min-h-16 resize-y border-none text-sm shadow-none focus-visible:ring-0"
            />
            {/* Bộ đếm phơi trần contract — vàng khi chạm 90%, đỏ khi kịch trần
                (maxLength đã chặn gõ thêm, màu chỉ để giải thích vì sao). */}
            <span
              className={`self-end pr-1 pb-1 font-mono text-[11px] tabular-nums ${
                body.length >= BODY_MAX
                  ? 'text-destructive-emphasis'
                  : body.length >= BODY_MAX * 0.9
                    ? 'text-warning'
                    : 'text-muted-foreground'
              }`}
            >
              {t.bodyCounter(body.length, BODY_MAX)}
            </span>
          </div>

          <InputGroupAddon align="inline-end" className="gap-2 border-none">
            <RatingPicker value={rating} onChange={setRating} />
            <div aria-hidden="true" className="mx-1 h-4 w-px self-center bg-border" />
            <InputGroupButton
              type="submit"
              variant="default"
              size="sm"
              disabled={pending || photosBusy}
            >
              {/* Nhãn theo VIỆC đang làm: gửi lần đầu và gửi lại sau khi bị
                  bác là hai việc khác nhau với người bấm. */}
              {review ? (pending ? t.resubmitting : t.resubmit) : pending ? t.submitting : t.submit}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>

      {touched && rating === 0 ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {t.ratingRequired}
        </p>
      ) : null}
      {touched && bodyTooShort ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {t.bodyTooShort(BODY_MIN)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {error}
        </p>
      ) : null}
    </form>
  );
}
