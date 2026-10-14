// Chữ của trang About (/about) — W-09 (14/10) đưa chữ cứng trong component về đây theo luật 7.
// Module riêng và CỐ Ý không gắn vào `messages`: component của trang này hầu hết là client
// component, gắn vào `messages` thì chữ của riêng trang này chui vào chunk client dùng chung
// của MỌI trang (cùng lý do tách `resilience.ts`). Chỗ gọi import thẳng `aboutPage` từ
// `@tourism/i18n`.
//
// Mỗi khối ứng với một component trong `components/about/`, xếp theo thứ tự trên trang. Tiêu đề
// hai mảnh tách `titleLead` và `titleAccent` (mảnh in nghiêng màu nhấn) như `authForms`: khoảng
// trắng hay `<br />` giữa hai mảnh do JSX lo, nên không chuỗi nào mang khoảng trắng ở mép. Số
// liệu, icon, khoá khe ảnh và href ở lại component.
export const aboutPage = {
  // §1 Hero — `about-hero.tsx`. Chữ "Scroll" của chỉ báo cuộn KHÔNG ở đây: nó dùng chung
  // `messages.common.scrollHint` với hero trang vùng.
  hero: {
    imageLabel: 'About hero — guide leading trekkers, Sa Pa',
    badge: 'The people behind the paths',
    // Heading ba dòng, mỗi dòng một `RevealLine`; dòng giữa là mảnh in nghiêng màu nhấn.
    titleLead: 'Slow travel,',
    titleAccent: 'crafted by locals,',
    titleTail: 'since 2014.',
    intro:
      'Nexora began as three guides and one minivan in Sa Pa. Today we run small-group journeys across all three regions — still no scripts, still no rush.',
    browseTours: 'Browse tours',
    meetTeam: 'Meet the team',
    // Nhãn của hàng 3 số dưới nút; số và hậu tố (+, %) ở lại component.
    stats: {
      years: 'Years on the road',
      travellers: 'Travellers hosted',
      wouldGoAgain: 'Would go again',
    },
  },
  // §2 Story — `about-story.tsx`.
  story: {
    imageLabel: 'Story — the first minivan, Sa Pa 2014',
    // Hộp nổi "12+" đè góc ảnh: hai dòng cách nhau bằng `<br />`.
    yearsBadge: {
      top: 'Years',
      bottom: 'on the road',
    },
    eyebrow: 'Our story',
    titleLead: 'We don’t sell tours.',
    titleAccent: 'We introduce you to home.',
    mission: {
      origin:
        'Nexora started in 2014 with a simple bet: the person who grew up on a path shows it better than any brochure. Three guides, one borrowed minivan, and the misty terraces of the north.',
      today:
        'Eleven years later we are still small on purpose — small groups, three regions, and guides who set the pace of their own valleys. Growth, for us, means deeper roads, not more of them.',
    },
    pills: {
      localGuides: 'Local guides only',
      smallGroups: 'Small groups',
      threeRegions: 'Three regions',
      noScripts: 'No scripts',
    },
    // Hai mini-quote của guide bản địa. Ngoặc kép “ ” và dấu " — " giữa tên với vai trò ở lại JSX
    // (dấu câu trình bày, cùng cách `auth-screen.tsx` bọc quote).
    quotes: {
      mai: {
        text: 'I take people across the terraces my grandfather planted. That is the whole job.',
        name: 'Mai',
        role: 'Sa Pa guide',
      },
      tam: {
        text: 'The river taught me its schedule. I just translate it for our guests.',
        name: 'Tâm',
        role: 'Cần Thơ guide',
      },
    },
  },
  // §3 Timeline — `about-timeline.tsx`.
  timeline: {
    eyebrow: 'Milestones',
    titleLead: 'Twelve years,',
    titleAccent: 'four turning points.',
    // Bốn mốc theo thời gian; năm và khoá khe ảnh ở lại component. `imageLabel` là chú thích ô giữ
    // chỗ khi khe `about-timeline-<năm>` chưa có ảnh (có ảnh thật thì `SlotImage` bỏ qua nó), nên
    // nhãn phải tả đúng tấm ảnh dự định cho khe đó.
    milestones: {
      founding: {
        title: 'Three guides, one minivan',
        description:
          'It starts in Sa Pa: two brothers and a neighbour borrow a minivan and take eight strangers across the terraces they grew up on. Nobody calls it a company yet.',
        imageLabel: '2014 — terraced fields above Sa Pa at first light',
      },
      centre: {
        title: 'The centre opens',
        description:
          'Huế and Hội An join the map — imperial kitchens, lantern rivers, and our first guides who grew up inside the citadel walls.',
        imageLabel: '2017 — bánh mì, Hội An',
      },
      delta: {
        title: 'South to the delta',
        description:
          'Mekong boatmen become colleagues. Floating markets before sunrise, island dusk after — the map finally runs the whole country.',
        imageLabel: '2021 — island dusk over Phú Quốc',
      },
      today: {
        title: 'Still small on purpose',
        description:
          'A new home online, the same old promise: small groups, local pace, no scripts. Growth means deeper roads, not more of them.',
        imageLabel: '2026 — a small group on a delta path',
      },
    },
  },
  // §4 By the numbers — `about-numbers.tsx`.
  numbers: {
    // Chữ nền khổng lồ mờ (aria-hidden) nhưng vẫn là chữ hiện trên màn hình.
    watermark: 'NUMBERS',
    eyebrow: 'Key metrics',
    titleLead: 'Numbers we’re proud of,',
    titleAccent: 'counted the slow way.',
    // Nhãn và dòng mô tả của 6 ô; con số (đếm thật hoặc số biên tập) ở lại component.
    stats: {
      toursRunning: { label: 'Tours running', description: 'Across all three regions' },
      localGuides: { label: 'Local guides', description: 'Every one born on their route' },
      destinations: { label: 'Destinations', description: 'From the far north to the islands' },
      departures: { label: 'Departures a year', description: 'Rain or shine, small groups' },
      kilometres: { label: 'Kilometres each season', description: 'By road, rail and river' },
      scripts: { label: 'Scripts', description: 'And none planned' },
    },
  },
  // §Values "The promises we keep" — `about-values.tsx`.
  values: {
    eyebrow: 'What we promise',
    titleLead: 'Six promises,',
    titleAccent: 'kept since the minivan.',
    intro:
      'Written into how tours are priced, staffed, and led — not into a poster on the office wall.',
    // Sáu thẻ lời hứa; icon và cờ `highlight` ở lại component.
    items: {
      smallGroups: {
        title: 'Small groups',
        tag: 'Small by design',
        description:
          'Never a coach. Enough for stories around the table, few enough for silence on the water.',
      },
      localPay: {
        title: 'Local pay stays local',
        tag: 'Fair share',
        description:
          'Guides set their own rates and keep them. What you pay reaches the valley you walk through.',
      },
      safety: {
        title: 'Safety first',
        tag: 'Every route',
        description:
          'Every path walked by our own team before it goes on the map, every departure insured end to end.',
      },
      freeCancellation: {
        title: 'Free cancellation',
        // Vá 04/09 đã gỡ "48 hours" và "no forms, no phone queue" (khi ấy huỷ CÓ
        // form bắt nhập lý do và CÓ đội ngũ xem xét). ADR-0041 gỡ chính hàng đợi
        // duyệt ấy, nên "no queue" lại đúng — còn "published refund schedule" thì
        // hết đối tượng: bảng bậc không còn, chỉ còn một hạn chót mỗi chuyến. Vẫn
        // KHÔNG hứa "one click": hộp huỷ cần bấm mở rồi bấm xác nhận.
        tag: 'Every tour',
        description:
          'Every tour, not a select few. Cancel from your account before your trip’s deadline and every dollar comes back — a couple of clicks, no queue, no haggling.',
      },
      fairPricing: {
        title: 'Fair pricing',
        tag: 'No hidden fees',
        description:
          'Every fee itemized before you book. The price you see is the price you pay, in any season.',
      },
      noScripts: {
        title: 'No scripts',
        tag: 'The promise',
        description:
          'Guides tell their own stories at their own pace. If a market is better today than the plan, we follow the market.',
      },
    },
  },
  // §Gallery — `about-gallery.tsx`. Tên ba vùng lấy từ mock `REGIONS`, không ở đây.
  gallery: {
    eyebrow: 'Through the lens',
    titleLead: 'The country we call',
    titleAccent: 'the office.',
    // Hàm vì số tour đếm lúc render; chia số ít như mọi bộ đếm tour trong `messages` (bản cứng
    // cũ in "1 tours").
    regionTours: (count: number) => `${count} ${count === 1 ? 'tour' : 'tours'}`,
    allTitle: 'All of Vietnam',
    allTours: (count: number) => `${count} ${count === 1 ? 'tour' : 'tours'} across three regions`,
    imageLabels: {
      north: 'Gallery — terraces under moving mist, Sa Pa',
      central: 'Gallery — lantern night on the Hoài river',
      south: 'Gallery — floating market, Cần Thơ',
      all: 'Gallery — the road between all three',
    },
  },
  // §5 Team — `about-team.tsx`. Tên và vai trò từng người là dữ liệu biên tập ở `mocks/team`;
  // ba nhãn dưới là hàm nhận tên người đó.
  team: {
    eyebrow: 'The team',
    titleLead: 'Four faces,',
    titleAccent: 'one slow idea.',
    intro: 'The people who signed the lease, drew the first routes, and still answer the phone.',
    portraitLabel: (name: string) => `Portrait — ${name}`,
    websiteLabel: (name: string) => `${name} — website`,
    linkedinLabel: (name: string) => `${name} — LinkedIn`,
  },
  // §7 CTA nền video — `about-cta-video.tsx`.
  ctaVideo: {
    videoLabel: 'Video — drone flying out of a karst cave over the valley',
    titleLead: 'The road is ready',
    titleAccent: 'when you are.',
    browseTours: 'Browse the tours',
    // Thanh marquee cam kết; thứ tự chạy do mảng trong component quyết định.
    marquee: {
      smallGroups: 'Small groups',
      localGuides: 'Local guides only',
      // Vá 04/09 cùng lý do `top-bar.tsx`: không mang con số giờ nào. ADR-0041 bỏ
      // nốt rào "most": một luật hạn chót cho mọi tour.
      freeCancellation: 'Free cancellation on every tour',
      threeRegions: 'Three regions, one country',
      noScripts: 'No scripts, no rush',
    },
  },
} as const;
