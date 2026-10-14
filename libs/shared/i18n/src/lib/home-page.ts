// Chữ của trang chủ (/) — W-09 (14/10) đưa chữ cứng trong component về đây theo luật 7.
// Module riêng và CỐ Ý không gắn vào `messages`: component của trang này hầu hết là client
// component, gắn vào `messages` thì chữ của riêng trang này chui vào chunk client dùng chung
// của MỌI trang (cùng lý do tách `resilience.ts`). Chỗ gọi import thẳng `homePage` từ
// `@tourism/i18n`.
//
// Khối xếp theo thứ tự các khu trên trang (`app/(site)/page.tsx`). Chữ dời NGUYÊN VĂN: đợt này
// không sửa câu nào, kể cả chỗ trang đang viết lẫn "travelers"/"travellers".
export const homePage = {
  hero: {
    badge: 'Small-group tours across Vietnam',
    title: 'Travel slow. The valley will wait.',
    subtitle:
      'Hand-picked journeys through limestone bays, terraced highlands, and lantern-lit old towns — led by people who grew up there.',
    primaryCta: 'View tours',
    /** Nút phụ in chữ HAI lần (hiệu ứng chữ trượt dọc khi hover) — cả hai bản dùng khoá này. */
    secondaryCta: 'Plan with us',
    imageLabel: 'Hero — Ha Long Bay panorama',
  },
  partners: {
    eyebrow: 'In good company — featured by travel storytellers worldwide',
    /** Dải chữ thay logo của báo/tổ chức du lịch; thứ tự mảng là thứ tự chạy trong marquee. */
    names: [
      'Lonely Planet',
      'TripAdvisor',
      'National Geographic',
      'Condé Nast Traveler',
      'Travel + Leisure',
      'CNN Travel',
      'BBC Travel',
      'The Guardian',
      'Culture Trip',
      'Vietnam Tourism Board',
    ],
  },
  stats: {
    eyebrow: 'Tours across Vietnam',
    title: 'Journeys shaped by the people who live them',
    body: 'From misty terraces in the north to river markets in the delta — every route is researched, walked, and retold by local guides before it reaches you.',
    cta: 'Explore tours',
    toursLabel: 'Hand-picked tours',
    travelersLabel: 'Happy travelers',
    satisfactionLabel: 'Traveler satisfaction',
  },
  /** Slider khoảnh khắc ở cột phải khu Stats. Tên và credit của từng khoảnh khắc là dữ liệu
      biên tập (`mocks/moments.ts`), nên hai nhãn dưới là hàm nhận chúng vào. */
  statsSlider: {
    label: 'Traveler moments',
    /** Giá trị `aria-roledescription`: trình đọc màn hình đọc nó thay tên vai trò, nên là chữ. */
    roleDescription: 'carousel',
    slideImageLabel: (title: string, credit: string) => `${title} — ${credit}`,
    slideLabel: (position: number, title: string) => `Slide ${position}: ${title}`,
  },
  gallery: {
    eyebrow: 'Destinations',
    title: 'From the northern mists to the southern delta',
    body: 'Nine places across three regions — scroll to travel the country from north to south.',
    /** CỐ Ý không chia số ít: W-09 chỉ dời chữ, đầu ra giữ y như cũ (kể cả "1 tours"). */
    tourCount: (count: number) => `${count} tours`,
  },
  whyChooseUs: {
    eyebrow: 'Why Nexora',
    title: 'Travel Vietnam with people who call it home',
    body: 'Our local guides bring insider knowledge and personal care to every departure, so your only job is to be there.',
    /** Chú thích ảnh khi chưa mở mục nào. */
    defaultImageLabel: 'Three regions in one country',
    /** Năm mục accordion, khoá trùng đuôi khe ảnh (`why-guide`, `why-food`…). Lý do chọn năm
        mục này ghi ở `why-choose-us.tsx`. */
    items: {
      guide: {
        title: 'Local guides on every route',
        description:
          'Every journey is led by someone who grew up on it. Paths, meals, and stories come from lived experience — not a script.',
      },
      food: {
        title: 'You eat where they eat',
        description:
          'No hotel buffets. You eat the dishes your guide grew up on — bún, phở, bánh — at the places they have gone to for years.',
      },
      river: {
        title: 'The country from the water',
        description:
          'Limestone bays in the north, delta canals in the south. Much of Vietnam only makes sense from a boat.',
      },
      evening: {
        title: 'Towns worth staying the evening for',
        description:
          'Day-trippers leave by four. Our evening routes start when the lanterns come on and the streets go back to the people who live there.',
      },
      heritage: {
        title: 'Heritage, not a plaque',
        description:
          'Citadels, tombs and pagodas explained by someone whose own family history runs through them — not read off a sign.',
      },
    },
  },
  testimonials: {
    eyebrow: 'Reviews',
    title: 'Trusted by travelers. Proven by stories.',
    body: 'Honest words from people who trusted us with their time off.',
    ratingSource: 'from 2,400+ travellers',
    avatarsMore: 'and thousands more',
  },
  journal: {
    eyebrow: 'Journal',
    titleLead: 'Notes from the road,',
    titleAccent: 'written by locals.',
    cta: 'Read all stories',
  },
  /** Ba huy hiệu tin cậy. Vì sao câu chữ viết đúng như vậy: xem chú thích ở `trust-strip.tsx`. */
  trustStrip: {
    items: {
      freeCancellation: {
        title: 'Free cancellation',
        detail: 'On every tour. Each departure shows its own deadline before you book.',
      },
      noFees: {
        title: 'No booking fees',
        detail: 'Your total is the tour price times travellers. Nothing is added at checkout.',
      },
      support: {
        title: 'A real person replies',
        detail: 'Within the hour, Monday to Friday, 8am–6pm (GMT+7).',
      },
    },
  },
  callToAction: {
    imageLabel: 'Banner — Mekong delta at dusk',
    eyebrow: 'Autumn departures open',
    titleLead: 'Find the journey',
    titleAccent: 'that fits your pace.',
    body: 'Limestone bays, misty terraces, imperial cities, and river markets — pick a region and let a local plan the rest. Small groups, no rush, no scripts.',
    primaryCta: 'Browse tours',
    secondaryCta: 'Talk to a local',
  },
  /** Form "Tell us your dates" cuối trang. Chữ đã có sẵn ở `messages.homeContact` (ô Region,
      nút lúc đang gửi, toast) ở lại đó; khối này chỉ giữ phần còn lại. */
  contact: {
    eyebrow: 'Contact',
    /** Dấu cách cuối là CỐ Ý: JSX cũ để nó ngay trước `<br />`, nên chữ của tiêu đề vẫn đọc
        "…dates, we’ll…" chứ không dính liền. */
    titleLead: 'Tell us your dates, ',
    titleRest: 'we’ll draw the route',
    fields: {
      name: { label: 'Your name', placeholder: 'Michael Anderson' },
      email: { label: 'Email address', placeholder: 'michael@example.com' },
      dates: { label: 'Travel dates', placeholder: 'E.g. Oct 12 – Oct 18' },
      message: { label: 'Message', placeholder: 'E.g. Two of us, easy pace, love food markets' },
    },
    submit: 'Get my itineraries',
    next: {
      eyebrow: 'What happens next',
      title: 'Three steps between you and the road',
      /** Mảng vì thứ tự là số bước 1-2-3 in trên badge. */
      steps: [
        {
          title: 'Tell us your dates',
          description: 'Share when, where, and how you like to travel.',
        },
        {
          title: 'Get itineraries in 24 hours',
          description: 'Local guides draft two or three routes around your pace.',
        },
        {
          title: 'Book when you love one',
          description: 'No payment until you approve the plan.',
        },
      ],
    },
    responseTimes: 'Mon–Fri within the hour · weekends same day',
  },
} as const;
