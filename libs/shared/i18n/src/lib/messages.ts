// Centralized user-facing copy (EN-only, ADR-0005). Surfaces read from here — no inline strings.
// `as const` keeps literal types so consumers get autocomplete + safety.

export const messages = {
  brand: {
    name: 'Nexora',
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
    eyebrow: 'Why travelers choose Nexora',
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
        subtitle: 'Your journeys with Nexora, all in one place.',
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
  },
  // Shared pagination aria-labels (tours listing · region tours · blog).
  pagination: {
    first: 'Go to first page',
    previous: 'Go to previous page',
    next: 'Go to next page',
    last: 'Go to last page',
  },
  // Page <title>/description copy. Titles are PLAIN — the root layout's title.template
  // (`%s — Nexora`) appends the brand, so never suffix the brand here (would double it).
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
  // Resilience layer (W2): loading/error/404 states across web. Copy is warm + reassuring.
  resilience: {
    loadError: {
      title: 'We couldn’t load this',
      body: 'Something interrupted the connection. Please try again in a moment.',
      retry: 'Try again',
    },
    error: {
      title: 'Something went wrong',
      body: 'An unexpected error occurred on our end. Please try again — if it keeps happening, get in touch.',
      retry: 'Try again',
      home: 'Back home',
    },
    notFound: {
      title: 'Page not found',
      body: 'The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.',
      home: 'Back home',
      tours: 'Browse tours',
      blog: 'Read the journal',
    },
    globalError: {
      title: 'Something went wrong',
      body: 'The page failed to load. Please reload to try again.',
      retry: 'Reload',
    },
    checkoutError: {
      title: 'We’re confirming your payment',
      body: 'Your payment is safe. We hit a snag loading this page, but your booking isn’t lost — try again, or check your trips in a moment.',
      retry: 'Try again',
      account: 'View my trips',
    },
  },
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
    destinationsMenu: {
      label: 'Destinations',
      items: [
        {
          label: 'All destinations',
          href: '/destinations',
          hint: 'Browse every place we cover',
        },
        {
          label: 'Northern Vietnam',
          href: '/destinations/northern-vietnam',
          hint: 'Hạ Long, Sa Pa, Ninh Bình',
        },
        {
          label: 'Central Vietnam',
          href: '/destinations/central-vietnam',
          hint: 'Hội An, Huế, Đà Nẵng',
        },
        {
          label: 'Southern Vietnam',
          href: '/destinations/southern-vietnam',
          hint: 'Mekong, Hồ Chí Minh City',
        },
      ],
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
  // `/destinations` overview page.
  destinationsPage: {
    breadcrumbHome: 'Home',
    breadcrumbCurrent: 'Vietnam tours',
    heroTitle: 'Explore Vietnam by destination',
    heroSubtitle: 'From the misty north to the Mekong south — choose where your journey begins.',
    regionHeading: (region: string) => `Top destinations in ${region}`,
    // Short editorial blurb under each region heading (keyed by canonical region).
    regionIntro: {
      'Northern Vietnam':
        'Limestone bays, terraced highlands and the wild frontier passes — the north is Vietnam at its most dramatic.',
      'Central Vietnam':
        'Imperial heritage, lantern-lit old towns and a golden coastline strung between the mountains and the sea.',
      'Southern Vietnam':
        'River deltas, island beaches and the restless energy of Sài Gòn — the warm, easy-going south.',
    } as Record<string, string>,
    viewMore: 'View more',
    popularHeading: 'Most popular journeys',
    popularSubtitle: 'Traveller favourites across the country.',
    popularViewAll: 'View all tours',
  },
  // `/destinations/[slug]` destination page.
  destinationDetail: {
    backToAll: 'All destinations',
    toursHeading: (name: string) => `Tours in ${name}`,
    noTours: 'New journeys for this destination are coming soon.',
    valuePropsHeading: 'We’ve got you covered',
    valueProps: [
      {
        title: 'Luxury transfers',
        body: 'Door-to-door comfort with vetted private drivers on every leg of the trip.',
      },
      {
        title: 'Unique itineraries',
        body: 'Journeys shaped by local experts — not scripted, off-the-shelf tours.',
      },
      {
        title: 'Epic meals',
        body: 'Eat where Vietnam eats, from street stalls to riverside kitchens.',
      },
    ],
  },
  // `/destinations/[region]` region pages.
  regionPage: {
    backToAll: 'All destinations',
    introHeading: (region: string) => `The best ${region} tours`,
    itinerariesCta: (region: string) => `${region} itineraries`,
    bestForLabel: 'Best for',
    highlightsHeading: (region: string) => `What makes ${region} special`,
    toursHeading: 'Tours',
    allTab: 'All',
    noTours: 'New tours for this destination are coming soon.',
    galleryHeading: (region: string) => `${region} in photos`,
    gallerySubtitle: 'A glimpse of the landscapes, towns, and moments that await.',
    regions: {
      'Northern Vietnam': {
        tagline: 'From Sa Pa to Hạ Long Bay — culture and natural wonders in the misty north.',
        intro:
          'Awe-inspiring landscapes of limestone bays and terraced highlands, diverse hill-tribe cultures, and the frontier passes of the far north — this is Northern Vietnam at its most dramatic.',
        intro2:
          'Cruise the emerald karsts of Hạ Long, trek between Hmong and Dao villages around Sa Pa, and ride the legendary Hà Giang Loop. Browse our tours below, or read our itinerary suggestions.',
        tags: ['Cruises', 'Trekking', 'Hill-tribe culture', 'Mountain passes'],
        highlights: [
          {
            title: 'Emerald bays',
            body: 'Overnight on a junk among the limestone islands of Hạ Long and Lan Hạ.',
          },
          {
            title: 'Highland treks',
            body: 'Walk the rice terraces and hill-tribe trails around Sa Pa and Pù Luông.',
          },
          {
            title: 'The northern loop',
            body: 'Ride the switchbacks of Hà Giang past the Mã Pí Lèng pass.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Great northern adventures',
          body: 'The north rewards travellers who go further — onto the water, into the mountains, and out to the frontier. These are the journeys that define the region.',
          points: [
            'Overnight cruises through Hạ Long & Lan Hạ Bay',
            'Multi-day treks with Hmong and Dao guides',
            'The Hà Giang Loop and the far-northern passes',
          ],
          stats: [
            { value: '3+', label: 'Mountain regions' },
            { value: '2D 1N', label: 'Overnight cruises' },
            { value: '350km', label: 'The Hà Giang Loop' },
            { value: '3,143m', label: 'Fansipan summit' },
          ],
        },
      },
      'Central Vietnam': {
        tagline: 'Imperial heritage, lantern-lit old towns and a golden coastline.',
        intro:
          'Ancient citadels and UNESCO old towns beside white-sand beaches, and some of the world’s largest cave systems — Central Vietnam is the country’s cultural heart.',
        intro2:
          'Step inside the walled citadel of Huế, wander the lantern-lit lanes of Hội An, and explore the Chăm temples of Mỹ Sơn. Browse our tours below, or read our itinerary suggestions.',
        tags: ['Heritage', 'Old towns', 'Beaches', 'Caves'],
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
            body: 'Đà Nẵng’s beaches and the Marble Mountains, the Bà Nà hills above.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'The heritage trail',
          body: 'Few stretches of Vietnam hold so much history in so little distance. Follow the thread of empires and trade from the citadel to the old port.',
          points: [
            'The walled citadel and royal tombs of Huế',
            'Lantern-lit Hội An and the Thu Bồn river',
            'The Chăm sanctuary of Mỹ Sơn',
          ],
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
      'Southern Vietnam': {
        tagline: 'River deltas, island beaches and the restless energy of Sài Gòn.',
        intro:
          'Floating markets and flooded paddies, cosmopolitan cities and tropical islands — the warm, easy-going south runs at the pace of the water.',
        intro2:
          'Drift the Mekong’s waterways, trace history from the Củ Chi tunnels to the colonial centre, and unwind on the beaches of Phú Quốc. Browse our tours below, or read our itinerary suggestions.',
        tags: ['River life', 'Islands', 'City & history', 'Street food'],
        highlights: [
          {
            title: 'The Mekong',
            body: 'Floating markets at dawn, orchards, and riverside homestays.',
          },
          {
            title: 'Sài Gòn energy',
            body: 'Củ Chi tunnels, colonial landmarks, and endless street food.',
          },
          {
            title: 'Island escapes',
            body: 'White-sand beaches and clear seas on Phú Quốc.',
          },
        ],
        signature: {
          eyebrow: 'Signature',
          heading: 'Life on the water',
          body: 'In the south, the river is the road. Slow down to the rhythm of the delta and the islands, where days unfold on boats and beaches.',
          points: [
            'Dawn floating markets on the Mekong Delta',
            'Riverside homestays and orchard villages',
            'Island hopping around Phú Quốc',
          ],
          postcards: [
            {
              title: 'The Mekong Delta',
              caption: 'Floating markets & waterways',
            },
            { title: 'Sài Gòn', caption: 'City energy & history' },
            { title: 'Phú Quốc', caption: 'Island beaches' },
          ],
        },
      },
    } as Record<
      string,
      {
        tagline: string;
        intro: string;
        intro2: string;
        tags: string[];
        highlights: { title: string; body: string }[];
        signature: {
          eyebrow: string;
          heading: string;
          body: string;
          points: string[];
          stats?: { value: string; label: string }[];
          timeline?: { title: string; era: string; body: string }[];
          postcards?: { title: string; caption: string }[];
        };
      }
    >,
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
    title: 'Nexora Concierge',
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
    prefillGeneric: 'Hi Nexora! I have a question about planning a trip.',
    prefillTour: (title: string, url: string) => `Hi Nexora! I’m interested in “${title}” — ${url}`,
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
  // Shared tour merchandising copy (card + detail).
  tours: {
    suitableFor: 'Ideal for',
  },
  // TravellerType enum → display label (tour card compact row + detail "Ideal for" chips).
  travellerTypes: {
    FAMILY: 'Family trips',
    COUPLE: 'Couples',
    FRIENDS: 'Friends',
    SOLO: 'Solo travellers',
    BUSINESS: 'Business',
  },
  toursPage: {
    breadcrumb: 'Tours',
    title: 'All tours',
    subtitle:
      'Browse every journey we run — filter by destination, length, travel style and theme to find the trip that fits you.',
    filtersLabel: 'Filters',
    hideFilters: 'Hide filters',
    showFilters: 'Show filters',
    clearAll: 'Clear all',
    searchPlaceholder: 'Search by destination or tour name…',
    searchAriaLabel: 'Search tours',
    sortLabel: 'Sort by',
    sortOptions: {
      popular: 'Most popular',
      priceAsc: 'Price: low to high',
      priceDesc: 'Price: high to low',
      rating: 'Top rated',
    },
    resultCount: (n: number) => `${n} ${n === 1 ? 'tour' : 'tours'}`,
    perPage: 'Per page',
    showing: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
    facets: {
      destination: 'Destination',
      category: 'Category',
      duration: 'Duration',
      travelStyle: 'Travel style',
      theme: 'Theme',
      price: 'Price',
    },
    durationLabels: { '1': 'Day trip', '2-3': '2–3 days', '4+': '4+ days' },
    priceLabels: {
      '<100': 'Under $100',
      '100-300': '$100–$300',
      '300+': '$300+',
    },
    activeFiltersLabel: 'Active filters',
    viewTour: 'View tour',
    perPerson: 'per person',
    styleLabels: {
      family: 'Family',
      couples: 'Couples',
      adventure: 'Adventure',
      luxury: 'Luxury',
      group: 'Group',
      private: 'Private',
    },
    themeLabels: {
      cruise: 'Cruise',
      trekking: 'Trekking',
      cultural: 'Cultural',
      culinary: 'Food & culinary',
      beach: 'Beach & islands',
      nature: 'Nature',
    },
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
  tourDetail: {
    breadcrumb: 'Tours',
    overview: 'Overview',
    highlights: 'Highlights',
    itinerary: 'Itinerary',
    dayLabel: (n: number) => `Day ${n}`,
    stepBack: 'Back',
    stepNext: 'Next',
    included: 'What’s included',
    notIncluded: 'Not included',
    gallery: 'Photos',
    enquireHeading: (tour: string) => `Enquire about ${tour}`,
    reviews: (n: number) => `${n} reviews`,
    mealsLabel: 'Meals',
    youMightLike: 'You might also like…',
    badges: {
      bestSeller: 'Best seller',
      sellingFast: 'Likely to sell out',
    },
    note: {
      heading: 'Good to know',
      body: 'Itineraries can flex to your pace, dates and interests — share your preferences in an enquiry and our trip designers will tailor the plan. Prices are per person and may vary by season, group size and hotel choice.',
    },
    // Overview spec block (icon-led rows)
    specs: {
      destination: 'Destination',
      duration: 'Duration',
      departure: 'Departures',
      travelStyle: 'Travel style',
      theme: 'Best for',
      accommodation: 'Accommodation',
    },
    durationValue: (n: number) => `${n} day${n > 1 ? 's' : ''}`,
    // Inclusions block (icon-led rows)
    inclusionLabels: {
      meals: 'Meals',
      transport: 'Transport',
      accommodation: 'Accommodation',
      activities: 'Included activities',
    },
    mealsSummary: (b: number, l: number, d: number) => `${b}B · ${l}L · ${d}D`,
    // "Value of the package" — themed value props in a tinted panel
    value: {
      heading: 'Value of the package',
      props: [
        {
          title: 'Gastronomic & cultural immersion',
          body: 'Street-food trails, hands-on cooking, and meals chosen for the place — not a buffet on repeat. You taste the region as locals do.',
        },
        {
          title: 'Landscapes & gentle adventure',
          body: 'Cruise emerald bays, cycle quiet countryside, and reach the views worth the early start — at a pace that still feels like a holiday.',
        },
        {
          title: 'Expert local guides',
          body: 'English-speaking guides who bring history and culture to life, adapt to your interests, and know the stops that aren’t on the map.',
        },
        {
          title: 'Safety & quality, quietly handled',
          body: 'Vetted vehicles, trusted hotels and 24/7 support — the logistics disappear so the trip doesn’t.',
        },
      ],
    },
    // Policies — grouped, collapsible
    policies: {
      heading: 'Policies',
      readMore: 'Read full policy',
      readLess: 'Show less',
      groups: [
        {
          title: 'Booking & payment',
          items: [
            'A confirmation receipt is emailed within 15 minutes of a successful booking.',
            'A 30% deposit of the total tour cost confirms the booking; the balance is due on the start day of the tour.',
            'The confirmation voucher is released by email within 48 hours of the deposit.',
          ],
        },
        {
          title: 'Cancellation',
          items: [
            '15+ days before travel: 50% of the deposit is charged as a cancellation fee.',
            '7–15 days before travel: 75% of the deposit is charged.',
            '0–7 days before travel: 100% of the deposit is charged.',
          ],
        },
        {
          title: 'Changes & refunds',
          items: [
            'Changes made 15+ days before the travel date carry no change fee — we resend the final itinerary.',
            'For changes inside 15 days, we’ll do our best to accommodate; any supplier fees incurred are passed on at cost.',
          ],
        },
      ],
    },
    // Traveller reviews (placeholder until wired to the Review model)
    reviewsSection: {
      heading: 'Traveller reviews',
      verified: 'Verified traveller',
      readMore: 'Read more',
      seeAll: (count: number): string => `See all ${count} reviews`,
      dialogTitle: 'Traveller review',
      listDialogTitle: 'All reviews',
      loadMore: 'Load more reviews',
      loading: 'Loading reviews…',
      loadError: 'Could not load more reviews — please try again.',
    },
    // "Why travel with us" trust grid
    trust: {
      heading: 'Why travel with us',
      items: [
        {
          title: '15 years of local expertise',
          body: 'A decade and a half crafting journeys across Vietnam — refined trip by trip.',
        },
        {
          title: 'Designed by locals',
          body: 'No middlemen and no off-the-shelf scripts — real itineraries from people who live here.',
        },
        {
          title: 'Loved by travellers',
          body: 'Thousands of guests, and the kind of reviews that turn first-timers into regulars.',
        },
        {
          title: '24/7 on-trip support',
          body: 'A real person before, during and after your trip — wherever the road takes you.',
        },
        {
          title: 'Fair, transparent pricing',
          body: 'Clear quotes, no surprise fees, and flexible options to suit your budget.',
        },
        {
          title: 'Flexible & tailored',
          body: 'Every itinerary flexes to your pace, dates, interests and group size.',
        },
      ],
    },
    // Tour FAQ
    faqSection: {
      heading: 'Frequently asked questions',
      items: [
        {
          q: 'What’s included in the tour price?',
          a: 'Entrance fees, meals as listed, accommodation on multi-day trips, private transfers and an English-speaking guide. The exact inclusions are listed above and in the itinerary we send.',
        },
        {
          q: 'Does the price include flights?',
          a: 'No — international and domestic flights are not included, but we’re happy to advise on the best connections for your itinerary.',
        },
        {
          q: 'Can I customise the itinerary?',
          a: 'Yes. Most journeys can be tailored to your pace, interests and group size — share your preferences in an enquiry and our trip designers will adapt the plan.',
        },
        {
          q: 'Are vegetarian or special diets catered for?',
          a: 'Absolutely. Let us know any dietary needs in your enquiry and we’ll arrange suitable meals throughout.',
        },
        {
          q: 'What is the cancellation and refund policy?',
          a: 'See the Policies section above for the full breakdown by timeframe. In short: the earlier you let us know, the less is charged.',
        },
        {
          q: 'Is airport pickup included?',
          a: 'Yes — private airport transfers are arranged around your flight times on multi-day tours.',
        },
      ],
    },
    booking: {
      heading: 'Book this tour',
      fromLabel: 'From',
      perPerson: 'per person',
      reviewsInline: (n: number) => `${n} reviews`,
      departures: 'Upcoming departures',
      seatsLeft: (n: number) => `${n} seats left`,
      requestCta: 'Request to book',
      enquireCta: 'Ask a question',
      deposit: (amount: string) => `Or deposit at least ${amount} to hold your dates`,
      trustLine: 'No payment now — we confirm availability and send a tailored quote.',
      twoWays: {
        scheduledTitle: 'Book a scheduled date',
        scheduledDesc: 'Join a set departure — book and pay instantly.',
        privateTitle: 'Travel on your own dates',
        privateDesc: 'Any date, private tour — we quote within 24h.',
        privateBadge: 'On request',
      },
      save: 'Save to wishlist',
      saved: 'Saved',
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
