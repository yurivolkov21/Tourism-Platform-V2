'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@tourism/ui/components/input-group';
import { Label } from '@tourism/ui/components/label';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

// Ô password + chấm độ mạnh (convert từ playground.md của user — gốc FlyonUI):
// eye toggle ẩn/hiện, 5 vạch điểm, checklist 5 yêu cầu tick dần. Convert theo
// công thức nhà: bố cục giữ nguyên template, MÀU về token (gốc dùng
// orange/amber/green-500 ngoài palette): yếu = destructive, giữa = spark
// (hổ phách), mạnh = primary (jade); đạt-yêu-cầu tick primary. Ngưỡng độ dài
// hạ 12 → 8 ký tự cho khớp copy "At least 8 characters" của cụm auth.
// Validate submit thật vẫn là nợ spec — đây là chỉ báo UX phía client.
const REQUIREMENTS = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[a-z]/, text: '1 lowercase letter' },
  { regex: /[A-Z]/, text: '1 uppercase letter' },
  { regex: /[0-9]/, text: '1 number' },
  { regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, text: '1 special character' },
] as const;

/** Màu vạch theo điểm: 0 nền · ≤1 đỏ · ≤3 hổ phách · 4 jade nhạt · 5 jade */
function barColor(score: number): string {
  if (score <= 1) return 'bg-destructive';
  if (score <= 3) return 'bg-(--region-spark)';
  if (score === 4) return 'bg-primary/60';
  return 'bg-primary';
}

function statusText(score: number): string {
  if (score === 0) return 'Enter a password';
  if (score <= 2) return 'Weak password';
  if (score <= 3) return 'Medium password';
  if (score === 4) return 'Strong password';
  return 'Trail-ready password';
}

interface PasswordStrengthFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  /** Bật chế độ CONTROLLED (Task 3 — register-form cần đọc password thật để
      gọi authClient.signUp.email). Bỏ trống thì field tự quản state nội bộ
      như cũ (reset-password-form chưa wire, vẫn dùng bản uncontrolled). */
  value?: string;
  onChange?: (value: string) => void;
}

export function PasswordStrengthField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: PasswordStrengthFieldProps) {
  const [internalPassword, setInternalPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const password = value ?? internalPassword;

  const checks = REQUIREMENTS.map((req) => ({ met: req.regex.test(password), text: req.text }));
  const score = checks.filter((c) => c.met).length;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={password}
          onChange={(e) => (onChange ?? setInternalPassword)(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setVisible((v) => !v)}
            className="text-muted-foreground hover:bg-transparent"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
            <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* 5 vạch điểm — đổi màu cả dải theo mức, vạch chưa đạt giữ màu nền */}
      <div className="mt-1 flex h-1 w-full gap-1" aria-hidden="true">
        {REQUIREMENTS.map((req, index) => (
          <span
            key={req.text}
            className={cn(
              'h-full flex-1 rounded-full transition-all duration-500 ease-out',
              index < score ? barColor(score) : 'bg-border',
            )}
          />
        ))}
      </div>

      <p className="text-xs font-medium text-foreground">{statusText(score)}</p>

      {/* Checklist yêu cầu — tick jade khi đạt. Lưới 2 cột (user chốt 06/08:
          1 cột 5 dòng kéo giãn chiều cao form đăng ký) — item lẻ cuối tự
          chiếm ô trái hàng chót. */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {checks.map((check) => (
          <li key={check.text} className="flex items-center gap-2">
            {check.met ? (
              <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
            ) : (
              <XIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
            )}
            <span className={cn('text-xs', check.met ? 'text-primary' : 'text-muted-foreground')}>
              {check.text}
              <span className="sr-only">
                {check.met ? ' — requirement met' : ' — requirement not met'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
