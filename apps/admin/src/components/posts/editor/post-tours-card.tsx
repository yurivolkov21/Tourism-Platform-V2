'use client';

import { POST_RELATED_TOURS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import type { PostTourDraft, PostTourOption } from '@/lib/post-form';
import { addTour, tourMatches } from '@/lib/post-pickers';

/**
 * Card Related tours (spec P4e-4 §4.4, ADR-0051 §5): tối đa 3, có thứ tự (lên/xuống/gỡ của
 * kit `ListEditor`), thêm bằng ô tìm theo tiêu đề. Tour đang tắt bán vẫn chọn được, mang
 * nhãn Off sale — web chỉ hiện tour đang bán.
 *
 * Đủ 3 thì ô tìm chỉ còn ĐỌC chứ không biến mất hay bị khoá: thêm tour thứ ba xong tiêu
 * điểm còn đứng ở ô ấy (bài học 10). Gỡ dòng cuối thì tiêu điểm về ô tìm (`emptyFocus`).
 */
const r = messages.admin.posts.editor.tours;

export function PostToursCard({
  tours,
  options,
  serverError,
  onChange,
}: {
  tours: PostTourDraft[];
  /** Mọi tour (cả tắt bán) — `fetchPostTourOptions` nạp một lần ở server. */
  options: readonly PostTourOption[];
  /** Câu báo `RELATED_TOUR_NOT_FOUND` của lần lưu vừa rồi — `null` khi không có. */
  serverError: string | null;
  onChange: (tours: PostTourDraft[]) => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const full = tours.length >= POST_RELATED_TOURS_MAX;
  const matches = full ? [] : tourMatches(options, tours, query);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{r.title}</CardTitle>
        <CardDescription>{r.intro}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ListEditor
          items={tours}
          onChange={onChange}
          max={POST_RELATED_TOURS_MAX}
          itemName={(index) => r.itemName(index + 1)}
          empty={r.empty}
          emptyFocus={search}
          renderItem={(tour) => (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm">{tour.title}</span>
              {tour.isPublished ? null : <Badge variant="outline">{r.offSale}</Badge>}
            </div>
          )}
        />
        {tours.some((tour) => !tour.isPublished) ? (
          <p className="text-xs text-muted-foreground">{r.offSaleNote}</p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {serverError}
          </p>
        ) : null}

        <FormField
          id="post-tour-search"
          label={r.searchLabel}
          hint={full ? r.full(POST_RELATED_TOURS_MAX) : undefined}
        >
          {(describedBy) => (
            <Input
              ref={search}
              id="post-tour-search"
              type="search"
              placeholder={r.searchPlaceholder}
              readOnly={full}
              value={query}
              aria-describedby={describedBy}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </FormField>
        {query.trim() !== '' && !full ? (
          matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">{r.noMatch}</p>
          ) : (
            <ul className="grid gap-1">
              {matches.map((tour) => (
                <li key={tour.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    aria-label={r.add(tour.title)}
                    onClick={() => {
                      onChange(addTour(tours, tour));
                      setQuery('');
                      search.current?.focus();
                    }}
                  >
                    <PlusIcon aria-hidden="true" />
                    <span className="truncate">{tour.title}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
