import { messages, privacyDoc } from '@tourism/i18n';
import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/legal-article';

// Cùng khung với /terms — chỉ đổi LegalDoc.
export const metadata: Metadata = {
  title: `${messages.pageMeta.privacy.title} — Tourism`,
  description: messages.pageMeta.privacy.description,
};

export default function PrivacyPage() {
  return <LegalArticle doc={privacyDoc} />;
}
