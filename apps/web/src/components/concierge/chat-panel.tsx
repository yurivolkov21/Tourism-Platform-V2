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
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ListChecksIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
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

/** Gợi ý mở đầu: hàng nút trọn bề ngang, icon trái, chữ căn trái — dễ chạm trên điện thoại. */
const SUGGESTION_CLASS =
  'h-auto w-full justify-start gap-2.5 rounded-xl bg-background px-3 py-2.5 text-left text-sm font-normal whitespace-normal [&_svg]:text-primary-emphasis';

/** Cách đáy dưới mốc này (px) thì coi như đang ở cuối hội thoại: chữ mới tới thì cuộn theo. */
const STICK_THRESHOLD = 48;

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
  // Khách đang ở cuối hội thoại không. Cuộn lên đọc lại thì chữ đang stream không kéo
  // khung xuống nữa, và nút "cuộn xuống" hiện ra.
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const scrollToBottom = () => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    atBottom.current = true;
    setShowJump(false);
  };

  const onScroll = () => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const near =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= STICK_THRESHOLD;
    atBottom.current = near;
    setShowJump(!near);
  };

  // Nội dung đổi (tin mới, chữ đang stream, thẻ xác nhận, lỗi): đang ở cuối thì cuộn theo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy theo nội dung là chủ đích, thân hàm chỉ đọc ref
  useEffect(() => {
    if (atBottom.current) scrollToBottom();
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
    // Khách vừa gửi thì luôn muốn thấy câu trả lời, kể cả khi đang cuộn lên đọc lại.
    atBottom.current = true;
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
      className="fixed inset-0 z-(--z-overlay) flex flex-col bg-background text-foreground sm:inset-auto sm:right-5 sm:bottom-20 sm:h-[min(40rem,calc(100dvh-8rem))] sm:w-[25rem] sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-(--shadow-popover) max-lg:sm:in-data-booking-bar:bottom-38 max-lg:sm:in-data-booking-bar:h-[min(40rem,calc(100dvh-12rem))]"
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* data-lenis-prevent: Lenis giữ con lăn cho trang, thiếu nó thì lăn trên khung lại cuộn trang. */}
        <div
          ref={scrollRef}
          data-lenis-prevent
          onScroll={onScroll}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-muted/40 px-3 py-4"
        >
          {empty ? (
            // Màn chào khi chưa có tin nào: ảnh đại diện lớn, lời chào, gợi ý mở đầu ở giữa
            // khung. Có tin đầu tiên thì lời chào lùi thành bong bóng đầu hội thoại.
            <div className="my-auto flex flex-col items-center gap-4 px-2 text-center">
              <ConciergeAvatar className="size-12 min-w-12 self-center [&_svg]:size-5" />
              <p className="max-w-72 text-sm text-foreground">{t.greeting}</p>
              <div className="flex w-full max-w-72 flex-col gap-2">
                <Button
                  variant="outline"
                  className={SUGGESTION_CLASS}
                  onClick={() => submit(t.suggestions.findTour)}
                >
                  <SearchIcon aria-hidden="true" />
                  {t.suggestions.findTour}
                </Button>
                <Button
                  variant="outline"
                  className={SUGGESTION_CLASS}
                  onClick={() => submit(t.suggestions.askIncluded)}
                >
                  <ListChecksIcon aria-hidden="true" />
                  {t.suggestions.askIncluded}
                </Button>
                {/* `Link` chứ không phải `ButtonLink` (thẻ `<a>` thuần): điều hướng phía client
                    giữ khung và lượt đang chạy, tải lại trang thì mất cả hai. */}
                <Link
                  href={enquiryHref}
                  onClick={closeIfNarrow}
                  className={cn(buttonVariants({ variant: 'outline' }), SUGGESTION_CLASS)}
                >
                  <MessageSquareTextIcon aria-hidden="true" />
                  {t.suggestions.talkHuman}
                </Link>
              </div>
            </div>
          ) : (
            <AssistantTurn>
              <AssistantBubble>{t.greeting}</AssistantBubble>
            </AssistantTurn>
          )}
          {concierge.messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              streaming={concierge.busy && message.id === last?.id}
              disabled={concierge.busy}
              onRespond={(id, approved) => {
                // Bấm Send/Cancel trên thẻ xác nhận cũng như gửi tin: theo câu trả lời xuống cuối.
                atBottom.current = true;
                void concierge.respond(id, approved);
              }}
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
        {showJump ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.scrollToLatest}
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-(--shadow-popover) motion-safe:animate-in motion-safe:fade-in-0"
          >
            <ArrowDownIcon aria-hidden="true" />
          </Button>
        ) : null}
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
              {/* Đang chờ trả lời: vòng xoay thay mũi tên, nút khoá tới khi lượt xong. */}
              {concierge.busy ? (
                <Loader2Icon aria-hidden="true" className="animate-spin" />
              ) : (
                <ArrowUpIcon aria-hidden="true" />
              )}
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
