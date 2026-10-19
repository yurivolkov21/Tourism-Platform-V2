'use client';

import type { ChatStatus } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@tourism/ui/components/popover';
import { MailIcon, MessageCircleIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { browserApiOrigin } from '@/lib/api/env';
import { tourSlugFromPath } from '@/lib/concierge';
import { ChatPanel } from './chat-panel';

const OPTION_CLASS =
  'flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Nút nổi "Plan your trip" ở góc dưới phải mọi trang khách (P6, spec §2h). Mở ra hai
 * lối: chat với trợ lý (chỉ khi API báo `available`) và gửi enquiry. Mỗi lần mở hỏi
 * `GET /api/chat` — vừa biết công tắc và trần ngày, vừa đánh thức API đang ngủ (Render
 * free) trước khi khách gõ tin đầu.
 *
 * Trên trang tour dưới `lg`, thanh đặt chỗ dính đáy gắn `data-booking-bar` lên `<body>`
 * và nút đứng lên trên thanh (`booking-rail.tsx`).
 */
export function ContactLauncher() {
  const t = messages.contactLauncher;
  const pathname = usePathname();
  const tourSlug = tourSlugFromPath(pathname);
  const enquiryHref = tourSlug === null ? '/contact' : `/tours/${tourSlug}/enquire`;

  const [menuOpen, setMenuOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    let active = true;
    fetch(`${browserApiOrigin()}/api/chat`)
      .then((response) => (response.ok ? (response.json() as Promise<ChatStatus>) : null))
      .then((status) => {
        if (active) setAvailable(status?.available === true);
      })
      .catch(() => {
        // API không tới được: chỉ còn lối enquiry, như lúc trợ lý tắt.
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [menuOpen]);

  const openChat = () => {
    setMenuOpen(false);
    setPanelMounted(true);
    setPanelOpen(true);
  };

  const closeChat = () => {
    setPanelOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <Popover
        open={menuOpen}
        onOpenChange={(next) => {
          // Khung đang mở thì nút là nút đóng khung, không mở thêm menu chồng lên.
          if (next && panelOpen) {
            setPanelOpen(false);
            return;
          }
          setMenuOpen(next);
        }}
      >
        <PopoverTrigger
          ref={triggerRef}
          aria-label={t.triggerAria}
          className="fixed right-5 bottom-6 z-(--z-sticky) inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-(--shadow-dropdown) transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:in-data-booking-bar:bottom-24"
        >
          <SparklesIcon aria-hidden="true" className="size-4" />
          {t.trigger}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={8} className="w-76 gap-1 p-2">
          <PopoverHeader className="px-2 pt-1 pb-2">
            <PopoverTitle>{t.title}</PopoverTitle>
            <PopoverDescription>{t.subtitle}</PopoverDescription>
          </PopoverHeader>
          {available ? (
            <button type="button" className={OPTION_CLASS} onClick={openChat}>
              <MessageCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block font-medium">{t.bot.label}</span>
                <span className="block text-xs text-muted-foreground">{t.bot.hint}</span>
              </span>
            </button>
          ) : null}
          <Link href={enquiryHref} className={OPTION_CLASS} onClick={() => setMenuOpen(false)}>
            <MailIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-medium">{t.enquiry.label}</span>
              <span className="block text-xs text-muted-foreground">{t.enquiry.hint}</span>
            </span>
          </Link>
        </PopoverContent>
      </Popover>
      {panelMounted ? (
        <ChatPanel
          open={panelOpen}
          onClose={closeChat}
          tourSlug={tourSlug}
          enquiryHref={enquiryHref}
        />
      ) : null}
    </>
  );
}
