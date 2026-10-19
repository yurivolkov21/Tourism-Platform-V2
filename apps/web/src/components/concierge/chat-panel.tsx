'use client';

import { CHAT_LIMITS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button, buttonVariants } from '@tourism/ui/components/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@tourism/ui/components/input-group';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowUpIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import type { ConciergeErrorKind } from '@/lib/concierge';
import {
  AssistantBubble,
  AssistantTurn,
  ChatMessage,
  ConciergeAvatar,
  hasVisibleContent,
  TypingIndicator,
} from './chat-message';
import { useConcierge } from './use-concierge';

/** Dưới mốc `sm` khung phủ kín màn hình: bấm link trong câu trả lời thì đóng khung để thấy trang. */
const NARROW_QUERY = '(max-width: 639px)';

/** Gợi ý mở đầu dạng viên thuốc, nằm dưới lời chào như nút trả lời nhanh của app nhắn tin. */
const SUGGESTION_CLASS = 'rounded-full bg-background';

/**
 * Khung chat của trợ lý (P6, spec §2h). Màn rộng là khung nổi trên nút "Plan your trip",
 * không chặn trang; màn hẹp là lớp phủ kín màn hình. Esc đóng khung, nút gọi trả tiêu điểm.
 *
 * Mount khi khách mở khung lần đầu rồi giữ nguyên (đóng chỉ ẩn): lượt đang chạy không bị
 * cắt, và hội thoại chỉ nạp lại từ API một lần.
 */
