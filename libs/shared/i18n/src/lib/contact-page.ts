// Chữ của trang Contact (/contact) — W-09 (14/10) đưa chữ cứng trong component về đây theo luật 7.
// Module riêng và CỐ Ý không gắn vào `messages`: component của trang này hầu hết là client
// component, gắn vào `messages` thì chữ của riêng trang này chui vào chunk client dùng chung
// của MỌI trang (cùng lý do tách `resilience.ts`). Chỗ gọi import thẳng `contactPage` từ
// `@tourism/i18n`.
//
// Quy ước `titleLead` / `titleAccent`: heading tách hai khúc vì khúc sau nằm trong <span>
// accent. `titleAccent` mở đầu bằng dấu cách là CỐ Ý — dấu cách đó vốn nằm TRONG span, đưa ra
// ngoài là đổi cấu trúc DOM. Riêng hero không có dấu cách vì khúc accent đứng sau <br />.
export const contactPage = {
  /**
   * §1 hero (`contact-hero.tsx`). Chữ "Home" và nhãn của breadcrumb dùng `messages.common.home`
   * và `messages.common.breadcrumbLabel`, không lặp lại ở đây.
   */
  hero: {
    breadcrumbCurrent: 'Contact',
    titleLead: 'Talk to a human,',
    titleAccent: 'not a hotline.',
    intro: 'Tell us your dates and pace — a real person replies within the hour, Monday to Friday.',
    presence: 'Mai is on replies today — average answer: 47 minutes',
  },
  /** §2 card chia đôi (`contact-split.tsx`): panel ảnh bên trái, "lá thư" bên phải. */
  split: {
    panel: {
      /** Nhãn của ô giữ chỗ khi khe ảnh `contact-panel` còn trống. */
      imageLabel: 'Contact — the people who answer',
      eyebrow: 'We can help',
      titleLead: 'Let’s plan your dates',
      titleAccent: ' before the seats go.',
      intro:
        'Tell us your dates and pace. A real person reads every letter and writes back — no bots on this side.',
      /**
       * Nhãn các dòng thông tin liên hệ. Số điện thoại, email và địa chỉ là dữ liệu, lấy từ
       * `lib/site` và mock OFFICES.
       */
      details: {
        phone: 'Phone',
        email: 'Email',
        responseTime: 'Response time',
        responseTimeValue: 'Within the hour · Mon–Fri, 8am–6pm',
        headquarters: 'Headquarters',
      },
    },
    /**
     * Form "lá thư". Lỗi validate, chữ "đang gửi" và toast ở `messages.contactForm`; nhãn ô bẫy bot
     * là `messages.common.honeypotLabel`; lựa chọn "Anywhere in Vietnam" dùng chung
     * `messages.homeContact.regionAny` với form trang chủ (cùng lựa chọn `any` của một trường).
     */
    letter: {
      /** Chữ trên tem thư — user chốt giữ nguyên 06/08 (nợ A5), đừng đổi chữ. */
      stamp: 'Hà Nội · Sa Pa',
      eyebrow: 'Write us a letter',
      greeting: 'Hello Nexora,',
      count: { label: 'How many of you?', placeholder: '2 travellers' },
      dates: { label: 'When are you free?', placeholder: 'Oct 12 – 18' },
      region: { legend: 'Where are you dreaming of?' },
      loves: {
        label: 'What do you love when travelling?',
        placeholder: 'Easy pace, food markets, a free afternoon now and then…',
      },
      email: { label: 'Where do we write back?', placeholder: 'michael@example.com' },
      signOff: 'Yours,',
      /** Nhãn chỉ cho trình đọc màn hình (sr-only); placeholder là chữ khách thấy ở dòng ký tên. */
      name: { label: 'Your name', placeholder: 'Your name' },
      submit: 'Send the letter',
      postscript: 'P.S. A human reads every letter — no bots on this side.',
    },
  },
  /** §3 hai văn phòng (`contact-location.tsx`); eyebrow ở `messages.contactLocation.eyebrow`. */
  location: {
    titleLead: 'Two doors,',
    titleAccent: ' always open.',
    getDirections: 'Get directions →',
  },
  /** Nút zoom tự vẽ trên bản đồ (`contact-map.tsx`) — chỉ là aria-label, nút chỉ có icon. */
  map: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
  /**
   * Ghi công tile (`map-attribution.tsx`): chỉ có chữ nối. Ba tên nguồn (OpenFreeMap,
   * © OpenMapTiles, OpenStreetMap) CỐ Ý nằm lại trong component cạnh URL của chúng — đó là tên
   * ghi công bắt buộc theo licence (ADR-0018), không phải copy để dịch hay viết lại.
   */
  mapAttribution: {
    dataFrom: 'Data from',
  },
  /** §4 mini-FAQ (`contact-faq.tsx`); câu hỏi và câu trả lời là dữ liệu biên tập ở FAQ_ITEMS. */
  faq: {
    eyebrow: 'Before you write',
    titleLead: 'Five answers,',
    titleAccent: ' saved you an email.',
    /**
     * Câu bị link cắt làm ba khúc: `lead`, rồi dấu cách (giữ ở JSX là `{' '}`), rồi `link` (chữ
     * của link sang /faq), rồi `end` là dấu chấm đứng sau link.
     */
    intro: {
      lead: 'The questions every traveller asks first —',
      link: 'see the full list',
      end: '.',
    },
  },
  /** §5 CTA cuối trang (`contact-cta.tsx`). */
  cta: {
    titleLead: 'The road is ready',
    titleAccent: ' when you are.',
    body: 'Small groups, three regions, and people who grew up on every path. Pick a journey and let the country set the pace.',
    browseTours: 'Browse the tours',
  },
} as const;
