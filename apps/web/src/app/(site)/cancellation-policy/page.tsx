import { cancellationDoc, messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';
import { RefundProcess } from '@/components/legal/refund-process';

// Cùng khung với /terms, thêm sơ đồ 3 chặng ngay sau phần mở đầu: trang này
// là trang DUY NHẤT trong cụm mà nội dung vốn là một quy trình tuần tự.
export const metadata: Metadata = {
  title: `${messages.pageMeta.cancellation.title} — Tourism`,
  description: messages.pageMeta.cancellation.description,
};

export default function CancellationPolicyPage() {
  return <LegalArticle doc={cancellationDoc} afterIntro={<RefundProcess />} />;
}