export function ChatPanel({
  open,
  onClose,
  tourSlug,
  enquiryHref,
}: {
  open: boolean;
  onClose: () => void;
  tourSlug: string | null;
  enquiryHref: string;
}) {
  const t = messages.chatBot;
  const concierge = useConcierge(tourSlug);
  const titleId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousStatus = useRef(concierge.status);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cuộn về tin mới nhất mỗi khi nội dung đổi (tin mới, chữ đang stream, thẻ, lỗi).
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy theo nội dung là chủ đích, thân hàm chỉ đọc ref
  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [concierge.messages, concierge.status, concierge.errorKind]);

  // Trình đọc màn hình chỉ nghe một câu khi câu trả lời xong, không nghe từng token.
  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = concierge.status;
    if ((was === 'submitted' || was === 'streaming') && concierge.status === 'ready') {
      setAnnouncement('');
      const timer = window.setTimeout(() => setAnnouncement(t.liveAnswerReady), 100);
      return () => window.clearTimeout(timer);
    }
  }, [concierge.status]);

  const blocked =
    concierge.approvalFailed ||
    concierge.errorKind === 'turnLimit' ||
    concierge.errorKind === 'expired' ||
    concierge.errorKind === 'unavailable';
  const canSend = !concierge.busy && !blocked && draft.trim() !== '';

  const submit = (text: string) => {
    if (concierge.busy || blocked || text.trim() === '') return;
    void concierge.send(text.trim());
    setDraft('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // `isComposing`: Enter của bộ gõ tiếng Việt (Telex, VNI) chốt chữ chứ không gửi tin.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  const closeIfNarrow = () => {
    if (window.matchMedia(NARROW_QUERY).matches) onClose();
  };

  const empty = concierge.messages.length === 0 && !concierge.restoring;
  // Chấm "đang gõ" từ lúc gửi tới khi có chữ hay dòng tool đầu tiên của câu trả lời.
  const last = concierge.messages.at(-1);
  const waiting =
    concierge.restoring ||
    concierge.status === 'submitted' ||
    (concierge.status === 'streaming' && (last?.role !== 'assistant' || !hasVisibleContent(last)));

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-(--z-overlay) flex flex-col bg-background text-foreground sm:inset-auto sm:right-5 sm:bottom-20 sm:h-[min(36rem,calc(100dvh-8rem))] sm:w-[23rem] sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-(--shadow-popover) max-lg:sm:in-data-booking-bar:bottom-38 max-lg:sm:in-data-booking-bar:h-[min(36rem,calc(100dvh-12rem))]"
    >
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <ConciergeAvatar className="size-9 min-w-9 self-center [&_svg]:size-4" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-heading text-base leading-tight font-semibold">
            {t.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        {concierge.messages.length > 0 ? (
          <Button variant="ghost" size="sm" disabled={concierge.busy} onClick={concierge.startOver}>
            {t.startOver}
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-sm" aria-label={t.closeAria} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      {/* data-lenis-prevent: Lenis giữ con lăn cho trang, thiếu nó thì lăn trên khung lại cuộn trang. */}
      <div
        ref={scrollRef}
        data-lenis-prevent
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-muted/40 px-3 py-4"
      >
        <AssistantTurn>
          <AssistantBubble>{t.greeting}</AssistantBubble>
        </AssistantTurn>
        {empty ? (
          // Thụt bằng bề ngang ảnh đại diện cộng khoảng cách (size-7 và gap-2) để gợi ý
          // thẳng mép bong bóng chào, còn ảnh đại diện đứng cạnh bong bóng.
          <div className="-mt-2 flex flex-wrap gap-2 pl-9">
            <Button
              variant="outline"
              size="sm"
              className={SUGGESTION_CLASS}
              onClick={() => submit(t.suggestions.findTour)}
            >
              {t.suggestions.findTour}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={SUGGESTION_CLASS}
              onClick={() => submit(t.suggestions.askIncluded)}
            >
              {t.suggestions.askIncluded}
            </Button>
            {/* `Link` chứ không phải `ButtonLink` (thẻ `<a>` thuần): điều hướng phía client giữ
                khung và lượt đang chạy, tải lại trang thì mất cả hai. */}
            <Link
              href={enquiryHref}
              onClick={closeIfNarrow}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), SUGGESTION_CLASS)}
            >
              {t.suggestions.talkHuman}
            </Link>
          </div>
        ) : null}
        {concierge.messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            disabled={concierge.busy}
            onRespond={(id, approved) => void concierge.respond(id, approved)}
            onNavigate={closeIfNarrow}
          />
        ))}
        {waiting ? <TypingIndicator label={t.thinking} /> : null}
        {concierge.errorKind === null ? null : (
          <ErrorNotice
            kind={concierge.errorKind}
            enquiryHref={enquiryHref}
            onRetry={() => void concierge.retry()}
            onStartOver={concierge.startOver}
            onNavigate={closeIfNarrow}
          />
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t px-3 pt-3 pb-2">
        <label htmlFor={inputId} className="sr-only">
          {t.inputLabel}
        </label>
        <InputGroup className="rounded-3xl bg-background">
          {/* `field-sizing-content` của Textarea: ô cao dần theo chữ tới trần `max-h-32`. */}
          <InputGroupTextarea
            ref={inputRef}
            id={inputId}
            rows={1}
            maxLength={CHAT_LIMITS.messageMaxLength}
            value={draft}
            disabled={blocked}
            placeholder={t.inputPlaceholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="max-h-32 min-h-10 py-2.5 pl-4"
          />
          <InputGroupAddon align="inline-end" className="self-end pb-1.5">
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label={t.sendAria}
              disabled={!canSend}
              className="rounded-full"
            >
              <ArrowUpIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.disclaimer}</p>
      </form>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

/** Lỗi theo bảng spec §2b: mỗi loại một câu và đúng một lối ra. */
function ErrorNotice({
  kind,
  enquiryHref,
  onRetry,
  onStartOver,
  onNavigate,
}: {
  kind: ConciergeErrorKind;
  enquiryHref: string;
  onRetry: () => void;
  onStartOver: () => void;
  onNavigate: () => void;
}) {
  const t = messages.chatBot;
  const text = {
    generic: t.error,
    busy: t.busy,
    rateLimited: t.rateLimited,
    turnLimit: t.turnLimit,
    expired: t.expired,
    unavailable: t.unavailable,
  }[kind];

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border bg-background p-3 text-sm"
    >
      <p className="text-muted-foreground">{text}</p>
      <div className="flex flex-wrap gap-2">
        {kind === 'generic' || kind === 'busy' || kind === 'rateLimited' ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t.retry}
          </Button>
        ) : null}
        {kind === 'turnLimit' || kind === 'expired' ? (
          <Button variant="outline" size="sm" onClick={onStartOver}>
            {t.startOver}
          </Button>
        ) : null}
        {kind === 'turnLimit' || kind === 'unavailable' ? (
          <Link
            href={enquiryHref}
            onClick={onNavigate}
            className="self-center text-primary-emphasis underline-offset-4 hover:underline"
          >
            {t.enquiryLink}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
