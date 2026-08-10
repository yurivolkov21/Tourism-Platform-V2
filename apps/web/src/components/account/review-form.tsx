'use client';

import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { Textarea } from '@tourism/ui/components/textarea';
import { StarIcon } from 'lucide-react';
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
 */
function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = messages.reviews;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-foreground">{t.ratingLabel}</legend>
      <div className="flex items-center gap-1">
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
              className={`size-6 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
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
 * Form viết đánh giá cho một booking đã đi xong (cụm B, nửa 2).
 *
 * Đặt SAU phần thông tin booking trên trang chi tiết, không phải modal: khi
 * khách mở trang này, câu hỏi đầu tiên của họ gần như luôn là "tiền của tôi
 * đâu / chuyến của tôi thế nào" — một modal đánh giá bật lên sẽ chen ngang
 * đúng lúc đó.
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
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="font-heading text-lg font-medium text-foreground">{t.heading}</h2>

      <RatingPicker value={rating} onChange={setRating} />
      {touched && rating === 0 ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {t.ratingRequired}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-title">{t.titleLabel}</Label>
        <Input
          id="review-title"
          maxLength={TITLE_MAX}
          placeholder={t.titlePlaceholder}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-body">{t.bodyLabel}</Label>
        <Textarea
          id="review-body"
          rows={5}
          maxLength={BODY_MAX}
          placeholder={t.bodyPlaceholder}
          value={body}
          aria-invalid={touched && bodyTooShort}
          onChange={(event) => setBody(event.target.value)}
        />
        {touched && bodyTooShort ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {t.bodyTooShort(BODY_MIN)}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive-emphasis">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
