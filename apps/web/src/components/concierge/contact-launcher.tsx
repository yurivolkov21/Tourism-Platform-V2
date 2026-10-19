'use client';

import { messages } from '@tourism/i18n';
import { SparklesIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { tourSlugFromPath } from '@/lib/concierge';
import { ChatPanel } from './chat-panel';
import { forgetStoredConversation } from './use-concierge';

/**
 * Nút nổi "Plan your trip" ở góc dưới phải mọi trang khách (P6, spec §2h). Bấm là mở thẳng
 * khung chat; bấm lần nữa là đóng. Menu hai lối chat hoặc enquiry bỏ 19/10 (ADR-0050
 * AMEND 2): khung tự hỏi API trạng thái mỗi lần mở, và lối enquiry nằm trong khung.
 *
 * Trên trang tour dưới `lg`, thanh đặt chỗ dính đáy gắn `data-booking-bar` lên `<body>`
 * và nút đứng lên trên thanh (`booking-rail.tsx`).
 */
export function ContactLauncher() {
  const t = messages.contactLauncher;
  const pathname = usePathname();
  const tourSlug = tourSlugFromPath(pathname);
  const enquiryHref = tourSlug === null ? '/contact' : `/tours/${tourSlug}/enquire`;
  const { data: session, isPending } = useSession();
  const userId = session?.user.id ?? null;
  const userName = session?.user.name.trim() ?? '';

  const [panelMounted, setPanelMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastUserId = useRef<string | null>(null);

  // Phiên rời một tài khoản (đăng xuất ở bất kỳ nút nào, hay đổi tài khoản): xoá id hội thoại
  // và dỡ khung khỏi bộ nhớ, để máy dùng chung không hiện đơn của người trước. Từ vãng lai
  // đăng nhập thì giữ: lượt sau API tự gắn hội thoại vào tài khoản. Lúc phiên còn đang đọc
  // (hydrate trả `null` tạm thời) thì chưa kết luận gì.
  useEffect(() => {
    if (isPending) return;
    const previous = lastUserId.current;
    lastUserId.current = userId;
    if (previous !== null && previous !== userId) {
      forgetStoredConversation();
      setPanelOpen(false);
      setPanelMounted(false);
    }
  }, [userId, isPending]);

  const toggle = () => {
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setPanelMounted(true);
    setPanelOpen(true);
  };

  const closeChat = () => {
    setPanelOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t.triggerAria}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        onClick={toggle}
        className="fixed right-5 bottom-6 z-(--z-sticky) inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-(--shadow-dropdown) transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:in-data-booking-bar:bottom-24"
      >
        <SparklesIcon aria-hidden="true" className="size-4" />
        {t.trigger}
      </button>
      {panelMounted ? (
        <ChatPanel
          open={panelOpen}
          onClose={closeChat}
          tourSlug={tourSlug}
          enquiryHref={enquiryHref}
          userName={userId === null || userName === '' ? null : userName}
          signedIn={userId !== null}
        />
      ) : null}
    </>
  );
}
