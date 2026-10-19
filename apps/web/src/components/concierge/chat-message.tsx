'use client';

import { messages } from '@tourism/i18n';
import { Bubble, BubbleContent } from '@tourism/ui/components/bubble';
import { Loader2Icon } from 'lucide-react';
import { ChatMarkdown } from './chat-markdown';
import { EnquiryConfirmCard } from './enquiry-confirm-card';
import type { ConciergeMessage } from './use-concierge';

type ToolName = keyof typeof messages.chatBot.toolActivity;

/** Dòng "đang làm gì" khi một tool còn chạy — không hiện kết quả thô của tool. */
export function ActivityLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
      {text}
    </p>
  );
}

/**
 * Một tin trong khung chat (spec §2h). Tin khách là bong bóng bên phải; tin trợ lý là chữ
 * markdown, dòng trạng thái của tool đang chạy, và thẻ xác nhận enquiry.
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
      <Bubble align="end">
        <BubbleContent className="whitespace-pre-line">{text.join('\n')}</BubbleContent>
      </Bubble>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message.parts.map((part, index) => {
        // Phần của một tin không đổi thứ tự khi stream (chỉ nối thêm), nên index là khoá ổn định.
        const key = `${message.id}-${index}`;
        if (part.type === 'text') {
          return part.text.trim() === '' ? null : (
            <ChatMarkdown key={key} text={part.text} onNavigate={onNavigate} />
          );
        }
        if (
          part.type === 'tool-submitEnquiry' &&
          part.state !== 'input-streaming' &&
          part.state !== 'input-available'
        ) {
          return (
            <EnquiryConfirmCard key={key} part={part} disabled={disabled} onRespond={onRespond} />
          );
        }
        if (
          part.type.startsWith('tool-') &&
          'state' in part &&
          (part.state === 'input-streaming' || part.state === 'input-available')
        ) {
          const tool = part.type.slice('tool-'.length) as ToolName;
          const text = messages.chatBot.toolActivity[tool];
          return text === undefined ? null : <ActivityLine key={key} text={text} />;
        }
        return null;
      })}
    </div>
  );
}
