'use client';

import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@tourism/ui/components/alert-dialog';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { AccountDeleteError, deleteAccount } from '@/lib/api/account';
import { authClient } from '@/lib/auth-client';

/** Chữ khách phải gõ ĐÚNG để mở khoá nút xoá — spec §3, gate CHỈ ở UI (A1
 *  tĩnh). Hằng số ở đây (không phải i18n) vì đây là điều kiện SO KHỚP, không
 *  phải copy hiển thị tự do — đổi ngôn ngữ không được đổi chữ khách phải gõ. */
const CONFIRM_WORD = 'DELETE';

/** Hai bậc không tự xoá được (ADR-0052 AMEND 2) — tên khoá câu trong `danger.errors`. */
type SelfDeleteBlock = 'ownerAccount' | 'staffAccount';

type DeleteAccountErrorKind =
  | 'sessionExpired'
  | 'wrongPassword'
  | 'paidBookings'
  | 'pendingCheckout'
  | 'openCancellation'
  | 'noPassword'
  | 'tooManyAttempts'
  | SelfDeleteBlock
  | 'generic';

/**
 * Role trong hồ sơ → câu thay cho nút xoá (ADR-0052 AMEND 2). Chỉ ẩn nút với hai role đã biết
 * là bị chặn: API mới là nơi chặn thật (role lạ cũng bị chặn ở đó), nên role thiếu hay lạ ở
 * đây vẫn thấy nút và nhận câu báo của hộp xoá, không bị kẹt trước một câu sai.
 */
function selfDeleteBlockOf(role: string): SelfDeleteBlock | null {
  if (role === 'ADMIN') return 'ownerAccount';
  if (role === 'STAFF') return 'staffAccount';
  return null;
}

/** Map mã lỗi API (ADR-0017 §7b) → kind hiển thị; mã lạ rơi về generic. */
function kindOfDeleteError(error: unknown): DeleteAccountErrorKind {
  if (!(error instanceof AccountDeleteError)) return 'generic';
  if (error.status === 401) return 'sessionExpired';
  switch (error.code) {
    case 'INVALID_PASSWORD':
      return 'wrongPassword';
    case 'ACCOUNT_HAS_PAID_BOOKINGS':
      return 'paidBookings';
    case 'ACCOUNT_HAS_PENDING_CHECKOUT':
      return 'pendingCheckout';
    case 'TOO_MANY_ATTEMPTS':
      return 'tooManyAttempts';
    case 'ACCOUNT_HAS_OPEN_CANCELLATION':
      return 'openCancellation';
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'noPassword';
    // Role đổi trong lúc trang còn mở (vd. vừa được cấp Staff): trang dựng theo role cũ.
    case 'ACCOUNT_IS_OWNER':
      return 'ownerAccount';
    case 'ACCOUNT_IS_STAFF':
      return 'staffAccount';
    default:
      return 'generic';
  }
}

/**
 * Xoá tài khoản — khối Danger zone cuối cột phải của Settings (spec 09/10 §2,
 * phương án C): viền đỏ nhạt, tiêu đề serif màu đỏ kèm một dòng mô tả, chỉ
 * dòng "Delete account" tô nền đỏ rất nhạt. Component TỰ mang khung và tiêu đề
 * — trang chỉ xếp nó vào cột.
 *
 * Nút mở dialog là nút đỏ NHỎ (`variant="destructive" size="sm"`) nằm trong
 * dòng ấy, thay text-link của bản 11/08: dòng đã có khung đỏ riêng nên nút
 * không còn "nằm lẻ cuối trang" như lý do hạ cấp hồi đó. Sức nặng cảnh báo vẫn
 * do dialog gõ-để-chắc mang.
 *
 * Dialog xác nhận gõ đúng `CONFIRM_WORD` GIỮ NGUYÊN từ `danger-zone.tsx`
 * (đổi tên file, không đổi logic): gõ sai/để trống → nút khoá; input reset
 * khi dialog đóng để lần mở sau không kế thừa trạng thái cũ.
 *
 * Task 7 (A2): bấm xác nhận → `DELETE /api/account` (tombstone) → THÀNH CÔNG
 * mới `authClient.signOut()` (dọn session client, ADR-0017 §2) → `router.
 * push('/')` + toast. `AlertDialogAction` KHÔNG tự đóng dialog khi lỗi (xem
 * `alert-dialog.tsx` — chỉ `AlertDialogCancel` bọc `Close`), nên message lỗi
 * hiện NGAY trong dialog, khách không mất chữ đã gõ.
 *
 * ADR-0052 AMEND 2: Owner và Staff không tự xoá được. Với hai role ấy dòng Delete account giữ
 * nhãn và nền đỏ nhạt nhưng in câu giải thích thay cho câu mô tả, và không có nút mở hộp.
 */
