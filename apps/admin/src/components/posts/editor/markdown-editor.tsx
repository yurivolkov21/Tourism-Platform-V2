'use client';

import { messages } from '@tourism/i18n';
import { ArticleMarkdown } from '@tourism/ui/components/article-markdown';
import { Button } from '@tourism/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import { Textarea } from '@tourism/ui/components/textarea';
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  applyMarkdownAction,
  type MarkdownAction,
  type TextSelection,
} from '@/lib/markdown-actions';

/**
 * Trình soạn thân bài (spec P4e-4 §4.4, ADR-0051 §1): ô markdown, hàng nút CHÈN cú pháp, tab
 * Preview vẽ bằng CHÍNH bộ render của web (`ArticleMarkdown` ở `@tourism/ui`) — thứ admin
 * xem trước là thứ khách đọc.
 *
 * Nút giữ tiêu điểm ở ô (`onMouseDown` chặn mặc định), rồi đặt lại vùng chọn SAU khi React
 * vẽ chữ mới: ô kiểm soát nhận `value` mới thì trình duyệt đẩy con trỏ về cuối.
 */
const t = messages.admin.posts.editor.markdown;

const ACTIONS: readonly { action: MarkdownAction; label: string; icon: LucideIcon }[] = [
  { action: 'heading', label: t.heading, icon: Heading2Icon },
  { action: 'bold', label: t.bold, icon: BoldIcon },
  { action: 'italic', label: t.italic, icon: ItalicIcon },
  { action: 'bullet', label: t.bullet, icon: ListIcon },
  { action: 'link', label: t.link, icon: LinkIcon },
];

export function MarkdownEditor({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  /** `id` của ô chữ — nhãn của `FormField` và link "Content" của dải báo trỏ vào nó. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy: string | undefined;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** Vùng chọn chờ đặt lại sau lần vẽ kế — chỉ có sau một cú bấm nút. */
  const pendingSelection = useRef<TextSelection | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  useLayoutEffect(() => {
    const next = pendingSelection.current;
    const node = textarea.current;
    if (next === null || node === null) return;
    pendingSelection.current = null;
    node.focus();
    node.setSelectionRange(next.start, next.end);
  });

  function run(action: MarkdownAction) {
    const node = textarea.current;
    if (node === null) return;
    const edit = applyMarkdownAction(
      value,
      { start: node.selectionStart, end: node.selectionEnd },
      action,
    );
    pendingSelection.current = edit.selection;
    onChange(edit.text);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next === 'preview' ? 'preview' : 'write')}
      className="gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="write">{t.write}</TabsTrigger>
          <TabsTrigger value="preview">{t.preview}</TabsTrigger>
        </TabsList>
        {tab === 'write' ? (
          <div role="toolbar" aria-label={t.toolbar} aria-controls={id} className="flex gap-1">
            {ACTIONS.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                title={label}
                // Giữ tiêu điểm (và vùng chọn) ở ô chữ khi bấm nút.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(action)}
              >
                <Icon aria-hidden="true" />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <TabsContent value="write">
        <Textarea
          ref={textarea}
          id={id}
          rows={18}
          className="font-mono text-sm"
          value={value}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="min-h-64 rounded-lg border p-4">
          {value.trim() === '' ? (
            <p className="text-sm text-muted-foreground">{t.previewEmpty}</p>
          ) : (
            <ArticleMarkdown markdown={value} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
