import { cancellationDoc, messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Cùng khung với /terms — chỉ đổi LegalDoc.
export const metadata: Metadata = {
  title: messages.pageMeta.withBrand(messages.pageMeta.cancellation.title),
  description: messages.pageMeta.cancellation.description,
};

export default function CancellationPolicyPage() {
  return <LegalArticle doc={cancellationDoc} />;
}
