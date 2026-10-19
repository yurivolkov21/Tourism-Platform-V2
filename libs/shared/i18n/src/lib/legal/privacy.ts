import type { LegalDoc } from './legal-page.js';

/**
 * Privacy Statement — bám đúng cách nền tảng thực sự xử lý dữ liệu (tài khoản do API của chính
 * dự án quản qua Better Auth, mật khẩu chỉ lưu dạng hash trong DB Supabase, đăng nhập Google tuỳ
 * chọn; enquiry, booking, thanh toán Stripe/PayPal, email giao dịch qua Resend, media qua
 * Cloudinary; web ở Vercel, API ở Render — ADR-0024). Tên vận hành "Nexora" (đổi 19/08, trước là
 * "Tourism"); thông tin liên hệ khớp footer của site.
 *
 * W-01 (13/10): bản 25/07 nói Supabase lo đăng nhập và "we never see or store your password" — sai
 * từ khi xác thực chuyển sang Better Auth, và sai gấp đôi từ 09/09 khi Supabase Auth tắt hẳn.
 *
 * 19/10: trợ lý chat (P6, ADR-0050) bật trên production, tin khách gõ đi tới Anthropic để model
 * viết câu trả lời; DB lưu hội thoại và xoá sau 30 ngày không hoạt động (ADR-0050 §5). Ba mục
 * collect, use, share và mục chuyển dữ liệu ra nước ngoài phải kể việc này.
 */
export const privacyDoc: LegalDoc = {
  title: 'Privacy Statement',
  breadcrumb: 'Privacy Statement',
  updated: 'Last updated: 19 October 2026',
  reviewNote:
    'This document is sample content for a student capstone project, not legal advice. Nexora does not sell real trips here: payments run entirely in Stripe and PayPal test/sandbox mode, and no money changes hands.',
  intro: [
    'This Privacy Statement explains how Nexora (“we”, “us”, “our”) collects, uses, shares, and protects your personal information when you use this website, make an enquiry, or book a tour with us.',
    'We are the controller of the personal information described here. If you have any questions, contact us at tourism.platform.online@gmail.com.',
  ],
  sections: [
    {
      heading: 'Information we collect',
      paragraphs: ['We collect the following categories of personal information:'],
      bullets: [
        'Information you provide directly: your name, email address, and phone number; enquiry details such as nationality, travel dates, group size, budget range, and travel interests; booking details; reviews you submit; and newsletter sign-ups.',
        'Account information: if you create an account, your name, email address, and password. We store your password only as a one-way hash, never in readable form. If you choose to sign in with Google, Google shares your name, email address, and profile photo with us; we never receive your Google password.',
        'Trip-planning assistant: if you chat with our AI assistant, the messages you send and its replies. We keep each conversation for 30 days after its last message and then delete it. If you are signed in when the conversation starts, it is linked to your account. Your browser keeps a random ID for the conversation so the chat can reload it when you come back.',
        'Payment information: card and payment details are collected and processed directly by our payment providers (Stripe and PayPal). We do not store full card numbers on our systems — we only keep a reference to the transaction.',
        'Information collected automatically: device and usage data, IP address, browser type, and pages visited, gathered through cookies and similar technologies.',
      ],
    },
    {
      heading: 'How we use your information',
      paragraphs: ['We use your personal information to:'],
      bullets: [
        'Respond to your enquiries and prepare tour proposals;',
        'Answer your questions through our AI trip-planning assistant;',
        'Confirm, manage, and deliver your bookings, including arranging transport, accommodation, and guides;',
        'Process payments and prevent fraud;',
        'Send service messages such as booking confirmations, cancellation updates, and changes to your trip;',
        'Manage your account and the reviews or saved tours you create;',
        'Send marketing communications where you have consented, which you can opt out of at any time;',
        'Improve and secure our website and services, and comply with our legal obligations.',
      ],
    },
    {
      heading: 'Legal bases for processing',
      paragraphs: [
        'Where data-protection law such as the GDPR applies, we rely on the following legal bases: performance of a contract with you (to deliver bookings you request); your consent (for marketing and non-essential cookies); our legitimate interests (to run, secure, and improve our business, balanced against your rights); and compliance with legal obligations (such as tax and accounting).',
      ],
    },
    {
      heading: 'How we share your information',
      paragraphs: [
        'We do not sell or rent your personal information. We share it only as needed to provide our services, with:',
      ],
      bullets: [
        'Service providers who operate the platform on our behalf, including our hosting providers (Vercel for the website and Render for our servers), our database provider (Supabase), payment providers (Stripe and PayPal), our transactional email provider (Resend), and our media/image provider (Cloudinary);',
        'Anthropic, our AI provider, which receives the messages you send to the trip-planning assistant, together with the tour details the assistant looks up, in order to write its replies. Please do not share payment details or other sensitive information in the chat;',
        'Google, only if you choose to sign in with your Google account;',
        'Travel suppliers — such as hotels, transport operators, and local guides — strictly to the extent needed to deliver the trip you book;',
        'Professional advisers, and authorities or regulators where we are required to do so by law or to protect our rights.',
      ],
    },
    {
      heading: 'International data transfers',
      paragraphs: [
        'Some of our providers process data outside Vietnam, including our database, which is hosted in the Singapore region, and our AI provider, Anthropic, which is based in the United States. Where we transfer personal information internationally, we rely on appropriate safeguards such as standard contractual clauses or an adequacy decision. Contact us for more detail on the safeguards in place.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        'We use strictly necessary cookies to operate the site (for example, to keep you signed in), and, with your consent, analytics or similar technologies to understand how the site is used. You can control non-essential cookies through your browser settings. Blocking strictly necessary cookies may stop parts of the site, such as signing in, from working.',
      ],
    },
    {
      heading: 'How long we keep your information',
      paragraphs: [
        'We keep personal information only for as long as necessary for the purposes described above — for example, for the duration of your relationship with us and afterwards as required to meet legal, tax, accounting, or dispute-resolution obligations. When information is no longer needed, we securely delete or anonymise it.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Depending on where you live, you may have the right to access the personal information we hold about you; to correct inaccurate information; to request erasure; to restrict or object to certain processing; to data portability; and to withdraw consent at any time. You can update your details or delete your account directly from your account settings, or contact us at tourism.platform.online@gmail.com. You also have the right to lodge a complaint with your local data-protection authority.',
      ],
    },
    {
      heading: 'How we protect your information',
      paragraphs: [
        'We use technical and organisational measures to protect your personal information, including encryption in transit, reputable processors with their own security programmes, access controls, and the principle of least privilege. No method of transmission or storage is completely secure, but we work to protect your information and to respond promptly to any incident.',
      ],
    },
    {
      heading: 'Children’s privacy',
      paragraphs: [
        'Our services are intended for adults. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, contact us and we will delete it.',
      ],
    },
    {
      heading: 'Changes to this statement',
      paragraphs: [
        'We may update this Privacy Statement from time to time. We will post the updated version here and revise the “last updated” date above. Where changes are significant, we will take reasonable steps to notify you.',
      ],
    },
    {
      heading: 'Contact us',
      paragraphs: [
        'For any privacy question or to exercise your rights, contact us at tourism.platform.online@gmail.com, by phone at +84 24 3826 0126, or by post at Nexora, 184 Lê Đại Hành, Phú Thọ, Hồ Chí Minh City, Vietnam.',
      ],
    },
  ],
};
