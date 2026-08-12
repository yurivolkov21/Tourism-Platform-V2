'use client';

import { ORPCError } from '@orpc/client';
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
 */
export function ReviewForm({ bookingCode }: { bookingCode: string }) {
  const t = messages.reviews;
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
      await api.reviews.create(
        {
          bookingCode,
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          body: body.trim(),
        },
        { context: withBrowserAuth() },
      );
      // Trang server đọc lại `reviewedAt` và tự đổi sang lời cảm ơn — không
      // giữ state "đã gửi" ở client, vì như vậy tải lại trang là mất.
      router.refresh();
    } catch (err) {
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
            <InputGroupTextarea
              aria-label={t.bodyLabel}
              placeholder={t.bodyPlaceholder}
              rows={4}
              maxLength={BODY_MAX}
              value={body}
              aria-invalid={touched && bodyTooShort}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-16 border-none text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <InputGroupAddon align="inline-end" className="gap-2 border-none">
            <RatingPicker value={rating} onChange={setRating} />
            <div aria-hidden="true" className="mx-1 h-4 w-px self-center bg-border" />
            <InputGroupButton type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? t.submitting : t.submit}
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
