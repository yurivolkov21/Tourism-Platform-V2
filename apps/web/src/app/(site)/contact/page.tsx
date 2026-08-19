import type { Metadata } from 'next';
import { ContactCta } from '@/components/contact/contact-cta';
import { ContactFaq } from '@/components/contact/contact-faq';
import { ContactHero } from '@/components/contact/contact-hero';
import { ContactLocation } from '@/components/contact/contact-location';
import { ContactSplit } from '@/components/contact/contact-split';
import { siteMediaImage } from '@/lib/api/site-media';

// Trang Contact (static-first) — kế hoạch 5 section user duyệt 24/07:
// §1 Hero ngắn (Nexora ContentHero) · §2 Split form+info (ShadcnSpace Contact
// 01, form nâng từ Home + Select vùng) · §3 Location & hours (Nexora
// ContactLocation, map placeholder) · §4 Mini-FAQ (ShadcnSpace FAQ 01) ·
// §5 CTA 01 aurora (hồi sinh — tránh trùng CTA 02 video của /about).
// Section Contact trên Home GIỮ nguyên (Nexora cũng chạy song song).
export const metadata: Metadata = {
  title: 'Contact — Nexora',
  description: 'Tell us your dates and pace — a real person replies within the hour.',
};

export default async function ContactPage() {
  // Khe `contact-panel`: `null` khi chưa có ảnh — SlotImage tự rơi về giữ chỗ.
  const panelImage = await siteMediaImage('contact-panel');

  return (
    <>
      <ContactHero />
      <ContactSplit panelImage={panelImage} />
      <ContactLocation />
      <ContactFaq />
      <ContactCta />
    </>
  );
}
