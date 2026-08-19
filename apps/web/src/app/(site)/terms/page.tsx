import { messages, termsDoc } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Trang pháp lý MẪU của cụm — layout chốt ở đây rồi mới nhân sang
// /privacy và /cancellation-policy. Nội dung là LegalDoc trong @tourism/i18n.
export const metadata: Metadata = {
  title: `${messages.pageMeta.terms.title} — Nexora`,
  description: messages.pageMeta.terms.description,
};

export default function TermsPage() {
  return <LegalArticle doc={termsDoc} />;
}
