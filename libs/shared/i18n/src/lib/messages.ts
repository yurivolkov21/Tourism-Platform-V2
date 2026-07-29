// Kho copy user-facing tập trung (chỉ tiếng Anh, luật #7). Mọi bề mặt đọc từ
// đây — không rải chuỗi inline.
import { resilience } from './resilience.js';

export const messages = {
  brand: {
    name: 'Tourism',
    tagline: 'Boutique heritage journeys across Vietnam',
  },
  // Assistive-tech-only copy (skip links, screen-reader hints, new-tab warnings).
  a11y: {
    skipToContent: 'Skip to main content',
    opensNewTab: '(opens in a new tab)',
    removeFilter: 'Remove filter',
  },
  // Home + About trust band (real live stats + accepted payment methods).
  trustBand: {
    eyebrow: 'Why travelers choose Tourism',
    heading: 'Boutique journeys, trusted by travelers across Vietnam.',
    stats: {
      tours: 'Curated tours',
      destinations: 'Destinations',
      rating: 'Average rating',
    },
    security: 'Every booking secured by Stripe & PayPal · SSL encrypted',
    payments: 'We accept Visa, Mastercard, American Express, PayPal and Stripe',
  },
  // Customer auth (login / register / account / user menu). EN-only (ADR-0005).
  auth: {
    login: {
      title: 'Welcome back',
      subtitle: 'Sign in to manage your trips and bookings.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in…',
      noAccount: "Don't have an account?",
      registerCta: 'Create one',
      forgotCta: 'Forgot password?',
    },
    register: {
      title: 'Create your account',
      subtitle: 'Save trips, book tours, and track your journeys.',
      fullNameLabel: 'Full name',
      namePlaceholder: 'Nguyen Van A',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      confirmLabel: 'Confirm password',
      submit: 'Create account',
      submitting: 'Creating…',
      haveAccount: 'Already have an account?',
      loginCta: 'Sign in',
      checkInboxTitle: 'Check your inbox',
      checkInboxBody:
        'We sent a confirmation link to your email. Click it to activate your account, then sign in.',
      resend: 'Resend email',
      resending: 'Sending…',
      resent: 'Sent — check your inbox again.',
    },
    account: {
      title: 'My account',
      signedInAs: 'Signed in as',
      signOut: 'Sign out',
      editProfile: 'Edit profile',
      security: 'Account security',
      dashboard: {
        eyebrow: 'My account',
        greeting: (name: string) => `Welcome back, ${name}`,
        subtitle: 'Your journeys with Tourism, all in one place.',
        traveller: 'Traveller',
        memberSince: (date: string) => `Member since ${date}`,
        stats: {
          trips: 'Trips booked',
          upcoming: 'Upcoming',
          completed: 'Completed',
          wishlist: 'Saved',
        },
        nextTrip: {
          heading: 'Your next trip',
          countdown: (days: number) =>
            days <= 0 ? 'Departing today' : days === 1 ? 'In 1 day' : `In ${days} days`,
          view: 'View booking',
          noneTitle: 'No journeys planned yet',
          noneBody: 'Browse our journeys and start planning your next escape.',
          browse: 'Explore tours',
        },
        saved: {
          heading: 'Saved for later',
          from: (price: string) => `From ${price}`,
          browse: 'Browse tours',
          viewAll: (n: number) => `View all (${n})`,
          empty: 'Tours you save will appear here.',
          remove: 'Remove from saved',
        },
        upcoming: {
          heading: 'Upcoming journeys',
          viewAll: 'View all bookings',
        },
        links: {
          bookings: 'My bookings',
          settings: 'Account settings',
        },
      },
      savedPage: {
        title: 'Saved tours',
        subtitle: 'Tours you’ve saved to plan later.',
        empty: 'You haven’t saved any tours yet.',
        browse: 'Browse tours',
        from: (price: string) => `From ${price}`,
        remove: 'Remove from saved',
        view: 'View tour',
      },
      securityPage: {
        title: 'Account security',
        subtitle: 'Change your password or email.',
        back: 'Back to account',
        password: {
          heading: 'Change password',
          newLabel: 'New password',
          confirmLabel: 'Confirm new password',
          submit: 'Update password',
          submitting: 'Updating…',
          success: 'Password updated.',
          show: 'Show password',
          hide: 'Hide password',
        },
        email: {
          heading: 'Change email',
          currentLabel: 'Current email',
          currentPasswordLabel: 'Current password',
          newLabel: 'New email',
          submit: 'Send confirmation',
          submitting: 'Sending…',
          sent: 'Confirmation sent.',
          sentHint:
            'Check your new inbox and confirm the change — your email updates once you confirm. We’ll also email your old address to let you know.',
          managedNote:
            'This account’s email is managed by Google. To change it, use your Google account.',
        },
      },
      profile: {
        title: 'Profile',
        subtitle: 'Update your contact details.',
        fullNameLabel: 'Full name',
        phoneLabel: 'Phone',
        emailLabel: 'Email',
        emailHint: 'Your sign-in email — manage it in the Email & password section below.',
        save: 'Save changes',
        saving: 'Saving…',
        saved: 'Profile saved.',
        memberSince: (date: string) => `Member since ${date}`,
        back: 'Back to account',
        avatar: {
          heading: 'Photo',
          change: 'Change photo',
          uploading: 'Uploading…',
          remove: 'Remove',
          hint: 'JPG, PNG or WebP, up to ~5 MB.',
          error: 'Couldn’t upload that image. Please try another.',
          saved: 'Photo updated.',
        },
      },
      settings: {
        title: 'Account settings',
        subtitle: 'Manage your profile, sign-in and account.',
        personalHeading: 'Personal information',
        personalDesc: 'Your photo, name and phone number.',
        securityHeading: 'Email & password',
        securityDesc: 'Your sign-in email and password.',
        connectedHeading: 'Connected accounts',
        connectedDesc: 'Sign-in methods linked to your account.',
        dangerHeading: 'Danger zone',
        dangerDesc: 'Irreversible account actions.',
      },
      connected: {
        google: 'Google',
        email: 'Email & password',
        none: 'No connected accounts yet.',
      },
      danger: {
        deleteTitle: 'Delete account',
        deleteDesc:
          'Permanently delete your account and all associated data. This can’t be undone.',
        deleteCta: 'Delete account',
        confirmTitle: 'Delete your account?',
        confirmBody:
          'This permanently removes your account and data. This action cannot be undone.',
        confirmCta: 'Yes, delete my account',
        cancel: 'Cancel',
        deleting: 'Deleting…',
      },
    },
    menu: {
      login: 'Log in',
      account: 'My account',
      signOut: 'Sign out',
    },
    // Forgot / reset password (S1).
    forgot: {
      title: 'Reset your password',
      subtitle: 'Enter your email and we’ll send you a reset link.',
      emailLabel: 'Email',
      submit: 'Send reset link',
      submitting: 'Sending…',
      sentTitle: 'Check your inbox',
      sentBody: 'If an account exists for that email, a password-reset link is on its way.',
      backToLogin: 'Back to sign in',
    },
    reset: {
      title: 'Choose a new password',
      subtitle: 'Enter a new password for your account.',
      passwordLabel: 'New password',
      confirmLabel: 'Confirm new password',
      submit: 'Update password',
      submitting: 'Updating…',
      success: 'Password updated. You’re signed in.',
      goToAccount: 'Go to my account',
      invalidTitle: 'Link expired',
      invalidBody: 'This reset link is invalid or has expired. Request a new one.',
      requestNew: 'Request a new link',
    },
    // Per-field error copy for the auth forms (login / register / forgot / reset).
    // Keys are the stable `FieldErrorCode` values from the web auth validator.
    fieldErrors: {
      fullName: {
        REQUIRED: 'Enter your full name.',
      },
      email: {
        REQUIRED: 'Enter your email address.',
        INVALID: 'Enter a valid email address, e.g. you@example.com.',
      },
      password: {
        REQUIRED: 'Enter your password.',
        TOO_SHORT: 'Password must be at least 8 characters.',
        WEAK: 'Use 8+ characters with upper- and lower-case letters, a number, and a symbol.',
        INCORRECT: 'Incorrect password. Please try again.',
      },
      confirm: {
        REQUIRED: 'Confirm your password.',
        MISMATCH: 'Passwords do not match.',
      },
    } as Record<string, Record<string, string>>,
    passwordRules: {
      length: 'At least 8 characters',
      lower: 'A lowercase letter',
      upper: 'An uppercase letter',
      number: 'A number',
      special: 'A special character',
    } as Record<string, string>,
    passwordStrength: (score: number): string =>
      ['Enter a password', 'Very weak', 'Weak', 'Medium', 'Strong', 'Very strong'][score] ??
      'Enter a password',
    oauth: {
      continueGoogle: 'Continue with Google',
      or: 'or',
    },
    backHome: 'Back to home',
  },
  // Booking flow (book → pay → confirm). Login-required; Stripe + PayPal. EN-only (ADR-0005).
  booking: {
    // Inline date-picker field (private-request / booking forms).
    datePicker: {
      placeholder: 'July 01, 2026',
      enter: 'Enter a date',
      select: 'Select date',
    },
    // Tour-detail BookingBox CTA + inline departure picker.
    box: {
      selectDeparture: 'Select a departure',
      adults: 'Adults',
      children: 'Children',
      childrenHint: 'Ages 2–11',
      bookCta: 'Book now',
      noDepartures: 'No upcoming departures — send an enquiry and we’ll arrange dates.',
    },
    // Booking page (/tours/[slug]/book).
    page: {
      title: 'Complete your booking',
      subtitle: 'Review your trip, add your details, and choose how to pay.',
      backToTour: 'Back to tour',
      summaryHeading: 'Your trip',
      departureLabel: 'Departure',
      partyLabel: 'Travellers',
      adultsLine: (n: number) => `${n} adult${n > 1 ? 's' : ''}`,
      childrenLine: (n: number) => `${n} child${n > 1 ? 'ren' : ''}`,
      perAdult: 'per adult',
      perChild: 'per child',
      totalLabel: 'Estimated total',
      totalNote: 'Final amount is confirmed at payment.',
    },
    // Booking form fields.
    form: {
      heading: 'Your details',
      datesHeading: 'Your trip',
      datesDesc: 'Choose a departure date and how many are travelling.',
      departure: 'Departure date',
      adults: 'Adults',
      children: 'Children',
      travellersHeading: 'Traveller details',
      travellersDesc: 'Who should we send the confirmation to?',
      contactName: 'Full name',
      contactEmail: 'Email',
      contactPhone: 'Phone (optional)',
      specialRequests: 'Special requests (optional)',
      specialRequestsPlaceholder: 'Dietary needs, accessibility, occasions…',
      paymentHeading: 'Payment',
      paymentDesc: 'Secure checkout — pick how you’d like to pay.',
      stripe: 'Card (Stripe)',
      stripeHint: 'Visa, Mastercard, Amex',
      paypal: 'PayPal',
      paypalHint: 'Pay with your PayPal balance or card',
      submit: 'Continue to payment',
      submitting: 'Starting secure checkout…',
      trustLine:
        'You’ll be redirected to a secure payment page. No card details touch our servers.',
      modeToggle: {
        label: 'Travel on my own dates',
        hint: 'Private tour — pick any date. Quote-based: we confirm within 24h, no payment now.',
        noDepartures: 'No scheduled dates right now — request your own dates below.',
      },
      private: {
        datesHeading: 'Your dates',
        datesDesc: 'Pick a preferred start date — we’ll plan the rest around it.',
        startDate: 'Preferred start date',
        endHint: (end: string, days: number) => `Ends around ${end} · ${days} days`,
        preferencesHeading: 'Trip preferences',
        preferencesDesc: 'Tell us anything that helps us tailor your private departure.',
        requests: 'Anything else? (optional)',
        requestsPlaceholder: 'Flexible dates, dietary needs, a private guide…',
        submit: 'Request a quote',
        submitting: 'Sending request…',
        confirmNote: 'No payment now — we’ll email your private-departure quote within 24h.',
        summaryHeading: 'Your request',
        priceOnRequest: 'Price on request',
        successTitle: 'Request sent',
        successBody:
          'Thanks! Our team will email you a tailored private-departure quote within 24 hours.',
        error: 'Couldn’t send your request. Please try again.',
        rateLimited: 'Too many requests — please wait a minute and try again.',
      },
    },
    // Friendly EN for each error code (form + API). Keep the keys in sync with BookingFormError.
    errors: {
      MISSING_TOUR: 'That tour is no longer available.',
      MISSING_DEPARTURE: 'Please choose a departure date.',
      INVALID_PARTY_SIZE: 'Please enter 1–20 adults and up to 20 children.',
      INVALID_PROVIDER: 'Please choose a payment method.',
      INVALID_CONTACT: 'Please enter a valid name and email.',
      SEATS_NOT_AVAILABLE: 'Sorry — those seats just sold out. Try a different departure.',
      DEPARTURE_NOT_OPEN: 'That departure is no longer open for booking.',
      DEPARTURE_DEPARTED: 'That departure has already started.',
      CHECKOUT_FAILED: 'We couldn’t start the payment session. Please try again.',
      UNAUTHORIZED: 'Your session has expired — please sign in again, then retry.',
      USER_NOT_SYNCED: 'We couldn’t verify your account. Sign out and back in, then try again.',
      CANCELLATION_NOT_ALLOWED: 'This booking can’t be cancelled online. Contact us for help.',
      DEPARTURE_ALREADY_STARTED: 'This trip has already started — please contact us directly.',
      CANCELLATION_ALREADY_REQUESTED:
        'You’ve already sent a cancellation request for this booking.',
      generic: 'Something went wrong. Please try again.',
    },
    // /checkout/success.
    success: {
      confirmedTitle: 'Booking confirmed',
      confirmedBody: 'Thank you — your payment went through and your trip is booked.',
      pendingTitle: 'Confirming your payment…',
      pendingBody:
        'Your payment is being confirmed — this usually takes a few seconds. This page updates automatically; you can also refresh.',
      refresh: 'Refresh',
      refLabel: 'Booking reference',
      tourLabel: 'Tour',
      departureLabel: 'Departure',
      travellersLabel: 'Travellers',
      totalLabel: 'Total paid',
      contactLabel: 'Contact',
      emailNote: 'A confirmation has been sent to your email.',
      viewTours: 'Browse more tours',
      notFound: 'We couldn’t find that booking.',
    },
    // /checkout/cancel.
    cancel: {
      title: 'Payment cancelled',
      body: 'No payment was taken. Your booking is held as pending — pay now or manage it from your bookings. Unpaid bookings are released automatically after a while.',
      manage: 'Pay now or manage booking',
      retry: 'Try again',
      backToTours: 'Browse tours',
    },
    // My bookings list (/account/bookings).
    list: {
      menuLink: 'My bookings',
      title: 'My bookings',
      subtitle: 'Trips you’ve booked with us.',
      empty: 'You haven’t booked any trips yet.',
      browse: 'Browse tours',
      refLabel: 'Reference',
      departureLabel: 'Departure',
      travellersLabel: 'Travellers',
      totalLabel: 'Total',
      bookedOn: (date: string) => `Booked ${date}`,
      viewTour: 'View tour',
      status: {
        PENDING: 'Awaiting payment',
        PAID: 'Paid',
        CANCELLED: 'Cancelled',
        REFUNDED: 'Refunded',
        PARTIALLY_REFUNDED: 'Partially refunded',
      } as Record<string, string>,
      viewDetails: 'View details',
    },
    detail: {
      back: 'Back to my bookings',
      title: 'Booking details',
      paymentLabel: 'Payment',
      contactLabel: 'Contact',
      requestsLabel: 'Special requests',
      payNow: 'Pay now',
      // PENDING self-cancel
      cancel: 'Cancel booking',
      cancelConfirmTitle: 'Cancel this booking?',
      cancelConfirmBody: 'This releases your pending reservation. You can book again any time.',
      cancelConfirmCta: 'Yes, cancel it',
      keep: 'Keep booking',
      cancelling: 'Cancelling…',
      cancelled: 'Booking cancelled.',
      requestToast: 'Cancellation requested — we’ll email you.',
      // PAID cancellation/refund request (admin processes refunds)
      requestTitle: 'Need to cancel?',
      requestBody:
        'Paid bookings are cancelled by our team. Send a request and we’ll get back to you about a refund.',
      requestCta: 'Request cancellation',
      reasonLabel: 'Reason (optional)',
      reasonPlaceholder: 'Tell us why you need to cancel…',
      submitRequest: 'Send request',
      submitting: 'Sending…',
      requestSent: 'Request sent — our team will follow up shortly.',
      requestError: 'Couldn’t send your request. Please try again.',
      policyLink: 'Read our cancellation & refund policy',
      requestPending: 'Cancellation requested — we’ll email you about a refund.',
      requestDenied: 'Your cancellation request was declined.',
      requestResubmit: 'Request cancellation again',
      refundedNote: (amount: string) => `Refunded ${amount}.`,
      partiallyRefundedNote: (amount: string) => `Partially refunded ${amount}.`,
    },
  },
  common: {
    home: 'Home',
    onThisPage: 'On this page',
    breadcrumbLabel: 'Breadcrumb',
    emailPlaceholder: 'you@example.com',
    /** Nhãn của chỉ báo cuộn dọc mép phải hero. Ở `common` chứ không ở
        `regionPage`: nó là nhãn giao diện chung, hero nào cũng dùng được. */
    scrollHint: 'Scroll',
  },
  // Shared pagination aria-labels (tours listing · region tours · blog).
  pagination: {
    first: 'Go to first page',
    previous: 'Go to previous page',
    next: 'Go to next page',
    last: 'Go to last page',
  },
  // Page <title>/description copy. Titles are PLAIN — the root layout's title.template
  // (`%s — Tourism`) appends the brand, so never suffix the brand here (would double it).
  pageMeta: {
    privacy: {
      title: 'Privacy Statement',
      description: 'How we collect, use, share, and protect your personal information.',
    },
    terms: {
      title: 'Terms & Conditions',
      description: 'The terms that govern booking and travelling with us.',
    },
    cancellation: {
      title: 'Cancellation & Refund Policy',
      description: 'How to cancel a booking with us, what to expect, and how refunds are handled.',
    },
    faq: {
      title: 'FAQs — frequently asked questions',
      description:
        'Answers to the questions travellers ask us most — booking, payment, itineraries, guides, cancellations, and travelling in Vietnam.',
    },
    about: {
      title: 'About us',
      description:
        'Meet the local experts behind our boutique heritage journeys across Vietnam — our story, the numbers behind the trips, and the guides who craft them.',
    },
    tours: {
      title: 'All tours',
      description:
        'Browse every journey we run across Vietnam — filter by destination, length and price to find the trip that fits you.',
    },
    destinations: {
      title: 'Vietnam destinations',
      description: 'Explore Vietnam by destination — from the misty north to the Mekong south.',
    },
    contact: {
      title: 'Contact us',
      description:
        'Get in touch with our local travel experts — office hours, address, phone, and email, plus a quick enquiry form. We usually reply within 24 hours.',
    },
    notFound: {
      tour: 'Tour not found',
      post: 'Post not found',
      region: 'Region not found',
    },
    regionSuffix: 'tours',
  },
  // Tầng chống chịu — định nghĩa ở ./resilience.ts (client boundary import
  // thẳng module đó để khỏi kéo cả catalogue này vào bundle).
  resilience,
  topBar: {
    tagline: 'Vietnam’s boutique heritage travel, crafted end to end',
  },
  nav: {
    tours: 'Tours',
    destinations: 'Destinations',
    about: 'About Us',
    contact: 'Contact',
    blog: 'Journal',
    login: 'Log in',
    menu: 'Menu',
    planTrip: 'Plan your trip',
    backToTop: 'Back to top',
    toursMenu: {
      label: 'Tours',
      items: [
        {
          label: 'Cruises',
          href: '/tours',
          hint: 'Overnight bays & river journeys',
        },
        {
          label: 'Trekking',
          href: '/tours',
          hint: 'Mountain trails & hill-tribe routes',
        },
        {
          label: 'Cultural',
          href: '/tours',
          hint: 'Heritage towns, temples & history',
        },
        {
          label: 'Culinary',
          href: '/tours',
          hint: 'Markets, street food & cooking',
        },
        {
          label: 'Family',
          href: '/tours',
          hint: 'Easy-paced trips for all ages',
        },
        {
          label: 'Beach & relax',
          href: '/tours',
          hint: 'Island escapes & coastal stays',
        },
      ],
    },
    // Dropdown Destinations trên navbar. Nexora có đúng 4 dòng phẳng, mỗi dòng một
    // `hint` GÕ TAY ('Hạ Long, Sa Pa, Ninh Bình') — thêm/bớt địa điểm là chữ đó sai
    // mà không ai biết. v2 CỐ TÌNH không có `hint` ở đây: menu sinh hint và số tour
    // từ dữ liệu (xem spec §6.1), nên i18n chỉ giữ nhãn tĩnh.
    destinationsMenu: {
      label: 'Destinations',
      all: 'All destinations',
      allHint: 'Browse every place we cover',
      /** Nhãn cho link tiêu đề vùng trong menu — điều hướng sang trang vùng. */
      exploreRegion: (region: string) => `Explore ${region}`,
    },
  },
  hero: {
    eyebrowBadge: 'Curated',
    eyebrowText: 'Boutique heritage travel',
    titleLead: 'Timeless journeys',
    titleAccent: 'across Vietnam',
    titleTail: 'crafted for you',
    subtitle:
      'Handpicked heritage tours, boutique stays, and private guides — discover the country’s culture and landscapes in refined comfort.',
    cta: 'Explore tours',
    imageAlt: 'A scenic heritage landscape in Vietnam',
    searchLabel: 'Destination',
    searchPlaceholder: 'Where would you like to go?',
    searchCta: 'Search',
  },
  features: {
    heading: 'Why travel with us',
    subtitle:
      'Thoughtful details and trusted service that make every journey effortless, safe, and memorable.',
    cta: 'Browse all tours',
    items: [
      {
        title: 'Curated itineraries',
        description:
          'Handpicked journeys crafted by local experts — iconic sights and hidden gems in balance.',
      },
      {
        title: 'Secure booking',
        description:
          'Pay safely with Stripe and PayPal; your personal and payment details stay protected end to end.',
      },
      {
        title: 'Local expert guides',
        description:
          'Travel with vetted, knowledgeable guides who bring the culture and history of each place to life.',
      },
      {
        title: 'Verified reviews',
        description:
          'Make confident choices with real ratings and reviews from travellers who booked with us.',
      },
      {
        title: 'Flexible departures',
        description:
          'Choose dates that suit you, with clear seat availability and easy changes before you travel.',
      },
      {
        title: '24/7 support',
        description:
          'Our team is on hand before, during, and after your trip — wherever your journey takes you.',
      },
    ],
  },
  featuredTours: {
    heading: 'Featured journeys',
    subtitle:
      'A selection of our most-loved tours — handcrafted routes, trusted guides, and honest prices.',
    viewAll: 'View all tours',
    view: 'View tour',
    from: 'From',
    perPerson: '/ person',
    daysLabel: 'days',
    reviewsLabel: 'reviews',
    // Labels for TourBadge enum values (backend).
    badges: {
      BEST_VALUE: 'Best value',
      LIMITED_OFFER: 'Limited offer',
      EXCLUSIVE: 'Exclusive',
      NEW: 'New',
      POPULAR: 'Popular',
    },
  },
  destinations: {
    heading: 'Explore by destination',
    subtitle: 'Begin with a place that calls to you — then let the journey unfold from there.',
    viewAll: 'View all destinations',
    toursLabel: 'tours',
    toursCountLabel: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
  },
  // `/destinations` — cổng khám phá theo VÙNG.
  //
  // ĐÃ CẮT khỏi bản port từ Nexora, mỗi khoản một lý do:
  //  · `popularHeading`/`popularSubtitle` ("Most popular journeys" / "Traveller
  //    favourites") — KHÔNG có tín hiệu popularity trong contract (spec Tours §8 #3:
  //    chưa sort được theo rating/popularity). Cùng họ với badge "Verified" đã bị
  //    loại ở cụm reviews.
  //  · `regionHeading` cũ là "Top destinations in …" — "Top" ngụ ý xếp hạng không
  //    tồn tại. Cùng lý lẽ đã đổi "highlight" thành "Most recent" ở reviews.
  //  · `breadcrumbCurrent` cũ là 'Vietnam tours' — đây là trang địa điểm, không
  //    phải trang tour.
  //  · `viewMore` từng bị cắt vì "không có trang nào để 'xem thêm' tới" — Task 4c
  //    thêm lại vì `RegionGroup` giờ link sang `/destinations/[region]`.
  destinationsPage: {
    breadcrumbCurrent: 'Destinations',
    heroTitle: 'Explore Vietnam by region',
    heroSubtitle: 'Three regions, nine places. Start where the journey makes sense for you.',
    regionHeading: (region: string) => `Places in ${region}`,
    placesLabel: 'Places',
    toursLabel: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
    exploreRegion: (region: string) => `Explore ${region}`,
    // Link "View more" ở header mỗi `RegionGroup`, trỏ `/destinations/[region]`.
    viewMore: 'View more',
    // Ba khu mới của bản thiết kế lại Task 4b (đường kinh tuyến dọc) — khu
    // `featured` (Featured trips) đã XOÁ: trang này giới thiệu vùng, không bán
    // tour (user quyết 28/07, xem spec §5.1 "Sửa lần hai").
    // `eyebrow` của mỗi khu: nhãn ngắn đặt TRÊN tiêu đề, theo quy ước
    // `SectionEyebrow` dùng ở 15 component khắp home/about/contact.
    moments: {
      eyebrow: 'From the road',
      heading: 'Moments from the journey',
      subtitle: 'Sent in by travellers, from the road.',
    },
    quotes: {
      // Cố ý KHÔNG dùng 'Reviews' — trang chủ đã lấy chữ đó cho khu testimonial
      // của nó; trùng eyebrow giữa hai trang làm hai khu trông như một.
      eyebrow: 'Travellers',
      heading: 'Loved by travellers',
      subtitle: 'A few words from people who went.',
    },
    know: {
      eyebrow: 'Practical',
      heading: 'Know before you go',
      subtitle: 'The questions we get asked most, answered plainly.',
      seeAll: 'See all questions',
    },
  },

  // `/destinations/[region]` — dựng theo trang vùng THẬT của Nexora (7 khu, bỏ
  // khu `Plan your trip`; user chốt 29/07).
  //
  // Copy port từ Nexora nhưng ĐÃ THAY mọi địa danh v2 KHÔNG bán — `Hà Giang`
  // (+ Mã Pí Lèng, 350km Loop), `Fansipan`, `Lan Hạ`, `Pù Luông`, `Củ Chi`,
  // `Marble Mountains`, và `Caves` ở tags của Trung. Thay bằng nơi có thật trong
  // mock: Ninh Bình · Mường Hoa · Ô Quy Hồ · Bắc Hà · Hải Vân · Bà Nà · Cần Thơ.
  // Đây là tiêu chí hoàn thành ở spec §10, không phải chuyện gu.
  //
  // `tags` và hàng số liệu của hero KHÔNG nằm ở đây: chúng DẪN XUẤT từ
  // `regionGlance()` và `toursInRegion()` — Nexora gõ tay nên thêm/bớt tour là
  // chữ sai âm thầm.
  //
  // `regions` KHOÁ BẰNG `key` của vùng, KHÔNG khoá bằng tên hiển thị: bản cũ dùng
  // Record<string,string> khoá bằng 'Northern Vietnam', nên đổi một chữ trong tên
  // hiển thị là copy biến mất im lặng.
  regionPage: {
    backToAll: 'All destinations',
    /** Eyebrow các khu — quy ước `SectionEyebrow` của site (21 component dùng).
        Khu Signature dùng lại `regions[key].signature.eyebrow` đã có; khu Tours
        dùng SỐ TOUR dẫn xuất, đúng cách `region-group.tsx` làm ở trang index. */
    introEyebrow: 'Overview',
    galleryEyebrow: 'Gallery',
    valuePropsEyebrow: 'How we travel',
    introHeading: (region: string) => `The best ${region} tours`,
    /** CTA cuối khu intro. Nexora trỏ `#itineraries` (trang họ không có) — ở đây
        trỏ neo `#tours` NGAY TRÊN CÙNG TRANG, là khu có thật. */
    browseCta: (region: string) => `Browse ${region} trips`,
    bestForLabel: 'Best for',
    highlightsHeading: (region: string) => `What makes ${region} special`,
    toursHeading: 'Tours',
    allTab: 'All',
    noTours: 'No trips run in this region yet.',
    noToursBody: 'Tell us where you want to go and we will plan something.',
    galleryHeading: (region: string) => `${region} in photos`,
    gallerySubtitle: 'A glimpse of the landscapes, towns, and moments that await.',
    /**
     * Nhãn 10 ô khảm của khu ảnh — ĐÚNG 10, khớp nhịp `1 lớn · 2×2 · 2×2 · 1 lớn`.
     *
     * Mô tả CẢNH chung, cố ý KHÔNG gắn địa danh (Nexora làm y vậy ở
     * `PLACEHOLDER_SECTIONS`): cùng một danh sách phục vụ cả ba vùng, nên gắn tên
     * nơi chốn vào đây là hứa một bức ảnh cụ thể mà ô giữ chỗ không có — và ở hai
     * vùng còn lại thì tên đó còn SAI. Chúng là `aria-label` của ô nên vẫn là chuỗi
     * user-facing, vì thế ở đây chứ không nằm trong component.
     */
    galleryTiles: [
      'Coastal cliffs above the sea',
      'Lantern-lit old town',
      'Terraced rice fields',
      'Limestone karsts at dawn',
      'Riverside floating market',
      'Misty mountain pass',
      'Fishing boats at sunset',
      'Temple courtyard',
      'Street food stalls',
      'Rolling green highlands',
    ],
    /** Nhãn cho hàng số liệu trong hero. GIÁ TRỊ dẫn xuất ở tầng trang. */
    statLabels: {
      from: 'From',
      longest: 'Longest trip',
      hardest: 'Hardest grade',
      styles: 'Trip styles',
    },
    /** Nhãn từng chặng của timeline itinerary (biến thể `itinerary`, miền Bắc). */
    dayLabel: (n: number) => `Day ${n}`,
    /** Dòng ghi công dưới timeline: itinerary này là của MỘT tour có thật. */
    itineraryNote: (tour: string) => `Day by day on ${tour}`,
    // "We've got you covered" — GIỮ khu, VIẾT LẠI nội dung. Bản Nexora hứa
    // "Luxury transfers" và "vetted private drivers": không field nào đỡ, trên một
    // capstone KHÔNG doanh thu. Ba mục dưới đây đều tựa vào thứ mock có thật —
    // `maxGroupSize` (12), giọng đã dùng ở footer, và `included`/`excluded`.
    valuePropsHeading: "We've got you covered",
    valueProps: [
      {
        title: 'Small groups',
        body: 'Twelve travellers at most, so you are never following a flag through a crowd.',
      },
      {
        title: 'Local guides',
        body: 'Led by people who grew up in the valleys, old towns and delta villages you came to see.',
      },
      {
        title: 'Clear inclusions',
        body: 'Every trip lists what is covered and what is not, before you book.',
      },
    ],
    regions: {
      north: {
        tagline: 'From Sa Pa to Hạ Long Bay — culture and natural wonders in the misty north.',
        intro:
          'Awe-inspiring landscapes of limestone bays and terraced highlands, diverse hill-tribe cultures, and the high passes of the far north — this is Northern Vietnam at its most dramatic.',
        // Nexora: "ride the legendary Hà Giang Loop" → thay bằng Ô Quy Hồ, đèo có
        // thật trong itinerary ngày 3 của `northern-highlands-loop`.
        intro2:
          'Cruise the emerald karsts of Hạ Long, trek between Hmong and Dao villages around Sa Pa, and ride the switchbacks over Ô Quy Hồ. Browse our trips below.',
        highlights: [
          {
            title: 'Emerald bays',
            body: 'Overnight on a junk among the limestone islands of Hạ Long Bay.',
          },
          {
            title: 'Highland treks',
            body: 'Walk the rice terraces and hill-tribe trails of the Mường Hoa valley around Sa Pa.',
          },
          {
            title: 'River caves',
            body: 'Row between the karst peaks and flooded caves of Ninh Bình.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Great northern adventures',
          body: 'The north rewards travellers who go further — onto the water, into the mountains, and out to the high passes. These are the journeys that define the region.',
          points: [
            'Overnight cruises through Hạ Long Bay',
            'Multi-day treks with Hmong and Dao guides',
            'The high passes above Sa Pa and Bắc Hà',
          ],
        },
      },
      central: {
        tagline: 'Imperial heritage, lantern-lit old towns and a golden coastline.',
        // Nexora: "some of the world's largest cave systems" → v2 không bán tour
        // hang động nào ở miền Trung. Thay bằng Chăm temple towers (Mỹ Sơn, có
        // thật ở itinerary ngày 5 của `central-heritage-week`).
        intro:
          'Ancient citadels and UNESCO old towns beside a golden coast, and Chăm temple towers in the hills — Central Vietnam is the country’s cultural heart.',
        intro2:
          'Step inside the walled citadel of Huế, wander the lantern-lit lanes of Hội An, and explore the Chăm temples of Mỹ Sơn. Browse our trips below.',
        highlights: [
          {
            title: 'Imperial Huế',
            body: 'The citadel, royal tombs, and refined cuisine of the Nguyễn emperors.',
          },
          {
            title: 'Hội An lanterns',
            body: 'A car-free UNESCO old town of tailors, tea houses, and riverside lights.',
          },
          {
            title: 'Golden coast',
            body: 'Đà Nẵng’s beaches, the Hải Vân pass, and the Bà Nà hills above.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'The heritage trail',
          body: 'Few stretches of Vietnam hold so much history in so little distance. Follow the thread of empires and trade from the citadel to the old port.',
          // KHÔNG có `points` ở đây: biến thể `timeline` không render chúng.
          // Chỉ biến thể `itinerary` (miền Bắc) có danh sách gạch đầu dòng.
          timeline: [
            {
              title: 'Huế',
              era: 'Imperial capital',
              body: 'The walled citadel, the Forbidden Purple City, and the royal tombs of the Nguyễn emperors along the Perfume river.',
            },
            {
              title: 'Hội An',
              era: 'Trading port',
              body: 'A lantern-lit UNESCO old town of tailor shops, tea houses, and the Japanese covered bridge over the Thu Bồn.',
            },
            {
              title: 'Mỹ Sơn',
              era: 'Chăm sanctuary',
              body: 'Red-brick temple towers set in a jungle valley — the spiritual heart of the Chăm kingdom for a thousand years.',
            },
          ],
        },
      },
      south: {
        tagline: 'River deltas, island beaches and the restless energy of Sài Gòn.',
        intro:
          'Floating markets and flooded paddies, a restless city and tropical islands — the warm, easy-going south runs at the pace of the water.',
        // Nexora: "from the Củ Chi tunnels to the colonial centre" → v2 không bán
        // Củ Chi. Thay bằng Cần Thơ và đêm ăn đường phố Sài Gòn, cả hai là tour thật.
        intro2:
          'Drift the Mekong’s waterways from Cần Thơ, eat your way through Sài Gòn after dark, and unwind on the reefs of Phú Quốc. Browse our trips below.',
        highlights: [
          {
            title: 'The Mekong',
            body: 'Floating markets at dawn, orchards, and riverside mornings around Cần Thơ.',
          },
          {
            title: 'Sài Gòn energy',
            body: 'Colonial landmarks by day and endless street food after dark.',
          },
          {
            title: 'Island escapes',
            body: 'White-sand beaches and clear reefs on Phú Quốc.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Life on the water',
          body: 'In the south, the river is the road. Slow down to the rhythm of the delta and the islands, where days unfold on boats and beaches.',
          // KHÔNG có `points` ở đây: biến thể `postcards` không render chúng.
          // Chỉ biến thể `itinerary` (miền Bắc) có danh sách gạch đầu dòng.
          postcards: [
            { title: 'The Mekong Delta', caption: 'Floating markets & waterways' },
            { title: 'Sài Gòn', caption: 'City energy & history' },
            { title: 'Phú Quốc', caption: 'Island beaches' },
          ],
        },
      },
    },
  },
  // `/destinations` — when to visit, by region (unique to the destinations page).
  bestTime: {
    heading: 'When to visit',
    subtitle:
      'Vietnam runs over 1,600km north to south, so the best season depends on where you go — a quick guide by region.',
    regions: [
      {
        region: 'Northern Vietnam',
        months: 'Mar–May · Sep–Nov',
        note: 'Cool, dry and clear — ideal for Hạ Long and the mountains. Winters turn chilly up high; summers bring rain.',
      },
      {
        region: 'Central Vietnam',
        months: 'Feb–Aug',
        note: 'Warm and dry along the coast and old towns. Avoid Oct–Dec, the wettest and most storm-prone months.',
      },
      {
        region: 'Southern Vietnam',
        months: 'Dec–Apr',
        note: 'The dry season for the Mekong and the islands. May–Nov is wetter but stays warm with short showers.',
      },
    ],
  },
  // `/destinations` — practical know-before-you-go tips (unique to the destinations page).
  travelTips: {
    heading: 'Know before you go',
    subtitle: 'A few practical notes to make planning your Vietnam trip easier.',
    items: [
      {
        title: 'Visas',
        body: 'Most nationalities can apply for a Vietnam e-visa online — sort it a couple of weeks ahead.',
      },
      {
        title: 'Money',
        body: 'The currency is the Vietnamese đồng (VND). Cards work in cities; carry small cash for markets.',
      },
      {
        title: 'Getting around',
        body: 'Domestic flights, trains and private transfers — we arrange every leg of your journey.',
      },
      {
        title: 'Staying connected',
        body: 'A cheap local SIM or eSIM at the airport gives you fast 4G almost everywhere you travel.',
      },
      {
        title: 'Health & safety',
        body: 'Vietnam is very safe for travellers. Drink bottled water and take the usual precautions.',
      },
      {
        title: 'What to pack',
        body: 'Layers for the north, light rain gear for the centre, and summer wear for the south.',
      },
    ],
  },
  experiences: {
    heading: 'Browse by experience',
    subtitle:
      'Prefer to start from a style of travel? Choose the kind of journey that excites you most.',
    viewAll: 'View all tours',
    toursLabel: 'tours',
    // Shape mirrors the TourCategory model (slug/name/description) + a derived tour count.
    items: [
      {
        slug: 'cruises',
        name: 'Cruises',
        description: 'Overnight bays and slow river journeys',
        tourCount: 9,
      },
      {
        slug: 'trekking',
        name: 'Trekking',
        description: 'Mountain trails and hill-tribe routes',
        tourCount: 7,
      },
      {
        slug: 'cultural',
        name: 'Cultural',
        description: 'Heritage towns, temples and history',
        tourCount: 14,
      },
      {
        slug: 'culinary',
        name: 'Culinary',
        description: 'Markets, street food and cooking',
        tourCount: 6,
      },
      {
        slug: 'family',
        name: 'Family',
        description: 'Easy-paced trips the whole family loves',
        tourCount: 8,
      },
      {
        slug: 'beach',
        name: 'Beach & relax',
        description: 'Island escapes and coastal stays',
        tourCount: 5,
      },
    ],
  },
  trust: {
    heading: 'Trusted by travellers worldwide',
    subtitle:
      'Real journeys, honest service, and the kind of care that turns first-time guests into lifelong travellers.',
    // Labels only — the VALUES come from live API data (review aggregate +
    // published-tour count); rows with no real data are hidden. The support
    // pair is a static pledge, not a metric. No fabricated numbers here.
    labels: {
      rating: 'Average tour rating',
      itineraries: 'Curated itineraries',
      supportValue: '24/7',
      supportLabel: 'On-trip support',
    },
  },
  testimonials: {
    eyebrow: 'Traveller stories',
    heading: 'Loved by travellers',
    subtitle:
      'Real words from guests who explored Vietnam with us — their journeys, told in their own voice.',
    // No fixture list — the section renders ONLY real approved+featured
    // reviews (GET /reviews/featured) and hides itself when there are none.
  },
  about: {
    hero: {
      heading: 'Travel crafted by people who love this country',
      body: 'We are a small team of local experts devoted to slow, considered travel across Vietnam — turning every trip into a story worth telling.',
      cta: 'Read our story',
      imageAlt: 'Our team exploring Vietnam',
    },
    metrics: {
      heading: 'Unhurried, local-led journeys across Vietnam — built on',
      // Brand keyword pills (icons + token colours live in the ByTheNumbers component).
      pills: ['Heritage', 'Local experts', 'Slow travel'],
      // Stat labels; values are computed from the live catalog (see ByTheNumbers).
      labels: ['Curated tours', 'Destinations', 'Regions covered', 'Traveller rating'],
    },
    team: {
      eyebrow: 'Meet the team',
      heading: 'The people behind your journey',
      subtitle: 'A small team of local experts who design, guide, and care for every trip we run.',
      // Real team (project members) presented in the travel-brand persona. `image`
      // is empty for now → the slider shows an initials avatar; drop in a portrait
      // URL later without touching the component.
      members: [
        {
          name: 'Giang Tử Dương',
          role: 'Founder & Travel Curator',
          bio: 'Founded the company around a love of Vietnam’s quieter corners and slow, considered travel.',
          image: '',
        },
        {
          name: 'Mạch Duy An',
          role: 'Head of Local Guides',
          bio: 'Leads our network of vetted, story-rich local guides across every region we cover.',
          image: '',
        },
        {
          name: 'Huỳnh Đại Nghĩa',
          role: 'Trip Designer',
          bio: 'Crafts each itinerary to balance iconic sights with unhurried, personal discoveries.',
          image: '',
        },
        {
          name: 'Nguyễn Khánh Minh',
          role: 'Guest Experience Lead',
          bio: 'Looks after every traveller from the first enquiry through to a safe return home.',
          image: '',
        },
      ],
    },
    story: {
      heading: 'Our story',
      subtitle:
        'From a single guided walk to journeys across the country — built slowly, with care.',
      // `image` per milestone (data-driven so real photos can replace these later
      // without touching the component); currently neutral Unsplash placeholders.
      milestones: [
        {
          year: '2013',
          title: 'A first guided walk',
          description:
            'It started with a handful of friends walking visitors through Hà Nội’s Old Quarter — pointing out the family-run pho stalls, the hidden temples and the stories behind each crumbling shophouse. Word spread, and the small walking tours quickly filled.',
          image:
            'https://images.unsplash.com/photo-1528127269322-539801943592?w=900&q=70&auto=format&fit=crop',
        },
        {
          year: '2016',
          title: 'Beyond the capital',
          description:
            'As travellers asked to see more of the country, we expanded north and east — overnight cruises among the karsts of Hạ Long Bay and multi-day treks through the rice terraces and hill-tribe villages of the northern highlands.',
          image:
            'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=900&q=70&auto=format&fit=crop',
        },
        {
          year: '2019',
          title: 'A network of local guides',
          description:
            'We built a vetted network of licensed local guides spanning all three regions of Vietnam — people who live where they lead, so every trip is rooted in real local knowledge rather than a script.',
          image:
            'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900&q=70&auto=format&fit=crop',
        },
        {
          year: '2024',
          title: 'Journeys, end to end',
          description:
            'Today we craft seamless trips from the first enquiry to a safe return home — flights, transfers, cruises, guides and hand-picked stays — for travellers from around the world, with a 24/7 hotline throughout.',
          image:
            'https://images.unsplash.com/photo-1535139262971-c51845709a48?w=900&q=70&auto=format&fit=crop',
        },
      ],
    },
  },
  tourGallery: {
    eyebrow: 'Gallery',
    shareLabel: 'Share this trip',
    imageAlt: 'Photograph from the trip',
  },
  gallery: {
    heading: 'Moments from the journey',
    subtitle:
      'A glimpse of the landscapes, towns, and quiet corners our travellers discover along the way.',
    viewer: {
      label: 'Photo viewer',
      previous: 'Previous photo',
      next: 'Next photo',
      close: 'Close viewer',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      counter: (current: number, total: number) => `${current} / ${total}`,
    },
  },
  // Tour-card availability badge (soft urgency — never "sold out").
  availability: {
    seatsLeft: (n: number) => `Only ${n} ${n === 1 ? 'seat' : 'seats'} left`,
    next: (date: string) => `Next: ${date}`,
    onRequest: 'On request',
  },
  paymentTrust: {
    heading: 'Book with confidence',
    subtitle: 'Every payment runs through secure, encrypted checkout — pay the way that suits you.',
    items: [
      { label: 'Secure checkout' },
      { label: 'SSL encrypted' },
      { label: 'Stripe payments' },
      { label: 'PayPal' },
    ],
  },
  // Dedicated `/faq` page — comprehensive, grouped Q&A.
  faqPage: {
    breadcrumbHome: 'Home',
    breadcrumbCurrent: 'FAQs',
    title: 'Frequently asked questions',
    subtitle:
      'Everything travellers ask us most, grouped so you can find your answer fast. Still unsure? Our team is one message away.',
    searchPlaceholder: 'Search questions…',
    searchLabel: 'Search frequently asked questions',
    noResults: 'No questions match your search. Try different keywords or contact our team.',
    ctaHeading: 'Still have a question?',
    ctaBody: 'Our trip designers reply within a day — tell us what you’re planning.',
    ctaButton: 'Ask our team',
    categories: [
      {
        title: 'Booking & payment',
        items: [
          {
            question: 'How do I book a tour?',
            answer:
              'Browse our tours, choose a departure date, and send an enquiry or book online. Our team confirms availability and guides you through secure payment.',
          },
          {
            question: 'What payment methods do you accept?',
            answer:
              'We accept major cards through Stripe and payments via PayPal. Every transaction runs through encrypted, secure checkout.',
          },
          {
            question: 'Do I pay a deposit or the full amount?',
            answer:
              'Most tours are held with a deposit, with the balance due before departure. The exact terms are shown on each tour before you confirm.',
          },
        ],
      },
      {
        title: 'Itineraries & customisation',
        items: [
          {
            question: 'Can itineraries be customised?',
            answer:
              'Yes — most journeys can be tailored to your pace, interests, and group size. Share your preferences in an enquiry and our trip designers will adapt the plan.',
          },
          {
            question: 'Can you arrange private or family tours?',
            answer:
              'Absolutely. We run private departures for couples, families, and small groups, with itineraries paced to suit everyone travelling.',
          },
          {
            question: 'Can you book flights, hotels, and transfers too?',
            answer:
              'We arrange domestic flights, hotels, and private transfers as part of your trip, so every leg is handled end to end.',
          },
        ],
      },
      {
        title: 'Guides & on-trip',
        items: [
          {
            question: 'Are your guides local and licensed?',
            answer:
              'Every trip is led by a vetted, licensed local guide chosen for their knowledge of the region and their care for travellers.',
          },
          {
            question: 'What is included in the tour price?',
            answer:
              'Inclusions are listed on each tour page — typically guiding, listed accommodation, transport, and the activities in the itinerary.',
          },
          {
            question: 'Is support available during the trip?',
            answer:
              'Yes. You have 24/7 on-trip support, so there is always someone to reach if plans change or you need a hand.',
          },
        ],
      },
      {
        title: 'Cancellations & changes',
        items: [
          {
            question: 'What is your cancellation policy?',
            answer:
              'Cancellation terms vary by tour and departure, and are shown on each tour page before you book. Our team is always happy to clarify the details.',
          },
          {
            question: 'Can I change my travel dates?',
            answer:
              'Date changes are usually possible subject to availability. Reach out as early as you can and we will do our best to re-arrange your trip.',
          },
          {
            question: 'What happens if you cancel a departure?',
            answer:
              'If we ever cancel a departure, you can move to another date or receive a full refund of what you paid us.',
          },
        ],
      },
      {
        title: 'Travelling in Vietnam',
        items: [
          {
            question: 'Do I need a visa?',
            answer:
              'Most nationalities can apply for a Vietnam e-visa online. Sort it a couple of weeks before you travel and we can point you to the official portal.',
          },
          {
            question: 'When is the best time to visit?',
            answer:
              'It depends on the region — the north is best in spring and autumn, the centre from February to August, and the south in the December–April dry season.',
          },
          {
            question: 'Is Vietnam safe for travellers?',
            answer:
              'Vietnam is very safe for visitors. Take the usual travel precautions, drink bottled water, and your guide will look after the rest.',
          },
        ],
      },
    ],
  },
  // AI concierge chat panel (spec 2026-07-14-ai-concierge-chat).
  chatBot: {
    title: 'Tourism Concierge',
    disclaimer: 'AI assistant — it can make mistakes. Tap WhatsApp for a human.',
    greeting:
      'Hi! I can help you find a tour, answer questions about itineraries and policies, or pass your details to our team. What are you planning?',
    suggestions: {
      findTour: 'Find me a tour',
      askIncluded: 'What’s included in a tour?',
      talkHuman: 'Talk to a human',
    },
    inputPlaceholder: 'Ask about tours, dates, what’s included…',
    send: 'Send',
    sendAria: 'Send message',
    startOver: 'Start over',
    openAria: 'Open chat panel',
    thinking: 'Thinking…',
    toolActivity: {
      searchTours: 'Searching tours…',
      getTourDetails: 'Checking tour details…',
      submitEnquiry: 'Sending your enquiry…',
    },
    error: 'Something went wrong. Please try again.',
    retry: 'Retry',
    unavailable:
      'The concierge is taking a break right now — please use WhatsApp or the enquiry form instead.',
  },
  // Floating contact launcher (channel popover; spec 2026-07-14-contact-launcher).
  contactLauncher: {
    trigger: 'Plan your trip',
    triggerAria: 'Open contact options',
    title: 'Talk to us',
    subtitle: 'Questions about a tour? We usually reply within 24 hours.',
    bot: {
      label: 'Chat with us',
      hint: 'Instant answers from our AI concierge.',
    },
    whatsapp: {
      label: 'Chat on WhatsApp',
      hint: 'Fastest reply — chat with a local expert.',
    },
    enquiry: {
      label: 'Send an enquiry',
      hint: 'Tell us about your trip and get a tailored quote.',
    },
    prefillGeneric: 'Hi Tourism! I have a question about planning a trip.',
    prefillTour: (title: string, url: string) =>
      `Hi Tourism! I’m interested in “${title}” — ${url}`,
  },
  contact: {
    heading: 'Contact us',
    breadcrumb: 'Contact',
    subtitle:
      'Questions about a tour, a custom itinerary, or an existing booking? Reach out — our local experts usually reply within 24 hours.',
    intro: {
      title: 'Happy to help',
      body: 'Questions about a tour, a custom itinerary, or an existing booking? Our team is here at every step of the journey.',
    },
    // Lead-capture section (Contact 01 layout): contact details + a real enquiry form.
    inquiry: {
      eyebrow: 'We can help',
      heading: 'Let’s plan your trip together',
      body: 'Tell us about the trip you have in mind and our local experts will craft a tailored itinerary — free and no obligation, with a reply within about 24 hours.',
      details: [
        { label: 'Phone', value: '1900 292 958' },
        { label: 'Email', value: 'tourism.platform.online@gmail.com' },
        { label: 'Location', value: 'Hồ Chí Minh City, Vietnam' },
      ],
      securePaymentsLabel: 'Secure payments',
      form: {
        title: 'Send us a message',
        firstNameLabel: 'First name',
        lastNameLabel: 'Last name',
        emailLabel: 'Email',
        interestLabel: 'Interest',
        messageLabel: 'Message',
        firstNamePlaceholder: 'First name',
        lastNamePlaceholder: 'Last name',
        emailPlaceholder: 'you@example.com',
        interestPlaceholder: 'What are you interested in?',
        interestOptions: [
          'Cruises',
          'Trekking',
          'Culture & heritage',
          'Food',
          'Beaches & islands',
          'Family',
        ],
        messagePlaceholder: 'Tell us about your dream trip, dates, group size, or any questions…',
        // Optional lead fields (same wording as the PlanTrip form's `fields`/`budgetLabel`).
        nationality: 'Nationality',
        nationalityPlaceholder: 'e.g. Australian',
        travelDate: 'Approx. arrival date',
        groupSize: 'Travellers',
        groupSizePlaceholder: 'e.g. 2',
        budget: 'Hotel preference',
        terms: 'I agree to be contacted about my enquiry.',
        submit: 'Send enquiry',
      },
    },
    officesHeading: 'Where we’re based',
    officesSubtitle:
      'Our local teams work out of Hà Nội and Hồ Chí Minh City — reach us any time through the form above.',
    getDirections: 'Open in Maps',
    offices: [
      {
        city: 'Hà Nội',
        lines: ['18 Tam Trinh, Tương Mai', 'Hà Nội, Vietnam'],
        hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
        mapHref: 'https://www.google.com/maps?q=18+Tam+Trinh,+Tuong+Mai,+Ha+Noi',
      },
      {
        city: 'Hồ Chí Minh City',
        lines: ['184 Lê Đại Hành, Phú Thọ', 'Hồ Chí Minh City, Vietnam'],
        hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
        mapHref: 'https://www.google.com/maps?q=184+Le+Dai+Hanh,+Phu+Tho,+Ho+Chi+Minh',
      },
    ],
    // Kept for the site footer's Information column.
    info: [
      {
        title: 'Office hours',
        lines: ['Monday – Friday', '8:00 am – 6:00 pm (GMT+7)'],
      },
      { title: 'Offices', lines: ['Hà Nội · Hồ Chí Minh City'] },
      { title: 'Call us', lines: ['1900 292 958'] },
      { title: 'Email us', lines: ['tourism.platform.online@gmail.com'] },
    ],
    // Short pre-sales FAQ for the contact page (curated from the full /faq).
    faq: {
      heading: 'Common questions',
      subtitle: 'Quick answers before you reach out.',
      seeAll: 'See all FAQs',
      items: [
        {
          q: 'How do I get in touch?',
          a: 'Send us a message using the form above — our trip designers reply within about 24 hours. You can also enquire from any tour page about that specific trip.',
        },
        {
          q: 'How quickly will you reply?',
          a: 'Within about 24 hours, and often sooner during Vietnam business hours.',
        },
        {
          q: 'Can you customise a trip or arrange private tours?',
          a: 'Yes — most journeys can be tailored to your pace, interests, dates, and group size. We run private departures for couples, families, and small groups.',
        },
        {
          q: 'What payment methods do you accept?',
          a: 'Major cards through Stripe and payments via PayPal, all through encrypted, secure checkout.',
        },
        {
          q: 'Do I pay a deposit or the full amount?',
          a: 'Most tours are held with a deposit, with the balance due before departure. The exact terms are shown on each tour before you confirm.',
        },
        {
          q: 'Do I have to book online?',
          a: 'No — you can simply send an enquiry and our team will check availability and guide you through the next steps.',
        },
      ],
    },
    ctaBand: {
      heading: 'Prefer to explore first?',
      subtitle: 'Browse our destinations and tours, or find quick answers in our FAQs.',
      cta: { label: 'Browse destinations', href: '/destinations' },
    },
  },
  // TravellerType enum → nhãn hiển thị cho hàng chip "Good for" ở trang chi tiết.
  // Khối `tours.suitableFor: 'Ideal for'` đứng ở đây trước 27/07 đã bị bỏ: nó là
  // key thứ hai cho cùng một nhãn, không ai dùng, và tiêu đề thật của khối là
  // `tourDetail.sections.goodFor`. Hai tên cho một thứ là cách copy bắt đầu lệch.
  travellerTypes: {
    FAMILY: 'Family trips',
    COUPLE: 'Couples',
    FRIENDS: 'Friends',
    SOLO: 'Solo travellers',
    BUSINESS: 'Business',
  },
  // ĐỌC TRƯỚC KHI THÊM KEY: khối này port trọn gói từ Nexora nên từng mô tả cả
  // những filter/sort mà API v2 KHÔNG phục vụ được. Tình trạng hiện tại
  // (27/07), đối chiếu ToursListQuerySchema:
  //   • API ĐỠ ĐƯỢC: category · destination · search · featured · sort
  //     (createdAt/basePrice/durationDays/title)
  //   • API CHƯA CÓ, đang lọc CLIENT trên mock: duration · price · difficulty
  //   • ĐÃ BỎ HẲN: sort theo popularity/rating (cột đã denormalize nhưng
  //     TourSortKeySchema không whitelist) · facet travelStyle/theme (schema
  //     không có, Nexora cũng phải tắt)
  // Nợ mở rộng contract ghi trong spec §8. Copy KHÔNG phải bằng chứng tính
  // năng tồn tại — luôn đối chiếu contract trước.
  toursPage: {
    breadcrumb: 'Tours',
    title: 'Every journey we run',
    subtitle:
      'Filter by destination, length, price or pace to find the trip that fits you — every one of them small-group, and led by someone who lives there.',
    filtersLabel: 'Filters',
    hideFilters: 'Hide filters',
    showFilters: 'Show filters',
    clearAll: 'Clear all',
    searchPlaceholder: 'Search by destination or tour name…',
    searchAriaLabel: 'Search tours',
    sortLabel: 'Sort by',
    sortOptions: {
      newest: 'Newest first',
      priceAsc: 'Price: low to high',
      priceDesc: 'Price: high to low',
      durationAsc: 'Duration: short to long',
    },
    resultCount: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
    /** Dòng trạng thái trong header drawer — biến header thành phản hồi sống
        thay vì nhãn tĩnh. */
    matchCount: (n: number) => `${n} ${n === 1 ? 'tour matches' : 'tours match'}`,
    /** Nhãn nút đóng drawer: lối thoát MANG KẾT QUẢ, không phải lệnh "Apply"
        (bộ lọc đã áp dụng tức thì). */
    showResults: (n: number) => `Show ${n} ${n === 1 ? 'tour' : 'tours'}`,
    resultSummary: (tours: number, destinations: number) =>
      `${tours} ${tours === 1 ? 'tour' : 'tours'} across ${destinations} destinations`,
    showing: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
    perPage: 'per page',
    perPageLabel: 'Tours per page',
    /** Tiêu đề khu vực kết quả. Khi có lọc thì nói rõ "6 of 16" — người dùng
        cần biết mình đang xem một phần của cái gì. */
    resultsHeading: (shown: number, total: number) =>
      shown === total
        ? `${total} ${total === 1 ? 'tour' : 'tours'}`
        : `${shown} of ${total} ${total === 1 ? 'tour' : 'tours'}`,
    facets: {
      category: 'Category',
      destination: 'Destination',
      duration: 'Duration',
      price: 'Price',
      difficulty: 'Pace',
      highlights: 'Highlights',
    },
    durationLabels: { '1': 'Day trip', '2-3': '2–3 days', '4+': '4+ days' },
    priceLabels: {
      '<100': 'Under $100',
      '100-300': '$100–$300',
      '300+': '$300+',
    },
    difficultyLabels: {
      EASY: 'Easy',
      MODERATE: 'Moderate',
      CHALLENGING: 'Challenging',
    },
    featuredLabel: 'Featured trips',
    featuredBadge: 'Featured',
    // ratingAvg null = chưa ai đánh giá, KHÁC 0. Card hiện nhãn này thay vì
    // "0.0" hay 5 sao rỗng.
    notRated: 'Not yet reviewed',
    activeFiltersLabel: 'Active filters',
    removeFilter: (label: string) => `Remove filter ${label}`,
    viewTour: 'View tour',
    perPerson: 'per person',
    /** Dải chặng trên card gợi ý chỉ hiện 2 chặng đầu; phần dư gộp thành "+2" để
        người đọc biết tour còn đi qua nơi khác chứ không tưởng nó chỉ có hai điểm.
        Tên các chặng bị gộp vẫn đọc được cho trình đọc màn hình (sr-only). */
    moreStops: (n: number) => `+${n}`,
    maxGroup: (n: number) => `Max ${n}`,
    durationValue: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    empty: {
      title: 'No tours match your filters',
      body: 'Try removing a filter or two to see more journeys.',
      cta: 'Clear all filters',
    },
    loadError: {
      title: 'We couldn’t load our tours',
      body: 'The tour catalogue didn’t load just now — this is usually momentary. Please try again.',
    },
  },
  // ĐỌC TRƯỚC KHI THÊM KEY: khối này đã được CẮT LẠI 27/07 theo TourDetailSchema.
  // Bản trước là 188 dòng port trọn gói từ Nexora và mô tả một trang KHÁC HẲN:
  // bữa ăn, hạng phòng, travel style/theme, gallery ảnh, 6 ô "why travel with
  // us", cộng 3 nhóm policy CỨNG và 6 câu FAQ CỨNG — trong khi contract v2 trả
  // `policies[]` và `faqs[]` THẬT theo từng tour. Không component nào tiêu thụ
  // nó, nên nó chỉ là copy nằm chờ ai đó dựng UI theo mình.
  //
  // Luật rút ra (spec §10): copy port trọn gói KHÔNG phải bằng chứng tính năng
  // tồn tại. Mỗi key dưới đây ánh xạ về đúng một field của contract hoặc một
  // nhãn UI có thật trên trang. Thêm key mới thì phải chỉ được ra field đó.
  tourDetail: {
    breadcrumb: 'Tours',

    // ── Hero ──
    /** Nhãn đứng trước giá thấp nhất khi khách chưa chọn đợt: "from $189". */
    fromPrice: 'from',
    /** ratingAvg null = CHƯA AI đánh giá, khác hẳn 0 điểm. Không bao giờ in "0.0". */
    notRated: 'New — no reviews yet',
    reviewCount: (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'review' : 'reviews'}`,
    groupSize: (n: number) => `Max ${n} guests`,
    durationValue: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    /** Hero hiện tối đa 2 badge rồi gộp phần dư thành một chip. */
    moreBadges: (n: number) => `+${n}`,
    /** Giá gạch cần nhãn đọc được: trình đọc màn hình không phát âm line-through,
        nghe trần hai con số cạnh nhau là hiểu sai giá nào đang có hiệu lực. Dùng
        ở cả hero và bảng đợt. */
    wasPrice: (amount: string) => `was ${amount}`,
    badges: {
      BEST_VALUE: 'Best value',
      LIMITED_OFFER: 'Limited offer',
      EXCLUSIVE: 'Exclusive',
      NEW: 'New',
      POPULAR: 'Popular',
    },

    // ── Traveller reviews ──
    // ĐỌC TRƯỚC KHI THÊM KEY: `PublicReviewSchema` chỉ có 7 field, và ba thứ khối
    // i18n port từ Nexora từng có đều KHÔNG dựng được:
    //   • `verified: 'Verified traveller'` — `source: VERIFIED|CURATED` chỉ tồn tại
    //     ở `AdminReviewSchema`, cố ý không phơi công khai. Huy hiệu đó sẽ khẳng
    //     định một điều dữ liệu công khai không xác nhận được.
    //   • phân bố sao — contract không trả số đếm theo từng mức.
    //   • sort/lọc — `ReviewsByTourQuerySchema` chỉ có page/pageSize/tourSlug.
    // Cũng không có CTA viết review: `create` cần auth + bookingCode và eligibility
    // đòi booking PAID + chuyến đã kết thúc; luồng booking chưa có trong web.
    reviews: {
      heading: 'Traveller reviews',
      /** Nói thẳng đây là review MỚI NHẤT, không gọi là "nổi bật" — contract không
          có tiêu chí nào để chọn ra cái nổi bật, nên gọi vậy là bịa. */
      recentLabel: 'Most recent',
      summary: (average: string, count: number) =>
        `${average} average from ${count} ${count === 1 ? 'review' : 'reviews'}`,
      seeAll: (count: number) => `See all ${count} ${count === 1 ? 'review' : 'reviews'}`,
      dialogTitle: (count: number) => `All ${count} ${count === 1 ? 'review' : 'reviews'}`,
      close: 'Close reviews',
      /** Tác giả đã xoá tài khoản — `PublicReviewSchema.authorName` là null và
          schema ghi rõ FE render đúng chuỗi này. Review vẫn ở lại vì nó là đánh giá
          thật; chỉ danh tính biến mất. */
      deletedAuthor: 'Deleted account',
      ratingLabel: (rating: number) => `${rating} out of 5 stars`,
      /** Trạng thái rỗng: mời hành động chứ không chỉ thông báo. Nhưng KHÔNG mời
          viết review (chưa có luồng) — mời hỏi, trang /contact có thật. */
      emptyTitle: 'No reviews yet',
      emptyBody: 'This trip is new. Ask us anything about it and we will answer from experience.',
    },

    // ── Gallery ảnh ──
    gallery: {
      /** Nhãn khu ảnh cho trình đọc màn hình. Không có tiêu đề nhìn thấy: khảm ảnh
          nằm ngay dưới hero, nó tự nói nó là gì. */
      label: 'Photos',
      viewAll: (n: number) => `View all ${n} photos`,
      /** Tên khả truy cập của từng ô khảm. Nói VỊ TRÍ chứ không nói nội dung: nội
          dung nằm ở `alt` và chỉ hiện thành chú thích trong lightbox — ô khảm bịa
          mô tả ảnh là nói dối về thứ mình không biết. */
      openPhoto: (index: number, total: number) => `Open photo ${index} of ${total}`,
      /** Dialog của Base UI BẮT BUỘC có title cho trợ năng, kể cả khi ẩn thị giác. */
      dialogTitle: 'Tour photos',
      counter: (index: number, total: number) => `${index} / ${total}`,
      previous: 'Previous photo',
      next: 'Next photo',
      close: 'Close photos',
    },

    // ── Route ribbon ──
    route: {
      label: 'Route',
      /** Tour một điểm đến: KHÔNG vẽ sơ đồ chặng — một chấm đơn độc trên một
          đường kẻ là sơ đồ của thứ không phải hành trình. Chỉ nói nó ở đâu. */
      single: (place: string) => `Based in ${place}`,
      viewTours: (place: string) => `See tours in ${place}`,
    },

    // ── Tiêu đề section ──
    // ĐÂY LÀ NGUỒN CỦA ID ANCHOR: page.tsx dựng mục lục bằng tocFromSections()
    // rồi slugify chính các chuỗi này thành `id` của <section>. Sửa chữ ở đây là
    // đổi URL fragment — link #cũ mà ai đã chia sẻ sẽ chết.
    sections: {
      why: 'Why this trip',
      goodFor: 'Good for',
      itinerary: 'Itinerary',
      included: 'What’s included',
      departures: 'All departures',
      reviews: 'Traveller reviews',
      goodToKnow: 'Good to know',
      related: 'You might also like',
    },

    // ── Dải khởi hành + rail booking + bảng đợt ──
    departures: {
      /** Dải chip ngay dưới hero — 4–6 đợt gần nhất. */
      stripHeading: 'Next departures',
      /** Link từ dải xuống bảng đầy đủ. Cả 8 sản phẩm đã khảo sát đều có
          affordance "See all dates"; ta đảo pattern (đưa ngày lên đầu) nhưng vẫn
          giữ đường dẫn tới bảng, vì dải chỉ hiện 4–6 đợt gần nhất. */
      seeAll: (n: number) => `See all ${n} dates`,
      railLabel: 'Your departure',
      /** departures[] rỗng: dải và rail đổi sang dòng này + CTA hỏi. */
      none: 'No departures scheduled yet',
      noneBody: 'Dates for this trip are still being confirmed. Ask us and we’ll tell you first.',
      /** Ba nhãn ghế = suy diễn ở tầng UI từ seatsLeft (ngưỡng 0 / 1–3 / >3 trong
          departureStatus). Contract KHÔNG có field `status` — đừng đi tìm. */
      soldOut: 'Sold out',
      seatsLimited: (n: number) => `Only ${n} ${n === 1 ? 'seat' : 'seats'} left`,
      seatsAvailable: (n: number) => `${n} seats available`,
      /** Nhãn ĐỌC ĐƯỢC cho nút chọn trong bảng đợt: nhãn hiện ra chỉ có "Select"
          nên nghe trần 4 nút "Select" giống nhau là không biết chọn cái nào. */
      select: (range: string) => `Select departure ${range}`,
      selectLabel: 'Select',
      selected: 'Selected',
      columns: {
        dates: 'Dates',
        length: 'Length',
        availability: 'Availability',
        price: 'Price',
      },
    },

    booking: {
      /** `Reserve` là <button> KHÔNG điều hướng — /tours/[slug]/book chưa tồn tại
          và luật cấm đẩy người dùng vào 404 (spec §6.6). */
      reserve: 'Reserve',
      ask: 'Ask about this trip',
      perPerson: 'per person',
      /** Sandbox nói đúng HAI chỗ (spec §6.5): câu ngắn sát nút — nơi người dùng
          thật sự phân vân; câu dài ở chân bảng giá — nơi con số dày nhất. Không
          banner đỏ: banner phá nhịp trang và làm sản phẩm trông như bản nháp. */
      testMode: 'Test mode — no card is charged.',
      sandboxNote:
        'Prices are for demonstration. Checkout runs on Stripe and PayPal sandbox accounts.',
    },

    // ── Itinerary ──
    itinerary: {
      dayLabel: (n: number) => `Day ${n}`,
      /** meetingPoint gắn vào Day 1: nó là thông tin của NGÀY ĐẦU, không phải
          của cả tour. */
      meetAt: (place: string) => `Meet at ${place}`,
    },

    // ── Included / Not included ──
    inclusions: {
      included: 'Included',
      excluded: 'Not included',
      /** Một bên rỗng thì cột đó hiện dấu này và GIỮ nguyên lưới 2 cột — bỏ cột
          đi là hai tour cạnh nhau có bố cục khác nhau. */
      empty: '—',
    },

    // ── Good to know: FAQ + policy theo nhóm ──
    goodToKnow: {
      faqHeading: 'Questions travellers ask',
      policyHeading: 'Policies',
      /** PolicyKind enum → nhãn nhóm. Thứ tự nhóm do groupPoliciesByKind quyết
          định (Cancellation trước — đó là thứ khách lo nhất). */
      policyKinds: {
        CANCELLATION: 'Cancellation',
        BOOKING: 'Booking & payment',
        GENERAL: 'General',
      },
    },
  },
  enquiryCta: {
    heading: 'Plan your trip',
    // Contextual heading variants so the same CTA doesn't read identically on every page.
    headings: {
      home: 'Ready to explore Vietnam?',
      faq: 'Still have a question in mind?',
      destinations: 'Not sure where to begin?',
      about: 'Let’s craft your journey together',
      blog: (title: string) => `Turn "${title}" into your own journey`,
    },
    regionHeading: (region: string) => `Plan your trip to ${region}`,
    subtitle:
      'Tell us how you like to travel and our local experts will craft an itinerary that fits you.',
    cta: 'Start planning',
    benefits: [
      'Tailored to your pace & interests',
      'Local experts — no middlemen',
      'A no-obligation itinerary & quote',
    ],
    form: {
      name: 'Your name',
      namePlaceholder: 'e.g. Alex Carter',
      email: 'Email address',
      emailPlaceholder: 'you@example.com',
      destination: 'Where would you like to go?',
      destinationPlaceholder: 'e.g. Hạ Long Bay, Hội An',
    },
    note: 'Free and no-obligation — we usually reply within 24 hours.',
  },
  // Rich multi-field enquiry form ("Plan your trip") — maps the Enquiry model.
  planTrip: {
    heading: 'Plan your trip',
    subtitle:
      'Tell our local experts a little about your trip and we’ll craft a tailored itinerary and quote — free and no obligation.',
    benefits: [
      'Tailored to your pace, dates & budget',
      'Designed by local experts — no middlemen',
      'A no-obligation itinerary & quote in ~24h',
    ],
    fields: {
      name: 'Your name',
      namePlaceholder: 'e.g. Alex Carter',
      email: 'Email',
      emailPlaceholder: 'you@example.com',
      phone: 'Phone / WhatsApp',
      phonePlaceholder: 'Optional',
      nationality: 'Nationality',
      nationalityPlaceholder: 'e.g. Australian',
      travelDate: 'Approx. arrival date',
      travellers: 'Travellers',
      travellersPlaceholder: 'e.g. 2',
      message: 'Anything else?',
      messagePlaceholder: 'Tell us about your dream trip, must-sees, or any questions…',
    },
    durationLabel: 'How long in Vietnam?',
    duration: ['1–3 days', '4–6 days', 'About a week', '2+ weeks'],
    budgetLabel: 'Hotel preference',
    budget: ['Comfort · 3★', 'Premium · 4★', 'Luxury · 5★'],
    interestsLabel: 'What are you into?',
    interests: ['Cruises', 'Trekking', 'Culture & heritage', 'Food', 'Beaches & islands', 'Family'],
    submit: 'Send enquiry',
    note: 'Free and no-obligation — we usually reply within 24 hours.',
  },
  // Generic per-field error copy for the public web forms (enquiry family, booking contact,
  // account security). Keys are the stable `FieldErrorCode` values from the web form validator;
  // the auth forms keep their own copy under `auth.fieldErrors`.
  fieldErrors: {
    name: {
      REQUIRED: 'Enter your name.',
    },
    firstName: {
      REQUIRED: 'Enter your first name.',
    },
    lastName: {
      REQUIRED: 'Enter your last name.',
    },
    email: {
      REQUIRED: 'Enter your email address.',
      INVALID: 'Enter a valid email address, e.g. you@example.com.',
    },
    terms: {
      REQUIRED: 'Please accept the terms to continue.',
    },
    contactName: {
      REQUIRED: 'Enter the lead traveller’s name.',
    },
    contactEmail: {
      REQUIRED: 'Enter the lead traveller’s email address.',
      INVALID: 'Enter a valid email address, e.g. you@example.com.',
    },
    rating: {
      RATING_REQUIRED: 'Select a rating from 1 to 5 stars.',
    },
    title: {
      TITLE_TOO_LONG: 'Keep the title under 120 characters.',
    },
    body: {
      BODY_REQUIRED: 'Write a short review.',
      BODY_TOO_SHORT: 'Reviews need at least 10 characters.',
      BODY_TOO_LONG: 'Keep your review under 2000 characters.',
    },
  } as Record<string, Record<string, string>>,
  // Shared submit/feedback states for both enquiry forms (enquiryCta + planTrip).
  enquiryForm: {
    submitting: 'Sending…',
    success: 'Thank you — your enquiry is on its way!',
    successBody: 'Our local experts will get back to you within about 24 hours.',
    errorGeneric:
      'Something went wrong sending your enquiry. Please try again, or email us directly.',
    rateLimited: 'You’ve sent a few enquiries already — please wait a minute and try again.',
  },
  blog: {
    heading: 'Travel guides & stories',
    subtitle:
      'Practical guides and slow-travel inspiration from our local experts — to help you plan with confidence.',
    viewAll: 'Read the journal',
    readMore: 'Read more',
    featuredLabel: 'Featured',
    indexTitle: 'Travel journal',
    breadcrumb: 'Journal',
    minRead: (minutes: number) => `${minutes} min read`,
    byline: (brand: string) => `By the ${brand} team`,
    outlineHeading: 'In this post',
    moreHeading: 'More from the journal',
    backToBlog: 'Back to the journal',
    emptyTitle: 'No stories yet',
    emptyBody: 'We are writing our first guides now - check back soon.',
    bylineNamed: (name: string) => `By ${name}`,
    toursHeading: 'Tours in this story',
    topicsLabel: 'Topics',
    allTag: 'All',
    searchPlaceholder: 'Search the journal…',
    searchLabel: 'Search articles',
    emptyFilteredBody: 'Nothing matches that filter yet - clear it to see every story.',
    clearFilters: 'Clear filters',
    updatedOn: (date: string) => `Updated ${date}`,
    shareLabel: 'Share this story',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    shareOnFacebook: 'Share on Facebook',
    shareOnX: 'Share on X',
    newerStory: 'Newer story',
    olderStory: 'Older story',
    postNavLabel: 'Continue reading',
  },
  footer: {
    tagline: 'Boutique heritage journeys across Vietnam, crafted with care.',
    motto: 'Travel that earns your trust',
    infoHeading: 'Information',
    toursHeading: 'Tours & service',
    socialHeading: 'Follow us',
    mapHeading: 'Find us on map',
    viewOnMap: 'View on map',
    ctaHeading: 'Ready to explore Vietnam? Talk to a local expert.',
    ctaButton: 'Get in touch',
    newsletterHeading: 'Travel inspiration',
    newsletterText: 'Seasonal offers and new journeys, straight to your inbox.',
    newsletterPlaceholder: 'Your email',
    newsletterCta: 'Subscribe',
    newsletterSubmitting: 'Subscribing…',
    newsletterSuccess: 'You are on the list — see you in your inbox.',
    newsletterInvalid: 'Please enter a valid email address.',
    newsletterRateLimited: 'Too many attempts — please try again in a minute.',
    newsletterError: 'Something went wrong — please try again.',
    browseHeading: 'Browse tours',
    allTours: 'All tours',
    exploreHeading: 'Explore',
    explore: [
      { label: 'Tours', href: '/tours' },
      { label: 'Destinations', href: '#destinations' },
      { label: 'About us', href: '#about' },
      { label: 'Contact', href: '#contact' },
    ],
    supportHeading: 'Support',
    support: [
      { label: 'About us', href: '/about' },
      { label: 'FAQs', href: '/faq' },
      { label: 'Travel journal', href: '/blog' },
      { label: 'Cancellation & Refunds', href: '/cancellation-policy' },
      { label: 'Privacy Statement', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Contact', href: '/contact' },
    ],
    contactHeading: 'Contact',
    email: 'tourism.platform.online@gmail.com',
    phone: '1900 292 958',
    rights: 'All rights reserved.',
  },
  wishlist: {
    saved: 'Saved to wishlist.',
    removed: 'Removed from wishlist.',
    error: 'Something went wrong — please try again.',
  },
  // "Rate this trip" review-creation form on a PAID booking's detail page.
  reviews: {
    heading: 'Rate this trip',
    ratingLabel: 'Your rating',
    ratingValueLabel: (n: number) => `${n} star${n > 1 ? 's' : ''}`,
    titleLabel: 'Title (optional)',
    titlePlaceholder: 'Sum up your trip in a few words',
    bodyLabel: 'Your review',
    bodyPlaceholder: 'Tell other travellers about your experience…',
    submit: 'Submit review',
    submitting: 'Submitting…',
    successTitle: 'Thanks for your review',
    successBody: 'Your review is awaiting moderation — thank you for sharing your trip.',
    alreadyReviewedTitle: 'You’ve already reviewed this trip',
    alreadyReviewedBody: 'Thanks again for sharing your experience with other travellers.',
    // Friendly EN for each `POST /reviews` error code (+ generic fallback).
    errors: {
      USER_NOT_SYNCED: 'We couldn’t verify your account. Sign out and back in, then try again.',
      REVIEW_NOT_ELIGIBLE: 'This booking isn’t eligible for a review yet.',
      BOOKING_FORBIDDEN: 'This booking doesn’t belong to your account.',
      BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
      REVIEW_ALREADY_EXISTS: 'You’ve already reviewed this trip.',
      generic: 'Something went wrong. Please try again.',
    } as Record<string, string>,
  },
  // Mobile app (P5, customer-facing Expo app).
  mobile: {
    tabs: {
      home: 'Home',
      explore: 'Explore',
      trips: 'Trips',
      saved: 'Saved',
      account: 'Account',
    },
    legal: {
      updated: (date: string) => `Last updated ${date}`,
      agreePrefix: 'By creating an account you agree to our ',
      agreeTerms: 'Terms',
      agreeAnd: ' and ',
      agreePrivacy: 'Privacy Policy',
    },
    onboarding: {
      skip: 'Skip',
      next: 'Next page',
      pages: [
        {
          title: 'Explore the wonders of Vietnam',
          location: 'Hà Giang, Việt Nam',
        },
        {
          title: 'Journeys crafted around you',
          location: 'Hạ Long Bay, Việt Nam',
        },
        {
          title: 'Travel with complete peace of mind',
          location: 'Sa Pa, Việt Nam',
        },
      ],
      signIn: 'Sign in',
      guest: 'Explore as guest',
    },
    home: {
      greetings: {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
      },
      greetingWithName: (greeting: string, name: string) => `${greeting}, ${name}`,
      tagline: 'Where to next?',
      searchPlaceholder: 'Search tours & destinations',
      upcomingTitle: 'Your next trip',
      savedTitle: 'Recently saved',
      seeAll: 'See all',
      featuredTitle: 'Featured tours',
      destinationsTitle: 'Popular destinations',
      slowServer: 'Waking the server — the first load can take up to a minute…',
      error: "Couldn't load tours. Check your connection and try again.",
      retry: 'Try again',
      empty: 'No tours to show yet — check back soon.',
      from: 'From',
      durationDays: (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`,
      // P5.7 S4 — Screen-17 region browser
      welcome: 'Welcome',
      guestName: 'Traveller',
      browseHeadline: 'Recommendations',
      recommendedEyebrow: 'Recommended',
      searchButton: 'Search tours and destinations',
      regionShort: {
        'Northern Vietnam': 'North',
        'Central Vietnam': 'Central',
        'Southern Vietnam': 'South',
      } as Record<string, string>,
      regionEmpty: 'No destinations in this region yet.',
    },
    explore: {
      title: 'Explore tours',
      searchPlaceholder: 'Search tours or destinations',
      destinationsTitle: 'Destinations',
      resultsCount: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
      empty: 'No tours match your search.',
      clearFilters: 'Clear filters',
      filtersCta: 'Filters',
      showResults: (n: number) => `Show ${n} ${n === 1 ? 'result' : 'results'}`,
      clearAll: 'Clear all',
      durationTitle: 'Duration',
      priceTitle: 'Price',
      sortTitle: 'Sort by',
      error: "Couldn't load tours. Check your connection and try again.",
      retry: 'Try again',
      slowServer: 'Waking the server — the first load can take up to a minute…',
      duration: { '1': '1 day', '2-3': '2–3 days', '4+': '4+ days' },
      price: {
        '<100': 'Under $100',
        '100-300': '$100–300',
        '300+': 'Over $300',
      },
      sort: {
        popular: 'Popular',
        'price-asc': 'Price: low first',
        'price-desc': 'Price: high first',
        rating: 'Top rated',
      },
    },
    tourDetail: {
      overviewTitle: 'Overview',
      highlightsTitle: 'Highlights',
      itineraryTitle: 'Itinerary',
      includedTitle: "What's included",
      excludedTitle: "What's not included",
      reviewsTitle: 'Reviews',
      faqsTitle: 'FAQs',
      policiesTitle: 'Policies',
      dayLabel: (day: number) => `Day ${day}`,
      maxGroup: (n: number) => `Up to ${n} guests`,
      reviewsLine: (rating: number, count: number) =>
        `★ ${rating.toFixed(1)} (${count} ${count === 1 ? 'review' : 'reviews'})`,
      nextDeparture: (date: string) => `Next departure: ${date}`,
      seatsLeft: (n: number) => `${n} ${n === 1 ? 'seat' : 'seats'} left`,
      showAllDays: (n: number) => `Show all ${n} days`,
      showAllFaqs: (n: number) => `Show all ${n} FAQs`,
      seeAllReviews: (n: number) => `See all ${n} reviews`,
      from: 'From',
      inquireNow: 'Inquire now',
      notFound: "This tour isn't available anymore.",
      goBack: 'Go back',
      error: "Couldn't load this tour.",
      retry: 'Try again',
    },
    enquiry: {
      title: 'Inquire about this tour',
      nameLabel: 'Full name',
      emailLabel: 'Email',
      phoneLabel: 'Phone (optional)',
      messageLabel: 'Message',
      messagePlaceholder: 'Tell us about your dates, group size and questions…',
      submit: 'Send enquiry',
      success: "Thanks! We'll get back to you within 24 hours.",
      errors: {
        nameRequired: 'Please enter your name.',
        emailInvalid: 'Please enter a valid email address.',
        messageRequired: 'Please write a short message.',
        generic: "Couldn't send your enquiry. Please try again.",
        rateLimited: 'Too many requests — please wait a minute and try again.',
      },
    },
    booking: {
      bookCta: 'Book now',
      departuresError: "Couldn't load departures.",
      soldOut: 'Sold out',
      stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
      continueCta: 'Continue',
      tripHeading: 'Your trip',
      editTrip: 'Edit',
      stepperDecrease: (field: string) => `Decrease ${field}`,
      stepperIncrease: (field: string) => `Increase ${field}`,
      browserHint:
        "Complete your payment in the secure browser window - we'll confirm your booking here when you're back.",
      openCheckout: 'Open payment page',
      verifying: 'Confirming your payment…',
      verifyAgain: 'Verify again',
      stillPendingTitle: 'Payment not confirmed yet',
      stillPendingBody:
        "We haven't received the payment confirmation yet. If you just paid, it can take a moment - verify again in a few seconds (don't pay twice). If you didn't finish paying, you can pay now.",
      viewBooking: 'View booking',
      browseTours: 'Browse more tours',
      resultError: "Couldn't check your booking. Please try again.",
      listError: "Couldn't load your bookings.",
      detailError: "Couldn't load this booking.",
      retry: 'Try again',
    },
    authPrompts: {
      wishlistReason: 'Sign in to save tours you love.',
      bookingReason: 'Sign in to book this tour.',
      savedGateTitle: 'Save tours you love',
      savedGateBody: 'Sign in to keep a wishlist of tours and find them here anytime.',
      accountGateTitle: 'Your account',
      accountGateBody: 'Sign in to manage your profile and saved tours.',
      signIn: 'Sign in',
      createAccount: 'Create account',
      resetSentHint: 'Open the link on any device — you will set the new password on our website.',
    },
    authErrors: {
      invalidCredentials: 'Email or password is incorrect.',
      emailTaken: 'An account with this email already exists.',
      weakPassword: 'Password is too weak — use at least 8 characters.',
      generic: 'Something went wrong. Please try again.',
      nameRequired: 'Please enter your name.',
      emailInvalid: 'Please enter a valid email address.',
      passwordRequired: 'Please enter your password.',
      passwordTooShort: 'Use at least 8 characters.',
      confirmMismatch: 'Passwords do not match.',
    },
    account: {
      editNameLabel: 'Display name',
      editNameSave: 'Save',
      editNameSaving: 'Saving…',
      editNameSaved: 'Name updated.',
      editNameError: "Couldn't update your name. Please try again.",
      menuSaved: 'Saved tours',
      menuPrivacy: 'Privacy policy',
      menuTerms: 'Terms of service',
      menuCancellation: 'Cancellation & refund policy',
      signOut: 'Sign out',
      loadError: "Couldn't load your profile.",
      retry: 'Try again',
    },
    saved: {
      title: 'Saved tours',
      empty: 'Nothing saved yet — tap the heart on any tour.',
      browse: 'Browse tours',
      removeLabel: 'Remove from saved',
      heartSaveLabel: 'Save tour',
      heartUnsaveLabel: 'Remove from saved',
      error: "Couldn't load your saved tours.",
      retry: 'Try again',
    },
  },
} as const;

export type Messages = typeof messages;
