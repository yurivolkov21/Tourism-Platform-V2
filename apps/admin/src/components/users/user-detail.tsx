import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@tourism/ui/components/avatar';
import { Badge } from '@tourism/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { LabelValueRow } from '@/components/kit/label-value-row';
import { Timeline, TimelineItem } from '@/components/kit/timeline';
import type { UserDetailVM } from '@/lib/users-view';

/**
 * Trang chi tiết một tài khoản (P4f, spec §7.2) — component thường: trang chỉ fetch rồi
 * truyền VM xuống (plan P4f, quyết định 16). Thứ tự khối theo dòng làm việc thật: ai đây
 * (đầu trang, Profile, Activity) → làm được gì (Access, Lock, Sessions) → đã làm gì
 * (History). Ba card giữa có khe `action` ở góc phải đầu card — chỗ của nút thao tác.
 */
const t = messages.admin.users;

export function UserDetail({ detail, backHref }: { detail: UserDetailVM; backHref: string }) {
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.detail.back}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <Avatar className="size-10">
          {/* Ảnh trang trí — tên đứng ngay cạnh nên alt rỗng. */}
          {detail.image ? <AvatarImage src={detail.image} alt="" /> : null}
          <AvatarFallback>{detail.initial}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-semibold tracking-tight">{detail.name}</h2>
        <Badge variant={detail.roleVariant}>{detail.roleLabel}</Badge>
        <Badge variant={detail.statusVariant}>{detail.statusLabel}</Badge>
        <span className="text-sm text-muted-foreground">{detail.joined}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title={t.detail.profile.heading}>
          <dl className="grid gap-2">
            {detail.profile.map((field) => (
              <LabelValueRow key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
        </DetailCard>
        <DetailCard title={t.detail.activity.heading}>
          <dl className="grid gap-2">
            {detail.activity.map((field) => (
              <LabelValueRow key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
          {detail.bookingsHref ? (
            <Link href={detail.bookingsHref} className="w-fit underline underline-offset-4">
              {t.detail.activity.viewBookings}
            </Link>
          ) : null}
        </DetailCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {detail.isOwner ? (
          <DetailCard title={t.detail.access.heading}>
            <p className="text-muted-foreground">{t.detail.owner}</p>
          </DetailCard>
        ) : (
          <DetailCard title={t.detail.access.heading}>
            <p className="text-muted-foreground">{detail.accessNote}</p>
          </DetailCard>
        )}
        {/* Owner chỉ có card Lock khi ĐANG khoá — đường mở khoá duy nhất của ca hiếm ấy. */}
        {!detail.isOwner || detail.lockedSince ? (
          <DetailCard title={t.detail.lock.heading}>
            {detail.lockedSince ? (
              <>
                <p>{detail.lockedSince}</p>
                {detail.lockReason ? (
                  <p className="text-muted-foreground">{detail.lockReason}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">{t.detail.lock.unlocked}</p>
            )}
          </DetailCard>
        ) : null}
        {detail.isOwner ? null : (
          <DetailCard title={t.detail.sessions.heading}>
            <dl className="grid gap-2">
              <LabelValueRow label={t.detail.sessions.active} value={detail.sessions.active} />
              <LabelValueRow
                label={t.detail.sessions.lastActive}
                value={detail.sessions.lastActive}
              />
            </dl>
          </DetailCard>
        )}
      </div>

      <DetailCard title={t.history.heading}>
        <Timeline empty={t.history.empty}>
          {detail.history.map((event) => (
            <TimelineItem key={event.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.line}</span>
                <span className="text-muted-foreground">· {event.at}</span>
              </div>
              {event.reason ? <p className="text-muted-foreground">{event.reason}</p> : null}
            </TimelineItem>
          ))}
        </Timeline>
      </DetailCard>
    </div>
  );
}

/** Một card của trang: tiêu đề, khe nút ở góc phải (cùng nếp `RefundPanel`), thân chữ nhỏ. */
function DetailCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">{children}</CardContent>
    </Card>
  );
}
