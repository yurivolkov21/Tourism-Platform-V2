import type { LegalDoc } from './legal-page.js';

/**
 * Terms & Conditions — tour-operator booking terms grounded in the platform's actual flow
 * (enquiry → confirmation, deposit/balance, Stripe/PayPal payment, supplier-delivered services).
 * Operating name "Nexora"; governed by the laws of Vietnam. Cancellation specifics live in the
 * dedicated Cancellation & Refund Policy.
 */
export const termsDoc: LegalDoc = {
  title: 'Terms & Conditions',
  breadcrumb: 'Terms & Conditions',
  updated: 'Last updated: 29 June 2026',
  intro: [
    'These Terms & Conditions govern the booking and provision of tours and travel services by Nexora (“we”, “us”, “our”). They form a binding agreement between us and the person making the booking (“you”), who accepts these terms on behalf of everyone in the booking.',
    'Please read them carefully before you book. By placing a booking you confirm that you have read, understood, and agree to these terms.',
  ],
  sections: [
    {
      heading: 'Booking and your contract',
      paragraphs: [
        'You can request a tour through an enquiry or an online booking. A contract is formed only when we confirm your booking in writing (for example, by a confirmation email) and you have paid the required deposit or full amount.',
        'You must be at least 18 years old and have the authority to book for every member of your party. You are responsible for ensuring the accuracy of the information you give us and for passing our communications on to your party.',
      ],
    },
    {
      heading: 'Prices, inclusions and payment',
      paragraphs: [
        'Prices are shown in the currency stated at the time of booking (for example, USD or VND) and apply to the services described on the relevant tour. Inclusions and exclusions are listed on each tour; anything not listed is not included.',
        'Depending on the tour, we may require a deposit to confirm your booking, with the balance due before departure as set out in your confirmation. Payments are processed securely through our payment providers (Stripe and PayPal); we do not store your full card details. Prices may change before your booking is confirmed; once confirmed, the agreed price is fixed except where a change is permitted by these terms.',
      ],
    },
    {
      heading: 'Changes by you',
      paragraphs: [
        'If you wish to change a confirmed booking — such as dates, the itinerary, or party members — we will try to accommodate the request subject to availability. Changes may incur supplier charges and an amendment fee, which we will tell you about before any change is made.',
      ],
    },
    {
      heading: 'Cancellations and refunds by you',
      paragraphs: [
        'If you need to cancel, request it from your account (open the booking under “My bookings” and choose “Request cancellation”) or contact our team. Our team reviews each request and arranges any refund to your original payment method.',
        'As a general guide, cancellations 30 or more days before departure are refunded in full less any non-recoverable supplier costs; 15–29 days before, around half; and fewer than 14 days before, the booking is usually non-refundable. These are guidelines — the exact outcome depends on the tour and any supplier costs already committed, and some payments (such as non-refundable deposits or third-party fees) may not be recoverable. The full details are in our Cancellation & Refund Policy.',
      ],
    },
    {
      heading: 'Changes or cancellation by us',
      paragraphs: [
        'We plan trips carefully, but occasionally we may need to change an itinerary — for example, for safety, weather, or operational reasons. We will tell you about any significant change as soon as possible.',
        'If we have to cancel your tour for reasons within our control, you may choose an alternative departure of equivalent value or a full refund of what you have paid us. Except as required by law, we are not liable for incidental expenses you may have incurred (such as flights or visas).',
      ],
    },
    {
      heading: 'Your responsibilities',
      paragraphs: [
        'You are responsible for holding a valid passport, any required visas, and any vaccinations or health documents needed for your trip, and for arriving on time for each service. We can offer general guidance, but requirements are your responsibility and vary by nationality and destination.',
        'You agree to behave responsibly and to follow the reasonable instructions of guides and suppliers. We may decline to carry or may remove anyone whose behaviour endangers others, without refund.',
      ],
    },
    {
      heading: 'Travel insurance',
      paragraphs: [
        'We strongly recommend — and for some tours require — that you hold comprehensive travel insurance covering at least trip cancellation and curtailment, medical and repatriation costs, and personal baggage, valid for the whole of your trip and suitable for the activities involved.',
      ],
    },
    {
      heading: 'Health, fitness and special requirements',
      paragraphs: [
        'Some tours involve physical activity such as trekking or boarding boats. You should make sure each member of your party is fit to take part, and tell us in advance about any medical condition, disability, or dietary or accessibility requirement so we can advise on suitability and, where possible, make arrangements.',
      ],
    },
    {
      heading: 'Suppliers',
      paragraphs: [
        'Some elements of your trip are provided by independent suppliers — such as hotels, transport operators, and local guides — who may have their own terms and conditions. We select suppliers with care, and those terms apply to the services they provide.',
      ],
    },
    {
      heading: 'Our liability',
      paragraphs: [
        'We will provide our services with reasonable skill and care. We are not liable for failures or delays caused by events beyond our reasonable control, or by you or a third party unconnected with the services. To the extent permitted by law, our total liability in connection with a booking is limited to the price paid for the affected services. Nothing in these terms excludes or limits any liability that cannot be excluded or limited under applicable law, including for death or personal injury caused by negligence.',
      ],
    },
    {
      heading: 'Force majeure',
      paragraphs: [
        'We are not responsible for any failure to perform our obligations where this is caused by circumstances beyond our reasonable control, including natural disasters, severe weather, epidemics or pandemics, government action, civil unrest, strikes, or transport disruption.',
      ],
    },
    {
      heading: 'Complaints',
      paragraphs: [
        'If a problem arises during your trip, please tell your guide or our team straight away so we can try to resolve it on the spot. If the matter is not resolved, contact us in writing within 30 days of returning, and we will respond as quickly as we can.',
      ],
    },
    {
      heading: 'Intellectual property',
      paragraphs: [
        'The content of this website — including text, images, logos, and design — belongs to us or our licensors and is protected by intellectual-property laws. You may not copy or reuse it without our permission, except as allowed by law.',
      ],
    },
    {
      heading: 'Privacy',
      paragraphs: [
        'We handle your personal information in line with our Privacy Statement, which explains what we collect and how we use it. Please read it together with these terms.',
      ],
    },
    {
      heading: 'Governing law and jurisdiction',
      paragraphs: [
        'These terms and any dispute arising from them are governed by the laws of Vietnam, and you and we submit to the exclusive jurisdiction of the courts of Hồ Chí Minh City, Vietnam, except where applicable consumer law gives you the right to bring proceedings elsewhere.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'We may update these terms from time to time. The version in force at the time you book applies to your booking. The latest version is always available on this page.',
      ],
    },
    {
      heading: 'Contact us',
      paragraphs: [
        'For any question about these terms or your booking, contact us at tourism.platform.online@gmail.com, by phone at 1900 292 958, or by post at Nexora, 184 Lê Đại Hành, Phú Thọ, Hồ Chí Minh City, Vietnam.',
      ],
    },
  ],
};
