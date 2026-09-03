import { AdminEnquiryByIdInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { ChevronLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { EnquiryNoteForm } from '@/components/enquiries/note-form';
import { EnquiryStatusPanel } from '@/components/enquiries/status-panel';
import { Timeline, TimelineItem } from '@/components/kit/timeline';
import { fetchAdminEnquiry } from '@/lib/api/enquiries';
import { getServerSession } from '@/lib/api/session';
import { formatDateTime } from '@/lib/bookings-view';
import { enquiriesBackHref } from '@/lib/enquiries-query';
import {
  type EnquiryDetailVM,
  enquiryStatusBadgeVariant,
  enquiryStatusLabel,
  toEnquiryDetailVM,
} from '@/lib/enquiries-view';
import type { RawSearchParams } from '@/lib/table-query';
import { addEnquiryNoteAction, setEnquiryStatusAction } from './actions';

/**
 * `/enquiries/[id]` — một lead đầy đủ (spec P4c §3-F9): thẻ thông tin, message
 * nguyên văn của khách, ô đổi trạng thái (hành vi ghi 1), thread note
 * append-only kèm form thêm (hành vi ghi 2), và lịch sử trạng thái.
 *
 * Thứ tự các khối theo dòng làm việc THẬT của người dùng: đọc lead → đọc
 * khách viết gì → quyết định (đổi trạng thái) → ghi lại vì sao (note) → soi
 * lại đã đi qua những đâu (lịch sử). Hai khối HÀNH ĐỘNG đứng trên khối DẤU
 * VẾT, cùng nếp `/bookings/[code]` (ô refund trên lịch sử huỷ).
 *
 * `id` từ URL đi qua CHÍNH schema contract trước khi fetch: một đoạn rác trên
 * đường dẫn là `notFound()` của Next chứ không phải một 400 từ API vẽ ra màn
 * hình lỗi chung.
 */
const t = messages.admin.enquiries;

/**
 * Tiêu đề tab CỐ ĐỊNH: lấy tên lead sẽ tốn một request thứ hai chỉ để in một
 * chuỗi lên tab — và tên khách là PII, không cần nằm trong lịch sử duyệt web
 * lẫn tiêu đề cửa sổ đang chia sẻ màn hình.
 */
export const metadata: Metadata = {
  title: 'Enquiry — Nexora back office',
};

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const parsed = AdminEnquiryByIdInputSchema.safeParse({ id });
  if (!parsed.success) notFound();
  // Đường VỀ đúng trang bảng đã mở lead này (vòng vá review F9) — chỉ nhận
  // đường nội bộ `/enquiries…`, còn lại về mục nav mặc định.
  const backHref = enquiriesBackHref((await searchParams).back);

  const cookie = (await cookies()).toString();
  // Session (nav-user) và chi tiết lead độc lập nhau — song song cho khỏi tốn
  // 2 RTT nối tiếp (nếp `/bookings/[code]`).
  const [session, enquiry] = await Promise.all([
    getServerSession(),
    fetchAdminEnquiry(cookie, parsed.data),
  ]);
  if (!session) return null;
  if (!enquiry) notFound();

  const vm = toEnquiryDetailVM(enquiry);

  return (
    <AdminShell user={session}>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ChevronLeftIcon className="size-4" />
          {t.detail.back}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{enquiry.name}</h2>
          <Badge variant={enquiryStatusBadgeVariant(enquiry.status)}>
            {enquiryStatusLabel(enquiry.status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t.detail.received} {formatDateTime(enquiry.createdAt)}
          </span>
          <span className="text-sm text-muted-foreground">
            · {t.detail.updated} {formatDateTime(enquiry.updatedAt)}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.detail.lead.heading}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {/* Field trống đã bị `toEnquiryDetailVM` bỏ hẳn khỏi danh sách:
                  form công khai có bảy field optional, in gạch ngang cho cả
                  bảy sẽ che mất đúng hai dòng có chữ. */}
              <dl className="grid gap-2 text-sm">
                {vm.leadFields.map((field) => (
                  <div key={field.label} className="grid grid-cols-[8rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="break-words">{field.value}</dd>
                  </div>
                ))}
              </dl>
              {vm.interests.length > 0 ? (
                <div className="grid gap-1.5">
                  <span className="text-sm text-muted-foreground">{t.detail.lead.interests}</span>
                  {/* Multi-select TỰ DO của form công khai — in NGUYÊN chuỗi,
                      không map sang nhãn: một giá trị mới thêm ở web phải
                      hiện ra được ngay, và chuỗi thô nói nhiều hơn "Unknown"
                      (cùng luật với cột `type` của payment events). */}
                  <div className="flex flex-wrap gap-1.5">
                    {vm.interests.map((interest) => (
                      // Key là chính giá trị: multi-select của form công khai
                      // sinh ra tập KHÔNG trùng, và danh sách này không sắp
                      // xếp lại bao giờ (server render một lần, không state).
                      <Badge key={interest} variant="outline">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.detail.message.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* NGUYÊN VĂN khách gõ: `whitespace-pre-wrap` giữ xuống dòng,
                  `break-words` chặn một chuỗi dài không dấu cách kéo giãn cả
                  thẻ. Không cắt ngắn — đây là lý do trang chi tiết tồn tại. */}
              <p className="whitespace-pre-wrap break-words text-sm">{enquiry.message}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.setStatus.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* `key` theo trạng thái hiện tại: sau mỗi lần ghi thành công +
                `router.refresh()`, ô Select sinh lại từ trạng thái MỚI thay
                vì giữ một lựa chọn đã cũ. */}
            <EnquiryStatusPanel
              key={enquiry.status}
              id={enquiry.id}
              name={enquiry.name}
              status={enquiry.status}
              setStatus={setEnquiryStatusAction}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.detail.notes.heading}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Nói TRƯỚC khi người ta gõ, không phải sau khi đã gửi. */}
            <p className="text-sm text-muted-foreground">{t.detail.notes.hint}</p>
            <NoteThread notes={vm.notes} />
            <EnquiryNoteForm id={enquiry.id} addNote={addEnquiryNoteAction} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.detail.history.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusHistory events={vm.statusEvents} />
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

/** Thread append-only, CŨ TRƯỚC — đọc như một cuộc trò chuyện (kit `Timeline`). */
function NoteThread({ notes }: { notes: EnquiryDetailVM['notes'] }) {
  return (
    <Timeline empty={t.detail.notes.empty}>
      {notes.map((note) => (
        <TimelineItem key={note.id}>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>{note.author}</span>
            <span>· {note.at}</span>
          </div>
          <p className="whitespace-pre-wrap break-words">{note.body}</p>
        </TimelineItem>
      ))}
    </Timeline>
  );
}

/** Lịch sử trạng thái append-only, cũ trước — cùng khung với thread note. */
function StatusHistory({ events }: { events: EnquiryDetailVM['statusEvents'] }) {
  return (
    <Timeline empty={t.detail.history.empty}>
      {events.map((event) => (
        <TimelineItem key={event.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{event.change}</span>
            <span className="text-muted-foreground">{event.author}</span>
            <span className="text-muted-foreground">· {event.at}</span>
          </div>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
