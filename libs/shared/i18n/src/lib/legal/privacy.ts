import type { LegalDoc } from './legal-page.js';

/**
 * Privacy Statement — grounded in the platform's actual data practices (account auth via Supabase,
 * enquiries, bookings, payments via Stripe/PayPal, transactional email via Resend, media via
 * Cloudinary). Operating name "Nexora"; contact details match the site footer.
 */
export const privacyDoc: LegalDoc = {
  title: 'Privacy Statement',
  breadcrumb: 'Privacy Statement',
  updated: 'Last updated: 29 June 2026',
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
        'Account information: if you create an account, your email and authentication details. Sign-in is handled by our authentication provider (Supabase); we never see or store your password.',
        'Payment information: card and payment details are collected and processed directly by our payment providers (Stripe and PayPal). We do not store full card numbers on our systems — we only keep a reference to the transaction.',
        'Information collected automatically: device and usage data, IP address, browser type, and pages visited, gathered through cookies and similar technologies.',
      ],
    },
    {
      heading: 'How we use your information',
      paragraphs: ['We use your personal information to:'],
      bullets: [
        'Respond to your enquiries and prepare tour proposals;',
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
        'Service providers who operate the platform on our behalf, including our hosting, database, and authentication provider (Supabase), payment providers (Stripe and PayPal), our transactional email provider (Resend), and our media/image provider (Cloudinary);',
        'Travel suppliers — such as hotels, transport operators, and local guides — strictly to the extent needed to deliver the trip you book;',
        'Professional advisers, and authorities or regulators where we are required to do so by law or to protect our rights.',
      ],
    },
    {
      heading: 'International data transfers',
      paragraphs: [
        'Some of our providers process data outside Vietnam, including our database, which is hosted in the Singapore region. Where we transfer personal information internationally, we rely on appropriate safeguards such as standard contractual clauses or an adequacy decision. Contact us for more detail on the safeguards in place.',
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
        'For any privacy question or to exercise your rights, contact us at tourism.platform.online@gmail.com, by phone at 1900 292 958, or by post at Nexora, 184 Lê Đại Hành, Phú Thọ, Hồ Chí Minh City, Vietnam.',
      ],
    },
  ],
};