export function DeleteAccount({
  email,
  accountRole,
}: {
  email: string;
  /** `role` của hồ sơ (`SessionUser.role`). Tên prop tránh `role`, thuộc tính ARIA của JSX. */
  accountRole: string;
}) {
  const t = messages.accountProfile.danger;
  const blocked = selfDeleteBlockOf(accountRole);
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<DeleteAccountErrorKind | null>(null);
  // ADR-0017 §7b: chữ xác nhận là gate chống bấm-nhầm; mật khẩu là gate xác
  // thực lại phía SERVER — cả hai phải có mới mở nút.
  const isUnlocked = confirmText === CONFIRM_WORD && password.length > 0;

  async function handleConfirm() {
    if (!isUnlocked || pending) return;
    setPending(true);
    setErrorKind(null);
    try {
      await deleteAccount(password);
      await authClient.signOut();
      toast.success(messages.accountProfile.toast.accountDeletedTitle, {
        description: messages.accountProfile.toast.accountDeletedBody,
      });
      router.push('/');
    } catch (error) {
      setErrorKind(kindOfDeleteError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-destructive/30 bg-card">
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-4.5 sm:pb-3.5">
        <h2 className="font-heading text-lg leading-tight font-semibold text-destructive-emphasis">
          {t.heading}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Dòng DUY NHẤT tô nền đỏ: nhãn và câu giải thích trái, nút mở hộp phải; dưới `sm` nút
          xuống hàng dưới. */}
      <div className="flex flex-col items-start gap-3 border-t border-destructive/20 bg-destructive/5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4.5 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-destructive-emphasis">{t.deleteCta}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {blocked ? t.errors[blocked] : t.dialogBody}
          </p>
        </div>
        {blocked ? null : (
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                setConfirmText('');
                setPassword('');
                setErrorKind(null);
              }
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="shrink-0 border-destructive/30"
                >
                  {t.deleteCta}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.dialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>{t.dialogBody}</AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-account-confirm">{t.typeToConfirm(CONFIRM_WORD)}</Label>
                <Input
                  id="delete-account-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* G31: trình quản lý mật khẩu của Edge (Chromium) đoán ô chữ ĐỨNG TRƯỚC ô mật khẩu là
                  ô tên đăng nhập và điền email vào ô gõ DELETE — nó bỏ qua `autoComplete="off"`.
                  Một ô username ẩn mang email, khai `autoComplete="username"`, là khuôn Chromium
                  hướng dẫn cho form chỉ có mật khẩu: trình quản lý nhận ô này làm tên đăng nhập và
                  để yên ô gõ DELETE. Ô ẩn không vào cây truy cập, không gửi đi đâu. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={email}
                readOnly
                hidden
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-account-password">{t.passwordLabel}</Label>
                <Input
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {errorKind ? (
                <AccountActionError
                  expired={errorKind === 'sessionExpired'}
                  redirectTo="/account/profile"
                  fallback={
                    errorKind === 'sessionExpired' || errorKind === 'generic'
                      ? messages.accountActionErrors.generic
                      : t.errors[errorKind]
                  }
                />
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={!isUnlocked || pending}
                  onClick={handleConfirm}
                >
                  {t.confirmCta}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </section>
  );
}
