'use client';

import {
  type PostReadinessItem,
  PostReadinessItemSchema,
  type PostStatus,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@tourism/ui/components/radio-group';
import { useId } from 'react';
import { FormField } from '@/components/kit/form-field';
import { StableLabel } from '@/components/kit/stable-label';
import { StateMark } from '@/components/tours/editor/step-aside';
import { POST_FORM_ID } from '@/lib/post-form';

/**
 * Card Publish ở đầu cột phải (spec P4e-4 §4.4): chọn Draft hay Published, ngày giờ đăng
 * theo UTC, danh sách ba mục cần để đăng, và nút Save DUY NHẤT của trang (gắn vào form bằng
 * thuộc tính `form` — Quyết định 14).
 *
 * Danh sách đọc bản ĐANG SOẠN (`projectedPostReadiness` do trang truyền xuống), nên xoá tóm
 * tắt là dòng ấy chuyển "Missing" ngay, trước khi lưu.
 */
const t = messages.admin.posts.editor;
const p = t.publish;
const SAVE_LABELS = [t.save, t.saving] as const;
const STATUSES: readonly PostStatus[] = ['DRAFT', 'PUBLISHED'];

export interface PostPublishCardProps {
  status: PostStatus;
  /** Giá trị ô ngày (`YYYY-MM-DDTHH:mm`, UTC). */
  publishAt: string;
  missing: readonly PostReadinessItem[];
  publishAtError: string | undefined;
  pending: boolean;
  dirty: boolean;
  /** Lý do Save khoá dù form có thay đổi (ảnh bìa đang tải lên). */
  blockedNote?: string;
  onStatusChange: (status: PostStatus) => void;
  onPublishAtChange: (value: string) => void;
}

export function PostPublishCard({
  status,
  publishAt,
  missing,
  publishAtError,
  pending,
  dirty,
  blockedNote,
  onStatusChange,
  onPublishAtChange,
}: PostPublishCardProps) {
  const ids = useId();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{p.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <span id={`${ids}-status`} className="text-sm font-medium">
            {p.statusLabel}
          </span>
          <RadioGroup
            aria-labelledby={`${ids}-status`}
            value={status}
            onValueChange={(value) => onStatusChange(value === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')}
            className="grid gap-2"
          >
            {STATUSES.map((option) => (
              <label
                key={option}
                htmlFor={`${ids}-${option}`}
                className="flex items-center gap-2 text-sm"
              >
                <RadioGroupItem id={`${ids}-${option}`} value={option} />
                {option === 'DRAFT' ? p.draft : p.published}
              </label>
            ))}
          </RadioGroup>
          {status === 'DRAFT' ? (
            <p className="text-xs text-muted-foreground">{p.draftHint}</p>
          ) : null}
        </div>

        {status === 'PUBLISHED' ? (
          <FormField
            id="post-publish-at"
            label={p.dateLabel}
            hint={p.dateHint}
            error={publishAtError}
          >
            {(describedBy) => (
              <Input
                id="post-publish-at"
                type="datetime-local"
                value={publishAt}
                aria-invalid={publishAtError !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => onPublishAtChange(event.target.value)}
              />
            )}
          </FormField>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-medium">{p.checklist}</p>
          <ul className="grid gap-2">
            {PostReadinessItemSchema.options.map((item) => {
              const ok = !missing.includes(item);
              return (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <StateMark state={ok ? 'ok' : 'warn'} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span>{p.readiness[item]}</span>
                    {ok ? null : <span className="text-xs text-muted-foreground">{p.missing}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid gap-2">
          {blockedNote ? <p className="text-xs text-muted-foreground">{blockedNote}</p> : null}
          <Button
            type="submit"
            form={POST_FORM_ID}
            focusableWhenDisabled
            disabled={!dirty || pending || blockedNote !== undefined}
          >
            <StableLabel label={pending ? t.saving : t.save} reserve={SAVE_LABELS} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
