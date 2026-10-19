'use client';

import { messages } from '@tourism/i18n';
import { Bubble, BubbleContent } from '@tourism/ui/components/bubble';
import { Message, MessageAvatar, MessageContent } from '@tourism/ui/components/message';
import { cn } from '@tourism/ui/lib/utils';
import { Loader2Icon, SparklesIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChatMarkdown } from './chat-markdown';
import { EnquiryConfirmCard } from './enquiry-confirm-card';
import type { ConciergeMessage } from './use-concierge';

type ToolName = keyof typeof messages.chatBot.toolActivity;
type ConciergePart = ConciergeMessage['parts'][number];

/** Ảnh đại diện của trợ lý: cùng một dấu ở đầu khung và cạnh mỗi lượt trả lời. */
export function ConciergeAvatar({ className }: { className?: string }) {
  return (
    <MessageAvatar
      aria-hidden="true"
      className={cn('size-7 min-w-7 bg-primary text-primary-foreground', className)}
    >
      <SparklesIcon className="size-3.5" />
    </MessageAvatar>
  );
}

/**
 * Một lượt nói của trợ lý: ảnh đại diện bên trái, nội dung xếp dọc bên phải. Bong bóng
 * trợ lý góc dưới trái vuông lại, phía ảnh đại diện — đọc ra ai đang nói như app nhắn tin.
 */
export function AssistantTurn({ children }: { children: ReactNode }) {
  return (
    <Message>
      <ConciergeAvatar />
      <MessageContent className="items-start">{children}</MessageContent>
    </Message>
  );
}

/** Bong bóng chữ của trợ lý: nền sáng trên nền khung đã nhuộm, để tách khỏi nền. */
export function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <Bubble variant="outline" className="max-w-full">
      <BubbleContent className="rounded-2xl rounded-bl-sm border-border px-3.5 py-2.5 shadow-xs">
        {children}
      </BubbleContent>
    </Bubble>
  );
}

/** Dòng "đang làm gì" khi một tool còn chạy — không hiện kết quả thô của tool. */
export function ActivityLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />
      {text}
    </p>
  );
}

/**
 * Ba chấm "đang gõ" trong bong bóng trợ lý, lúc chờ chữ đầu tiên. Chữ đọc cho trình đọc
 * màn hình nằm trong `sr-only`; chấm chỉ nhảy khi máy không bật giảm chuyển động.
 */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <AssistantTurn>
      <AssistantBubble>
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="flex h-5 items-center gap-1">
          {['[animation-delay:0ms]', '[animation-delay:150ms]', '[animation-delay:300ms]'].map(
            (delay) => (
              <span
                key={delay}
                className={cn(
                  'size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce',
                  delay,
                )}
              />
            ),
          )}
        </span>
      </AssistantBubble>
    </AssistantTurn>
  );
}

/** Phần nào của tin trợ lý có thứ để hiện (chữ khác rỗng, thẻ xác nhận, dòng tool đang chạy). */
function isVisiblePart(part: ConciergePart): boolean {
  if (part.type === 'text') return part.text.trim() !== '';
  if (part.type === 'tool-submitEnquiry') return true;
  return (
    part.type.startsWith('tool-') &&
    'state' in part &&
    (part.state === 'input-streaming' || part.state === 'input-available') &&
    messages.chatBot.toolActivity[part.type.slice('tool-'.length) as ToolName] !== undefined
  );
}

/** Tin trợ lý chưa có gì để hiện: khung giữ chấm "đang gõ" thay vì một ảnh đại diện trơ trọi. */
export function hasVisibleContent(message: ConciergeMessage): boolean {
  return message.parts.some(isVisiblePart);
}

/**
 * Một tin trong khung chat (spec §2h). Tin khách là bong bóng màu chính bên phải; tin trợ
 * lý là bong bóng sáng bên trái kèm ảnh đại diện, dòng trạng thái của tool đang chạy, và
 * thẻ xác nhận enquiry.
 */
export function ChatMessage({
  message,
  disabled,
  onRespond,
  onNavigate,
}: {
  message: ConciergeMessage;
  disabled: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
  onNavigate: () => void;
}) {
  if (message.role === 'user') {
    const text = message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []));
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end">
            <BubbleContent className="rounded-2xl rounded-br-sm px-3.5 py-2.5 whitespace-pre-line">
              {text.join('\n')}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  if (!hasVisibleContent(message)) return null;

  return (
    <AssistantTurn>
      {message.parts.map((part, index) => {
        // Phần của một tin không đổi thứ tự khi stream (chỉ nối thêm), nên index là khoá ổn định.
        const key = `${message.id}-${index}`;
        if (!isVisiblePart(part)) return null;
        if (part.type === 'text') {
          return (
            <AssistantBubble key={key}>
              <ChatMarkdown text={part.text} onNavigate={onNavigate} />
            </AssistantBubble>
          );
        }
        if (part.type === 'tool-submitEnquiry') {
          if (part.state === 'input-streaming' || part.state === 'input-available') {
            return <ActivityLine key={key} text={messages.chatBot.toolActivity.submitEnquiry} />;
          }
          return (
            <div key={key} className="w-full">
              <EnquiryConfirmCard part={part} disabled={disabled} onRespond={onRespond} />
            </div>
          );
        }
        const tool = part.type.slice('tool-'.length) as ToolName;
        return <ActivityLine key={key} text={messages.chatBot.toolActivity[tool]} />;
      })}
    </AssistantTurn>
  );
}
