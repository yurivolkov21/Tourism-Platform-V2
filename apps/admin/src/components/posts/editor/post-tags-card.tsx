'use client';

import { type AdminPostTag, POST_TAG_NAME_MAX, POST_TAGS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { type AddTagResult, addTag, tagSuggestions } from '@/lib/post-pickers';

/**
 * Card Tags (spec P4e-4 §4.4, ADR-0051 §5): tag gõ thẳng, Enter để thêm; tag chưa có được
 * tạo lúc LƯU (phía API). Gợi ý là nút bấm, không Combobox nổi (Quyết định 13).
 *
 * Ô nhập KHÔNG bao giờ bị khoá, kể cả khi đủ 5 — khoá ô đang có tiêu điểm là đẩy tiêu điểm
 * về `<body>`; thay vào đó lần thêm thứ sáu nói rõ trần (bài học 10).
 */
const g = messages.admin.posts.editor.tags;
// Biome coi mọi lời gọi `use…(…)` là hook (lint/correctness/useHookAtTopLevel); khoá copy
// `useSuggestion` chỉ là hàm dựng nhãn, nên gọi qua một tên khác.
const suggestionLabel = g.useSuggestion;

function problemCopy(
  reason: Exclude<AddTagResult, { ok: true }>['reason'],
  name: string,
): string | null {
  switch (reason) {
    case 'empty':
      return null;
    case 'invalid':
      return g.invalid;
    case 'tooLong':
      return g.tooLong(POST_TAG_NAME_MAX);
    case 'duplicate':
      return g.duplicate(name.trim());
    case 'full':
      return g.full(POST_TAGS_MAX);
  }
}

export function PostTagsCard({
  tags,
  options,
  onChange,
}: {
  tags: string[];
  /** Mọi tag sẵn có kèm số bài (`admin.posts.tags`); hỏng thì rỗng. */
  options: readonly AdminPostTag[];
  onChange: (tags: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const suggestions = tags.length >= POST_TAGS_MAX ? [] : tagSuggestions(options, tags, draft);

  function add(name: string) {
    const result = addTag(tags, name);
    if (!result.ok) {
      setProblem(problemCopy(result.reason, name));
      return;
    }
    onChange(result.tags);
    setDraft('');
    setProblem(null);
    input.current?.focus();
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{g.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((name, index) => (
              <li key={name}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    aria-label={g.remove(name)}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => {
                      onChange(tags.filter((_, other) => other !== index));
                      input.current?.focus();
                    }}
                  >
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <FormField
          id="post-tag-input"
          label={g.inputLabel}
          hint={g.hint(POST_TAGS_MAX)}
          error={problem ?? undefined}
        >
          {(describedBy) => (
            <div className="flex gap-2">
              <Input
                ref={input}
                id="post-tag-input"
                value={draft}
                aria-describedby={describedBy}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setProblem(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  add(draft);
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => add(draft)}>
                {g.add}
              </Button>
            </div>
          )}
        </FormField>

        {suggestions.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">{g.suggestions}</p>
            <ul className="flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <li key={tag.slug}>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label={suggestionLabel(tag.name)}
                    onClick={() => add(tag.name)}
                  >
                    {tag.name}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
