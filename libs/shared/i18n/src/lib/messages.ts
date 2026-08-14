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
  // Copy THẬT cho login/register wire vào Better Auth (Task 3 auth-pages-api,
  // spec 2026-08-03) — khối RIÊNG với `auth` ở trên (đó là bản nháp form
  // static-first trước khi có API thật). `errors` khoá bằng `AuthErrorKey`
  // (@/lib/auth-errors) nên mọi key lỗi map ra đúng MỘT câu tiếng Anh ổn định.
  authForms: {
    login: {
      submitting: 'Signing in…',
    },
    register: {
      submitting: 'Creating your account…',
    },
    // Task 4 (auth-pages-api): forgot/reset password.
    forgotPassword: {
      submitting: 'Sending the link…',
    },
    resetPassword: {
      submitting: 'Saving your password…',
      // Panel khi thiếu/rỗng `?token=` — khuôn theo `unsubscribePage.invalidToken`.
      invalidToken: {
        heading: 'This link isn’t working',
        body: 'The reset link looks incomplete or has expired. Request a fresh one and we’ll get you back on board.',
        backLink: 'Request a new link',
      },
      toast: {
        title: 'Password updated',
        body: 'Log in with your new password to continue.',
      },
    },
    // Task 5 (auth-pages-api): verify-email OTP thật.
    verifyEmail: {
      submitting: 'Verifying…',
      toast: {
        title: 'Email verified',
        body: 'Welcome aboard — you’re all set to travel.',
      },
      // Panel khi thiếu `?email=` — khuôn theo `resetPassword.invalidToken`.
      noEmail: {
        heading: 'Missing your email',
        body: 'This link didn’t carry an email address. Head back to log in and we’ll send a fresh code.',
        backLink: 'Back to log in',
      },
    },
    errors: {
      invalidCredentials: 'Invalid email or password.',
      emailExists: 'An account with this email already exists.',
      tooManyRequests: 'Too many attempts. Please wait a minute.',
      invalidOtp: "That code didn't match. Try again.",
      invalidToken: 'This link has expired or was already used.',
      notAvailable: 'Google sign-in is not available yet.',
      generic: 'Something went wrong. Please try again.',
    },
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
      departureLabel: 'Departure',
      partyLabel: 'Travellers',
      adultsLine: (n: number) => `${n} adult${n > 1 ? 's' : ''}`,
      childrenLine: (n: number) => `${n} child${n > 1 ? 'ren' : ''}`,
      perAdult: 'per adult',
      perChild: 'per child',
      totalLabel: 'Estimated total',
      // Heading của card 2/3 trong `BookingForm` (vòng review 1, Finding 1) —
      // khác `steps.trip`/`steps.payment` ngay dưới đây: đó là nhãn của step
      // indicator, đây là heading THẬT của từng card.
      leadTravelerHeading: 'Lead traveler',
      paymentMethodHeading: 'Payment method',
      // Step indicator ở đầu trang (RSC, T3): bước 1 là form này, bước 2 là
      // trang thanh toán hosted của Stripe/PayPal — KHÔNG nằm trong app.
      steps: {
        trip: 'Trip details',
        payment: 'Payment',
      },
      paymentStepNote: 'Payment happens on the next screen, hosted by your provider.',
      // aria-label của `<ol>` step indicator ở đầu trang — TÁCH khỏi `title`
      // (dọn dẹp cuối, NHÓM 6c): trước đây mượn tạm `title` ("Complete your
      // booking"), sai ngữ nghĩa cho một danh sách bước.
      stepsAria: 'Booking steps',
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
      paymentDesc: 'Secure checkout — pick how you’d like to pay.',
      stripe: 'Card (Stripe)',
      stripeHint: 'Visa, Mastercard, Amex',
      paypal: 'PayPal',
      paypalHint: 'Pay with your PayPal balance or card',
      // Chạm trần vì hết ghế. KHÔNG lặp lại nhãn ghế của hàng đợt — nói vì sao
      // nút cộng dừng, và lối ra là đổi đợt chứ không phải bỏ bớt người.
      capBySeats:
        "That's every seat left on this departure — pick another date for a bigger party.",
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
        // Placeholder trên trigger DatePicker khi chưa chọn ngày nào.
        startDatePlaceholder: 'Pick a date',
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
      /** Hero chuẩn site cho trang voucher (góp ý user 12/08 — navbar về
       *  đồng bộ, hết kiểu hero-less riêng). */
      heroBreadcrumb: 'Voucher',
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
      // Fact mới cho lưới IATA-style (redesign vé) — trước đây provider chỉ
      // hiện ở trang chi tiết booking, giờ thêm ở vé để đủ 4 fact: Tour ·
      // Guests · Total paid · Payment.
      paymentLabel: 'Payment',
      // Nhãn TRÊN khoảnh khắc primary kiểu boarding-pass ("24 AUG → 26 AUG").
      // Một nhãn dùng chung cho cả tour một-ngày lẫn nhiều-ngày.
      dateLabel: 'Tour date',
      // Dòng mô tả ngắn trong cuống vé, cạnh tên khách — "2 guests".
      guestsCount: (n: number) => `${n} guest${n > 1 ? 's' : ''}`,
      contactLabel: 'Contact',
      viewTours: 'Browse more tours',
      notFound: 'We couldn’t find that booking.',
      viewBooking: 'View booking',
      // Mood thứ ba: khách quay về từ cổng nhưng booking đã ở một kết cục khác
      // (hết hạn giữa chừng, đã huỷ, đã hoàn tiền). KHÔNG tự làm mới — không có
      // gì để đợi; câu chữ vì thế không hứa hẹn gì, chỉ chỉ đường.
      settledTitle: 'This booking is already settled',
      settledBody: 'There’s nothing left to pay here. Open the booking to see where it stands.',
      // Nút chép mã (CopyCodeButton) — nhãn đổi trong 2 giây sau khi bấm.
      copyCode: 'Copy code',
      copied: 'Copied',
      // Dòng nhỏ dưới mã trong cuống vé (`CheckoutShell`) — khác `nextVoucher`
      // (câu đầy đủ trong list "What happens next"): đây là chú thích NGẮN,
      // ngay cạnh chính mã đó, không cần lặp lại "your booking code is…".
      stubShowCode: 'Show this code at the meeting point.',
      // Section "What happens next" — chỉ hiện ở mood confirmed.
      nextHeading: 'What happens next',
      nextEmail: 'A confirmation email is on its way to your inbox.',
      nextVoucher: 'Your booking code is your voucher — show it at the meeting point.',
      nextManage: 'View or cancel this trip anytime in Trips.',
      // Nhãn lặp lại HAI lần trên vé (`CheckoutShell`): dải header ngang +
      // cuống vé xoay dọc (`writing-mode: vertical-rl`) — cùng một chữ, hai tư
      // thế, đúng kiểu ấn phẩm vé thật lặp thông tin ở cuống.
      voucherLabel: 'Tour Voucher',
      // Dòng 9px sát mép dưới thân vé — bản dịch trung thực của thứ một tấm vé
      // giấy thật luôn in: không hứa hẹn gì thêm ngoài chính sách đã có.
      finePrint:
        'Present this voucher at the meeting point · Non-transferable · Cancellation policy applies',
    },
    // /checkout/cancel.
    cancel: {
      title: 'Payment cancelled',
      manage: 'Pay now or manage booking',
      retry: 'Try again',
      backToTours: 'Browse tours',
      // Một câu, KHÔNG đếm ngược — thiết kế đã chốt không có đồng hồ chạy lùi ở
      // bất kỳ màn nào của luồng này. Nói "khoảng" vì con số làm tròn xuống.
      expiresIn: (minutes: number) =>
        `This booking is released in about ${minutes} minute${minutes === 1 ? '' : 's'} if it stays unpaid.`,
      // Câu trấn an trung thực thay cho `body` ở màn cancel: không hứa giữ
      // ghế (invariant #1 — PENDING không giữ seat), chỉ nói đúng sự thật là
      // session Stripe hết hạn sau ~1 giờ. KHÔNG đồng hồ đếm ngược.
      //
      // Fix cuối (final review, NHÓM 3): bản cũ nói "Your reservation is
      // held" — NGỤ Ý giữ chỗ, vi phạm thẳng invariant #1 ngay trong câu nói
      // ra để trấn an nó. Đổi hướng: nói booking CÒN MỞ (đúng sự thật — khách
      // trả tiếp được), không nói gì về "held"/"reservation".
      heldNote:
        'No charge was made. Your booking is still open — you can finish payment from Trips within the hour.',
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
      // BẮT BUỘC, không phải optional (user chốt 08/08). Contract khai
      // `reason: z.string().min(1).max(1000)` và lý do này đi thẳng vào hàng
      // đợi admin duyệt hoàn tiền — một đơn không lý do thì người duyệt không
      // có gì để quyết. Nhãn cũ ghi "(optional)" là nói sai với hợp đồng thật.
      reasonLabel: 'Why are you cancelling?',
      reasonPlaceholder: 'A sentence is enough — it goes straight to our team.',
      /** Trần 1000 là `max` của contract. Bộ đếm ở mockup booking-flow ghi 500
       *  — đó là trần `decisionNote` của ADMIN, nhầm bề mặt. */
      reasonCounter: (n: number) => `${n} / 1000`,
      reasonRequired: 'Please tell us why — our team needs it to process a refund.',
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
  // Card tóm tắt đơn ở cột phải trang /tours/[slug]/book (checkout hướng B —
  // Task 2 cụm redesign checkout/account). Đặt cạnh `booking` cho dễ tìm.
  checkoutSummary: {
    heading: 'Order summary',
    // Đợt review cuối (Critical + §2.2): "Free cancellation" NGỤ Ý hoàn 100%
    // vô điều kiện — sai với chính sách thật (`legal/cancellation.ts`: 30+
    // ngày mới hoàn đủ, có xét duyệt tay). Chip trung tính, KHÔNG hứa số.
    flexibleCancellation: 'Flexible cancellation',
    instantConfirmation: 'Instant confirmation',
    adultsLine: (n: number) => `${n} adult${n > 1 ? 's' : ''}`,
    childrenLine: (n: number) => `${n} child${n > 1 ? 'ren' : ''}`,
    totalLabel: 'Total',
    taxesNote: 'Includes all taxes and fees.',
    trustRow: 'Stripe & PayPal · SSL encrypted · 24/7 support',
    // Chưa chọn đợt khởi hành — breakdown hiện câu này thay vì các dòng số tiền.
    pickDeparture: 'Select a departure to see your total',
    // Dòng trấn an TRUNG THỰC ngay dưới CTA, tính từ mốc thật của
    // `legal/cancellation.ts` (30 ngày → hoàn đủ · 15 ngày → hoàn 50%).
    // "cancellation policy" LUÔN là link `/cancellation-policy` — lắp trong
    // component, không bịa số/chữ hứa hơn chính sách thật.
    cancellationAssurance: {
      policyLinkLabel: 'cancellation policy',
      full: (date: string) => `Full refund available until ${date} — see our`,
      partial: (date: string) => `50% refund available until ${date} — see our`,
      closeWindow: 'This departure is close — review our',
      closeWindowSuffix: 'before booking.',
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
      /**
       * Một dòng gợi ý dưới tên mỗi vùng trong dropdown. Ba chuỗi này TỪNG là một
       * `Record` gõ trực tiếp trong `destinations-menu.tsx` — chuỗi user-facing
       * inline, vi phạm luật 7; chuyển về đây khi menu rút còn 4 mục (30/07).
       *
       * CỐ TÌNH không phải danh sách địa danh như Nexora (`'Hạ Long, Sa Pa, Ninh
       * Bình'`): thêm hoặc bớt một địa điểm là chữ đó sai mà không ai biết. Ba câu
       * dưới đây mô tả CẢNH của vùng nên chúng không phụ thuộc số địa điểm.
       *
       * Ngắn hơn `regionPage.regions[key].tagline` một bậc: tagline là phụ đề hero
       * cả câu, còn đây là một dòng trong menu hẹp.
       */
      regionHints: {
        north: 'Misty terraces & limestone bays',
        central: 'Imperial cities & lantern towns',
        south: 'River markets & island dusk',
      },
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
    // Số địa danh truyền động từ data thật (từng ghi cứng "nine places" —
    // sai từ khi catalogue lên 19; cùng lớp bug "68+" của Home). Bản meta
    // dưới cố ý KHÔNG đếm số: metadata là hằng module-level, không có data.
    heroSubtitle: (places: number) =>
      `Three regions, ${places} places. Start where the journey makes sense for you.`,
    heroSubtitleMeta: 'Three regions. Start where the journey makes sense for you.',
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
     * Lightbox của khu ảnh vùng. Khối RIÊNG, không dùng lại
     * `tourDetail.gallery`: `Lightbox` nhận copy qua prop chính là để hai trang
     * nói bằng chữ của mình. Ở đây ô ảnh CÓ nhãn cảnh (`galleryTiles`) nên nút mở
     * gọi tên cảnh; trang tour thì `alt` có thể null nên nút mở chỉ nói vị trí
     * ("Open photo 3 of 6"). Gộp hai khối lại là buộc một trong hai phải nói sai.
     */
    galleryLightbox: {
      dialogTitle: 'Region photo',
      counter: (current: number, total: number) => `${current} / ${total}`,
      close: 'Close',
      previous: 'Previous photo',
      next: 'Next photo',
      /** Nhãn nút mở: ô ảnh là nút, cần tên khả truy cập nói rõ nó làm gì. */
      open: (label: string) => `View photo: ${label}`,
    },
    /** Nhãn cho hàng số liệu trong hero. GIÁ TRỊ dẫn xuất ở tầng trang. */
    statLabels: {
      from: 'From',
      longest: 'Longest trip',
      hardest: 'Hardest grade',
      styles: 'Trip styles',
    },
    seasonsEyebrow: 'Seasons',
    seasonsHeading: (region: string) => `When to visit ${region}`,
    /** Nhãn của các khoảng tháng đẹp. Dải 12 ô đã BỎ (Task 5k) — nó là một đồ thị
        thu nhỏ, cùng họ lỗi với khu phổ user vừa bác. Nay tháng đẹp nói bằng CHỮ,
        nên nhãn này đứng trên hai chip khoảng tháng thay vì trên một chú giải. */
    seasonsBestLabel: 'Best months',
    /** Câu dẫn của khu mùa. `months` là các khoảng đã nối sẵn ("Mar–May and
        Sep–Nov") — nối ở tầng component vì đó là format DỮ LIỆU (`Intl`), không
        phải copy. Câu bảo người đọc LÀM GÌ, không chỉ nêu một sự thật. */
    seasonsWindow: (months: string) => `Plan for ${months} if you can choose your dates.`,
    /** Khu bốn chuyến một ngày — CHỈ miền Trung dựng. */
    dayTrips: {
      eyebrow: 'Out and back',
      heading: (n: number) => `${n} of these trips fit in a single day`,
      subtitle:
        'The centre is compact enough to see properly without packing a bag — leave after breakfast, back before dark.',
      /**
       * Nhãn hành động cuối thẻ. Thêm 30/07: user xem khu này và nói *"ban đầu mình
       * không rõ là gì, click vào hoá ra nó đang hiển thị tour"* — thẻ chỉ có một
       * mũi tên trơ nên không nói được nó dẫn đi đâu. Một nhãn CHỮ nói thẳng.
       */
      viewTrip: 'View trip',
    },
    /** "Bạn có mấy ngày?" — CHỈ miền Bắc. Ba lối vào theo thời lượng; đây là bản
        THAY THẾ cho khu biểu đồ bị bác, nói cùng sự thật (Bắc là vùng duy nhất
        trải 1–8 ngày) bằng ngôn ngữ khách: "bạn có mấy ngày?" */
    days: {
      eyebrow: 'How long have you got',
      heading: 'A morning, a weekend, or a week on the trail',
      subtitle:
        'The north is the only region that stretches the whole way — start with what your calendar allows.',
      brackets: {
        short: { title: 'One day', body: 'Out after breakfast, back before dark.' },
        weekend: { title: 'A weekend', body: 'One night out — a bay, a valley, or a homestay.' },
        long: {
          title: 'A week on the trail',
          body: 'The long way round, over the passes and back.',
        },
      },
      /** Nhãn số chuyến trong mỗi nhóm. */
      tripCount: (n: number) => `${n} ${n === 1 ? 'trip' : 'trips'}`,
    },
    /** "Khách nói gì" — CHỈ miền Nam. Review THẬT lọc theo vùng. */
    reviews: {
      eyebrow: 'From people who went',
      heading: (region: string) => `What travellers say about ${region}`,
      subtitle: 'Unedited, from the trips below.',
      /** Dòng ghi công: review này thuộc tour nào. */
      onTrip: (tour: string) => `on ${tour}`,
    },
    regions: {
      north: {
        tagline: 'From Sa Pa to Hạ Long Bay — culture and natural wonders in the misty north.',
        intro:
          'Awe-inspiring landscapes of limestone bays and terraced highlands, diverse hill-tribe cultures, and the high passes of the far north — this is Northern Vietnam at its most dramatic.',
        // Nexora: "ride the legendary Hà Giang Loop" → thay bằng Ô Quy Hồ, đèo có
        // thật trong itinerary ngày 3 của `northern-highlands-loop`.
        intro2:
          'Cruise the emerald karsts of Hạ Long, trek between Hmong and Dao villages around Sa Pa, and ride the switchbacks over Ô Quy Hồ. Browse our trips below.',
        /** Nhãn ô gallery — 6 ô cho biến thể `peaks`. Mỗi nhãn neo vào một chi tiết CÓ
           THẬT: địa điểm của vùng, highlight, hoặc chặng trong itinerary
           `northern-highlands-loop` (Mường Hoa · Ô Quy Hồ · Bắc Hà). */
        galleryTiles: [
          'Limestone islands in Hạ Long Bay',
          'Rice terraces above the Mường Hoa valley',
          'Flooded caves below the karst at Ninh Bình',
          'The road over Ô Quy Hồ',
          'Sunday morning at the Bắc Hà market',
          'A junk at anchor for the night',
        ],
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
        /** Mùa đẹp nhất — mảng SỐ THÁNG (1–12), không phải chuỗi 'Mar–May'.
            `region-seasons.tsx` GOM mảng này thành các khoảng liền nhau rồi in ra
            'Mar–May' / 'Sep–Nov'; lưu sẵn chuỗi thì component phải parse copy, và
            copy sửa một chữ là khu vỡ âm thầm. Bắc có HAI khoảng rời nhau — thứ
            hai vùng kia không có, nên khu này là khu riêng của Bắc. */
        season: {
          months: [3, 4, 5, 9, 10, 11],
          note: 'Cool, dry and clear — ideal for Hạ Long and the mountains. Winters turn chilly up high; summers bring rain.',
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
        /** Nhãn ô gallery — 6 ô cho biến thể `lanterns`. Nguồn: timeline di sản, highlight,
           và itinerary `central-heritage-week` (Hải Vân · Mỹ Sơn). */
        galleryTiles: [
          'The citadel walls at Huế',
          'Royal tombs along the Perfume river',
          'Lanterns on the Hội An riverfront',
          'The coast road over the Hải Vân pass',
          'Chăm brick towers at Mỹ Sơn',
          'The Golden Bridge above Bà Nà',
        ],
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
        /** Xem ghi chú ở `north.season`. Miền Trung KHÔNG render khu mùa (khu mùa
            là khu riêng của Bắc) — giữ để ba vùng cùng một hình dạng dữ liệu, và
            vì đây là nội dung đã có sẵn từ khối `bestTime` cũ. */
        season: {
          months: [2, 3, 4, 5, 6, 7, 8],
          note: 'Warm and dry along the coast and old towns. Avoid Oct–Dec, the wettest and most storm-prone months.',
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
        /** Nhãn ô gallery — 3 ô cho biến thể `panorama`, lấy từ mô tả ba địa điểm và
           highlight của vùng. */
        galleryTiles: [
          'A floating market at first light near Cần Thơ',
          'Street food after dark in Sài Gòn',
          'Clear reefs off Phú Quốc',
        ],
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
        /** Xem ghi chú ở `north.season`. Mùa VẮT QUA NĂM (12 → 4): mảng liệt kê
            từng tháng chứ không phải cặp đầu–cuối. Phép gom khoảng ở
            `region-seasons.tsx` phải nối 12 với 1 để ra 'Dec–Apr' thay vì hai
            khoảng rời — có test canh, dù miền Nam không render khu mùa. */
        season: {
          months: [12, 1, 2, 3, 4],
          note: 'The dry season for the Mekong and the islands. May–Nov is wetter but stays warm with short showers.',
        },
      },
    },
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
        { label: 'Phone', value: '+84 24 3826 0126' },
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
    // Khối `contact` (heading/breadcrumb/subtitle/intro/inquiry/info/faq/
    // ctaBand) hiện KHÔNG có consumer nào trong apps/web — site-footer.tsx
    // không import `messages`, và contact/page.tsx tự hardcode `metadata`
    // riêng (grep xác nhận 0 hit). Giữ lại là nợ đã ghi nhận
    // (docs/CHANGELOG.md entry 06/08, mục "Nợ mở"), chờ dọn ở nhánh riêng.
    info: [
      {
        title: 'Office hours',
        lines: ['Monday – Friday', '8:00 am – 6:00 pm (GMT+7)'],
      },
      { title: 'Offices', lines: ['Hà Nội · Hồ Chí Minh City'] },
      { title: 'Call us', lines: ['+84 24 3826 0126'] },
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
    /** Nhãn nút tim. Một nhãn DUY NHẤT cho cả hai trạng thái — trạng thái bật/tắt
        đi qua `aria-pressed`, trình đọc màn hình đọc sẵn. Đổi nhãn qua lại khiến
        người dùng tưởng đó là hai nút khác nhau. */
    wishlistLabel: (title: string) => `Save ${title} to your wishlist`,
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

    // ── Tabs ──
    /** Nhãn của dải card dữ kiện ở tab Overview. Giá trị lấy thẳng từ dữ liệu
        tour nên ở đây CHỈ có nhãn, không có câu mô tả nào. */
    facts: {
      duration: 'Duration',
      nights: (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`,
      groupSize: 'Group size',
      /** Sức chứa: wireframe ghi "Max 10 riders" (tour xe máy) — ở đây là
          "guests" vì chuỗi này chạy cho MỌI tour, kể cả tour đi bộ và du thuyền. */
      groupSizeValue: (n: number) => `Max ${n} guests`,
      difficulty: 'Difficulty',
      goodFor: 'Good for',
      /** Hai link nhỏ ở chân card, mỗi cái nhảy sang một tab có câu trả lời đầy
          đủ. Chỉ gắn cho card CÓ chỗ để tới — hai card còn lại không có. */
      seeItinerary: 'See the itinerary',
      howDemanding: 'How demanding is it?',
    },
    tabs: {
      overview: 'Overview',
      itinerary: 'Itinerary',
      departures: 'Departures',
      reviews: 'Reviews',
      goodToKnow: 'Good to know',
    },

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
      /** HAI khoá còn lại của khối này sau đợt trùng tu 13/08 — phần còn lại
          (heading/recentLabel/summary/seeAll/dialogTitle/emptyTitle…) xoá cùng
          `tour-reviews.tsx`; tab Reviews và modal dùng `reviewsTab` + `dialogs`.
          Hai khoá này ở lại vì `destinations/region-reviews.tsx` mượn CHUNG
          chúng (`messages.tourDetail.reviews`) — đổi tên khối là gãy trang vùng. */
      /** Nhãn gộp cho cụm năm sao: trình đọc màn hình nghe "4 out of 5 stars"
          thay vì năm icon vô nghĩa. */
      ratingLabel: (rating: number) => `${rating} out of 5 stars`,
      /** Tác giả đã xoá tài khoản — `PublicReviewSchema.authorName` là null và
          schema ghi rõ FE render đúng chuỗi này. Review vẫn ở lại vì nó là đánh
          giá thật; chỉ danh tính biến mất. */
      deletedAuthor: 'Deleted account',
    },

    // ── Reviews tab ──
    reviewsTab: {
      /** KHÔNG có chữ "verified" ở đây, và KHÔNG có huy hiệu "Verified rider"
          trên từng review — dù bản wireframe có. `PublicReviewSchema` không phơi
          `source`, và `listByTour` trả CẢ review `CURATED` (không gắn booking:
          xem `fixtures/catalog/reviews.ts`). Gắn nhãn "verified" lên chúng là
          khẳng định một điều dữ liệu công khai không xác nhận được. */
      basedOn: (n: number) => `Based on ${n} ${n === 1 ? 'review' : 'reviews'}`,
      showAll: 'Show all reviews',
      onlyFinished: 'Only travellers who finished this trip can leave a review.',
      ordering: 'Newest first · reviews from deleted accounts appear last.',
      deletedAccount: 'Deleted account',
      /** Chưa ai đánh giá: KHÔNG vẽ biểu đồ năm cột 0% — nó đọc ra như "ai cũng
          chấm thấp" chứ không phải "chưa có dữ liệu". */
      emptyTitle: 'No reviews yet',
      emptyBody: 'This trip is new. Be the first to ride it and tell us how it went.',
    },

    // ── Gallery ảnh ──
    gallery: {
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
      /** Còn ĐÚNG hai khoá sau đợt trùng tu 13/08: trang tour hết `<section>`
          có tiêu đề, năm cụm nội dung nay là năm tab (nhãn ở `tabs`). Sáu khoá
          cũ (`why`/`goodFor`/`itinerary`/`included`/`reviews`/`goodToKnow`) xoá
          cùng các component render chúng. `departures` vẫn sống vì dải khởi
          hành dưới hero và trang `/book` còn dùng làm nhãn + nguồn hash. */
      departures: 'All departures',
      related: 'You might also like',
    },

    // ── Media panel ──
    mediaPanel: {
      photoCount: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
      morePhotos: (n: number) => `+${n}`,
      /** Tên khả truy cập của ô ảnh CHÍNH (541px). Cố tình KHÔNG dùng chữ
          "photo": ô này đứng cạnh 7 nút "Open photo N of M" của dải thumb, và
          `tour-media-panel.spec.tsx` đếm đúng 7 nút khớp /photo/i — trộn thêm
          một nhãn "photo" thứ 8 sẽ làm phép đếm đó sai mà không nói lên gì. */
      openGallery: 'Open gallery',
      /** Chữ D hoa — bám đúng bản wireframe đã duyệt ("Select Departure"). */
      selectDeparture: 'Select Departure',
      allDates: (n: number) => `All ${n} dates`,
      seatsLeft: (n: number) => `${n} seat${n === 1 ? '' : 's'} left`,
      reserve: (n: number) => `Reserve — ${n} seat${n === 1 ? '' : 's'} left`,
      wishlist: 'Wishlist',
      /** Badge giảm giá cạnh giá: wireframe ghi "11% OFF", KHÔNG phải "−11%".
          Con số do `discountPercent()` tính thật (làm tròn XUỐNG — không bao giờ
          nói quá mức giảm). */
      percentOff: (n: number) => `${n}% OFF`,
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
    },

    // ── Departures tab ──
    departuresTab: {
      nextDeparture: 'Next departure',
      datesOpen: 'Dates open',
      priceRange: 'Price range',
      seatsLeftTotal: 'Seats left',
      availabilityByMonth: 'Availability by month',
      /** Thay cho câu chú thích cũ ("Each block is one departure — filled means
          seats left…"). Bản duyệt vẽ mỗi đợt thành một khối ngang; nhóm người
          dùng thử KHÔNG đọc ra khối đó là gì, và việc phải có một dòng chú
          thích mới hiểu chính là bằng chứng hình vẽ hỏng. Bảng thay nó không
          cần chú thích — nó chỉ cần nói bấm vào đâu. */
      openMonthHint: 'Open a month to pick a date.',
      seeAllDates: 'See all dates',
      lowSeason: 'low season',
      peak: 'peak',
      /** Dòng phụ dưới mỗi ô thống kê. "N of M" lấy M từ `maxGroupSize` —
          `TourDepartureSchema` chỉ có `seatsLeft`, không có sức chứa riêng. */
      nextDepartureSub: (left: number, capacity: number) =>
        `${left} of ${capacity} ${capacity === 1 ? 'seat' : 'seats'} left`,
      datesOpenValue: (open: number, total: number) => `${open} / ${total}`,
      datesOpenSub: (months: number) => `across ${months} ${months === 1 ? 'month' : 'months'}`,
      priceRangeSub: 'per person, by season',
      seatsLeftSub: 'across every open date',
      monthDepartures: (n: number) => `${n} ${n === 1 ? 'departure' : 'departures'}`,
      monthSeatsLeft: (n: number) => `${n} ${n === 1 ? 'seat' : 'seats'} left`,

      // ── Bảng tháng ──
      /** Tiêu đề cột. Cột đầu (mũi xổ) và cột cuối (nút Select) không có nhãn:
          biểu tượng tự nói, và nhãn ở đó chỉ làm hàng tiêu đề nặng thêm. */
      colMonthDate: 'Month / date',
      colSeats: 'Seats',
      colStatus: 'Status',
      colPrice: 'Price',
      /** Dòng phụ của hàng tháng: "12 departures · 1–29 Oct". Dải ngày do
          `monthDateSpan` dựng — nó là số liệu O(1), không dài ra theo số đợt. */
      monthMeta: (departures: string, span: string) => `${departures} · ${span}`,
      /** Ghế cấp tháng: sức chứa = số đợt × `maxGroupSize`, vì
          `TourDepartureSchema` không có cột sức chứa riêng. */
      monthSeatsOf: (left: number, capacity: number) => `${left} of ${capacity} seats left`,
      /** Mở/đóng một tháng — nhãn cho trình đọc màn hình, nút chỉ có mũi tên. */
      toggleMonth: (month: string) => `Show departures in ${month}`,

      // ── Huy hiệu ──
      /** Bốn nhãn ghế trên hàng đợt, suy từ `seatsLeft` qua `departureStatus`
          + `maxGroupSize`. Contract KHÔNG có `departure.status`. */
      statusOpen: 'Open',
      statusFilling: 'Filling up',
      statusAlmostFull: 'Almost full',
      statusSoldOut: 'Sold out',
      /** Huy hiệu cấp tháng — chỉ hiện khi CÓ chuyện đáng nói (xem
          `monthNotice`). Tháng nào cũng có huy hiệu thì huy hiệu không nói gì. */
      noticeSomeSoldOut: (n: number) => `${n} sold out`,

      // ── Hàng đợt ──
      /** Thời lượng lặp lại ở mỗi hàng vì hàng đợt phải đọc độc lập được —
          khách cuộn tới giữa bảng không nhớ tour dài mấy ngày. */
      departureMeta: (days: number) => {
        const nights = days - 1;
        return nights > 0
          ? `${days} days, ${nights} ${nights === 1 ? 'night' : 'nights'}`
          : `${days} ${days === 1 ? 'day' : 'days'}`;
      },
      seatsOfCapacity: (left: number, capacity: number) => `${left} of ${capacity} seats left`,
      noSeatsLeft: 'No seats left',
      /** Chỉ hiện khi `compareAtPrice` khác null — đây là chỗ DUY NHẤT trên
          trang nói được "rẻ hơn thường lệ" ở mức từng ngày. */
      save: (amount: string) => `Save ${amount}`,
      select: 'Select',
      selected: 'Selected',
      /** Phần dư sau `DEPARTURE_ROWS_PER_MONTH` dòng nhường cho modal. */
      seeAllMonthDates: (n: number, month: string) => `See all ${n} ${month} dates`,

      // ── Ba thẻ chính sách cuối tab (bản duyệt có, bản ship 13/08 bỏ sót) ──
      /** Nhãn thẻ nói VAI TRÒ ở khoảnh khắc đặt chỗ, không lặp lại tên nhóm
          policy — ba thẻ này là cùng dữ liệu với tab Good to know, đóng khung
          lại cho lúc khách đang chọn ngày. */
      cardSecuring: 'Securing a seat',
      cardChanging: 'Changing your mind',
      cardGroup: 'Travelling as a group',
      /** Nhãn nổi bật của thẻ huỷ khi tour CÓ `freeCancellationDays`. Tour tính
          cửa sổ bằng giờ để null → rơi về `policy.title` như hai thẻ kia. */
      freeUntil: (days: number) => `Free until ${days} ${days === 1 ? 'day' : 'days'} out`,
      groupCap: (max: number) => `Up to ${max} ${max === 1 ? 'guest' : 'guests'}`,
      readFullPolicy: 'Read the full policy',
      /** Tour chưa mở đợt nào: nói thẳng và mở một lối đi tiếp, không để tab
          trống trơn. Khác câu ở `booking.box.noDepartures` vì chỗ này không
          đứng cạnh form hỏi nào. */
      empty: 'No upcoming departures for this trip yet.',
      emptyBody: 'Ask us about private dates — this loop runs on request as well.',
    },

    booking: {
      /** `Reserve` điều hướng thật tới `/tours/[slug]/book` (trang đã sống —
          nợ static-first thời trang book chưa tồn tại đã trả, xem BookingRail). */
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
      stopsSummary: (day: number, stops: number, from: string, to: string) =>
        `Day ${day} · ${stops} stop${stops === 1 ? '' : 's'} · ${from}–${to}`,
      today: 'Today',
      done: 'Done',
      /** Dòng meta dưới điểm hẹn: ngày khởi hành + độ dài chuyến, rồi một mệnh
          đề trạng thái. Wireframe có thêm "night-bus transfer from Hà Nội on
          request" — đó là copy RIÊNG của tour Hà Giang, contract không có
          trường nào chứa nó nên không dựng. */
      meta: (departing: string, days: number, nights: number) =>
        `Departing ${departing} · ${days} ${days === 1 ? 'day' : 'days'}, ${nights} ${nights === 1 ? 'night' : 'nights'}`,
      metaLive: 'trip in progress',
      metaEnded: 'this departure has finished',
      included: "What's included",
      excluded: 'Not included',
    },

    // ── Good to know: FAQ + policy theo nhóm ──
    goodToKnow: {
      faqHeading: 'Questions travellers ask',
      /** PolicyKind enum → nhãn nhóm, dùng làm eyebrow của thẻ policy ở tab
          Good to know và tab Departures. */
      policyKinds: {
        CANCELLATION: 'Cancellation',
        BOOKING: 'Booking & payment',
        GENERAL: 'General',
      },
    },

    // ── Dialogs (modals) ──
    dialogs: {
      allDatesTitle: 'Choose a departure',
      /** Dòng phụ dưới tiêu đề modal "All dates" — nói lại danh tính tour và ba
          con số cố định của nó, để khách không phải nhớ mình đang ở tour nào. */
      allDatesSubtitle: (tourTitle: string, days: number, maxGroupSize: number) => {
        // "N nights" chỉ ghép khi tour dài hơn một ngày — tour trong ngày mà ghi
        // "1 day · 0 nights" là nói một thứ vô nghĩa. Wireframe dùng chữ "riders"
        // (tour xe máy); ở đây là "guests" vì chuỗi này chạy cho MỌI tour.
        const nights = days - 1;
        const length =
          nights > 0
            ? `${days} days · ${nights} ${nights === 1 ? 'night' : 'nights'}`
            : `${days} ${days === 1 ? 'day' : 'days'}`;
        return `${tourTitle} · ${length} · max ${maxGroupSize} guests`;
      },
      onlyOpen: 'Only show dates with seats left',
      /** Một hàng đợt: khoảng ngày · ghế còn / sức chứa · thời lượng. */
      dateRange: (start: string, end: string) => `${start} → ${end}`,
      seatsOf: (left: number, capacity: number) => `${left} of ${capacity} seats left`,
      rowMeta: (seats: string, days: number) => `${seats} · ${days} ${days === 1 ? 'day' : 'days'}`,
      soldOut: 'Sold out',
      /** Chân modal nhắc lại đợt đang chọn — nó nằm xa dải ô ngày phía trên. */
      currentPick: 'Selected',
      close: 'Close',
      select: 'Select',
      selected: 'Selected',
      noMatch: 'No departures match this filter.',
      allReviewsTitle: 'Reviews',
      sortBy: 'Sort reviews by',
      sortNewest: 'Newest first',
      sortOldest: 'Oldest first',
      sortHighest: 'Highest rated',
      sortLowest: 'Lowest rated',
      /** Tên NHÓM năm nút sao cho trình đọc màn hình. Khác `anyRating` — cái đó
          là TRẠNG THÁI đang hiện bên cạnh, không phải tên của cụm điều khiển. */
      filterByRating: 'Filter reviews by rating',
      anyRating: 'Any rating',
      starsOnly: (n: number) => `${n} star${n === 1 ? '' : 's'} only`,
      withPhotos: 'With photos',
      showingRange: (a: number, b: number, total: number) => `Showing ${a}–${b} of ${total}`,
      /** Khi có bộ lọc: nói rõ tổng là tổng ĐÃ LỌC, không phải tổng review của
          tour — hai con số khác nhau và người đọc phải biết mình đang xem cái nào. */
      showingMatching: (a: number, b: number, total: number) =>
        `Showing ${a}–${b} of ${total} matching`,
      noReviewsMatch: 'No reviews match these filters.',
      reviewsSubtitle: (tourTitle: string, average: string, count: number) =>
        `${tourTitle} · ${average} out of 5 · ${count} ${count === 1 ? 'review' : 'reviews'}`,
      loadingReviews: 'Loading reviews…',
      prevPage: 'Previous',
      nextPage: 'Next',
      pageOf: (page: number, totalPages: number) => `${page} / ${totalPages}`,
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
    // Đường lùi khi DTO thiếu dữ liệu (Task 5 — lib/api/posts.ts toJournalPost):
    // author.name null → fallbackAuthor; không có tag nào → fallbackCategory.
    // User-facing nên khai ở đây (luật 7), không hardcode trong lib.
    fallbackAuthor: 'Tourism guides',
    fallbackCategory: 'Journal',
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
    phone: '+84 24 3826 0126',
    rights: 'All rights reserved.',
  },
  wishlist: {
    saved: 'Saved to wishlist.',
    removed: 'Removed from wishlist.',
    error: 'Something went wrong — please try again.',
  },
  // "Rate this trip" review-creation form on a PAID booking's detail page.
  reviews: {
    /** Khối upload ảnh chuyến đi (mảnh 1 cụm review-ảnh 12/08 — UI theo mẫu
     *  user chọn, static-first: upload thật nối ở mảnh backend). */
    photos: {
      hint: (max: number, size: string) =>
        `Add up to ${max} photos from your trip (JPEG, PNG, up to ${size} each). Drag to reorder.`,
      counter: (n: number, max: number) => `${n}/${max} added`,
      dropTitle: 'Choose a file or drag & drop here.',
      dropHint: (size: string) => `JPEG, PNG, up to ${size}.`,
      browse: 'Browse files',
      uploading: (pct: number) => `Uploading… ${pct}%`,
      removePhoto: 'Remove photo',
      reorderHandle: 'Drag to reorder',
      errorsTitle: 'Photo upload error(s)',
      errNotImage: 'File must be an image.',
      errTooLarge: (size: string) => `File size must be less than ${size}.`,
      errTooMany: (max: number) => `Maximum ${max} photos allowed.`,
      /** Lỗi upload thật (Task 9, ADR-0021) — sign/POST Cloudinary thất bại. */
      errUpload: 'Upload failed. Please try again.',
    },
    heading: 'Rate this trip',
    ratingLabel: 'Your rating',
    ratingValueLabel: (n: number) => `${n} star${n > 1 ? 's' : ''}`,
    titleLabel: 'Title (optional)',
    titlePlaceholder: 'Sum up your trip in a few words',
    bodyLabel: 'Your review',
    bodyPlaceholder: 'Tell other travellers about your experience…',
    /** Ràng buộc contract: body 10–2000 ký tự. Nói rõ con số thay vì "quá ngắn". */
    bodyTooShort: (n: number) => `Please write at least ${n} characters.`,
    /** Bộ đếm ký tự góc phải textarea (góp ý user 12/08 — phơi trần 2000
     *  của contract ra cho khách thấy thay vì chặn ngầm). */
    bodyCounter: (n: number, max: number) => `${n}/${max}`,
    ratingRequired: 'Pick a rating from 1 to 5 stars.',
    submit: 'Submit review',
    submitting: 'Submitting…',
    successTitle: 'Thanks for your review',
    successBody: 'Your review is awaiting moderation — thank you for sharing your trip.',
    tooEarlyTitle: 'Review this trip when you’re back',
    tooEarlyBody: 'You’ll be able to rate this trip once it has finished.',
    alreadyReviewedTitle: 'You’ve already reviewed this trip',
    alreadyReviewedBody: 'Thanks again for sharing your experience with other travellers.',
    // Friendly EN for each `POST /reviews` error code (+ generic fallback).
    errors: {
      USER_NOT_SYNCED: 'We couldn’t verify your account. Sign out and back in, then try again.',
      REVIEW_NOT_ELIGIBLE: 'This booking isn’t eligible for a review yet.',
      BOOKING_FORBIDDEN: 'This booking doesn’t belong to your account.',
      BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
      REVIEW_ALREADY_EXISTS: 'You’ve already reviewed this trip.',
      // Mã này CÓ trong contract nhưng thiếu ở bảng — mọi lần gửi review cho
      // chuyến chưa xong đều rơi vào `generic`, tức câu chung chung thay cho
      // câu nói đúng chuyện. (`USER_NOT_SYNCED` ở trên thì ngược lại: có ở
      // bảng mà không có trong contract; để lại vì vô hại.)
      REVIEW_TRIP_NOT_COMPLETED: 'You can review this trip once it has finished.',
      // Task 9: một publicId trong `photos` không hợp lệ (đã xoá/không thuộc
      // booking này) — server từ chối cả review, khách cần gỡ ảnh rồi gửi lại.
      REVIEW_PHOTO_INVALID: 'One of the photos could not be attached. Remove them and try again.',
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
  /** Khuôn phản hồi dùng chung của tầng dữ liệu (ADR-0016 §4) — không gắn
      trang cụ thể; trang nào có copy riêng (vd toursPage.loadError) thì dùng
      bản riêng của nó. */
  feedback: {
    loadError: {
      title: "We couldn't load this section",
      body: 'Something went wrong on our side — this is usually momentary.',
      retry: 'Try again',
    },
  },
  // Form "lá thư" contact (contact-split.tsx, spec 2026-08-03 §2) — bề mặt
  // GHI công khai ĐẦU TIÊN của site. Lỗi validate hiển thị INLINE dưới field
  // (không phải toast — nếp đã ghi), khớp min length của
  // `CreateEnquiryInputSchema` (name ≥2, message ≥10) chạy được ở client.
  // Toast chỉ cho KẾT QUẢ thao tác (success/error/throttle).
  contactForm: {
    errors: {
      name: {
        required: 'Enter your name.',
        tooShort: 'A first name is enough — just 2 characters or more.',
      },
      email: {
        required: 'Enter your email address.',
        invalid: 'Enter a valid email address, e.g. you@example.com.',
      },
      message: {
        required: 'Tell us a little about your trip.',
        tooShort: 'A few more words would help — at least 10 characters.',
      },
    },
    submitting: 'Sending your letter…',
    toast: {
      success: {
        title: 'Letter sent — thank you!',
        body: 'Our local experts read every letter and usually reply within about 24 hours.',
      },
      error: {
        title: "Your letter didn't send",
        body: 'Something went wrong on our side. Please try again, or email us directly.',
      },
      // 429 PUBLIC_WRITE_THROTTLE (5/phút theo IP) — lời lẽ thân thiện, không
      // đổ lỗi cho khách.
      throttle: {
        title: 'Sending a little fast',
        body: 'Give it about a minute before your next letter — we read every one properly.',
      },
    },
  },
  // Form newsletter ở footer (site-footer.tsx, spec §3) — LUÔN toast một kiểu
  // dù email đã tồn tại hay chưa (anti-enumeration của contract, giữ nguyên ở
  // FE: không thêm nhánh copy nào phân biệt hai trường hợp).
  newsletterForm: {
    heading: 'Get the monthly travel letter',
    inputLabel: 'Email address',
    inputPlaceholder: 'your@email.com',
    submitLabel: 'Subscribe',
    submitting: 'Subscribing…',
    errors: {
      email: {
        required: 'Enter your email address.',
        invalid: 'Enter a valid email address, e.g. you@example.com.',
      },
    },
    toast: {
      // Một kiểu DUY NHẤT cho mọi email hợp lệ — kể cả email đã subscribe rồi.
      success: {
        title: 'Check your inbox',
        body: 'You’re on the list — the next travel letter lands in your inbox soon.',
      },
      error: {
        title: "Couldn't subscribe",
        body: 'Something went wrong on our side. Please try again in a moment.',
      },
      throttle: {
        title: 'Sending a little fast',
        body: 'Give it about a minute and try again.',
      },
    },
  },
  // Trang /newsletter/unsubscribe (spec §4) — 3 trạng thái panel + 1 trạng
  // thái lỗi cấp trang: `confirm` (token hợp lệ, chưa huỷ — GET
  // `unsubscribeConfirm`), `unsubscribed` (vừa POST huỷ xong trong phiên
  // này), `alreadyUnsubscribed` (GET cho biết token hợp lệ nhưng đã huỷ từ
  // trước — khách bấm lại link email cũ), `invalidToken` (thiếu/sai
  // `id`+`token` — KHÔNG 404, panel lỗi thân thiện + link Home).
  // `email` là bản TRẦN do API trả (người cầm link là chủ email — spec §7.3
  // "masked" là giả định sai đã adjudicate).
  unsubscribePage: {
    breadcrumbCurrent: 'Unsubscribe',
    title: 'Manage your email preferences',
    subtitle: 'Confirm below and we’ll take care of the rest — no account needed.',
    confirm: {
      heading: 'Before you go…',
      body: (email: string) => `You’re about to unsubscribe ${email} from our travel letter.`,
      button: 'Unsubscribe me',
      submitting: 'Unsubscribing…',
    },
    unsubscribed: {
      heading: 'You’re unsubscribed',
      body: 'You won’t receive our travel letter anymore. Changed your mind?',
      resubscribeButton: 'Re-subscribe',
      resubscribing: 'Re-subscribing…',
    },
    alreadyUnsubscribed: {
      heading: 'Already unsubscribed',
      body: (email: string) =>
        `${email} isn’t receiving our travel letter — you unsubscribed already.`,
      resubscribeButton: 'Re-subscribe',
      resubscribing: 'Re-subscribing…',
    },
    invalidToken: {
      heading: 'This link isn’t working',
      body: 'The unsubscribe link looks incomplete or has expired. If you still want to unsubscribe, reply to any of our emails and we’ll take care of it by hand.',
      homeLink: 'Back to home',
    },
    toast: {
      unsubscribed: {
        title: 'Unsubscribed',
        body: 'You won’t receive our travel letter anymore.',
      },
      resubscribed: {
        title: 'Welcome back',
        body: 'You’re on the list again — watch your inbox.',
      },
      error: {
        title: 'Something went wrong',
        body: 'Please try again in a moment.',
      },
    },
  },
  // Khu `/account/*` — tab nav dùng chung cho layout.tsx. Ba tab (spec
  // 2026-08-10 AMENDED — hub `/account` gỡ, key `dashboard` gỡ theo vì hết
  // call site).
  // `accountDashboard` (hub `/account` + 4 ô số + thẻ "chuyến kế tiếp") GỠ
  // theo spec 2026-08-10 AMENDED — trang `/account` giờ chỉ redirect, không
  // còn UI riêng nào đọc khối này. Xoá hẳn thay vì giữ mã chết.
  // Trang `/account/saved` — grid tour đã lưu (wishlist), nút ✕ bỏ lưu (A1:
  // state cục bộ optimistic trên mock, A2 nối `wishlist.set`).
  accountSaved: {
    heroBreadcrumb: 'Saved',
    // "Tucked inside" (M1/M8 hộ chiếu): trang saved là NGĂN KẸP trong hộ chiếu
    // — đổi giọng title theo thế giới quan mới, subtitle giữ.
    title: 'Tucked inside',
    subtitle: 'Tours you’ve bookmarked to plan later.',
    back: '← Passport',
    /** Tiêu đề MỤC ở cột trái — cố ý KHÁC `title` của trang. Đặt trùng thì cột
     *  trái và H1 thành hai dòng chữ y hệt nhau cách nhau vài chục px. */
    listHeading: 'Your list',
    blurb: 'Ready whenever you are.',
    savedCount: (n: number) => (n === 1 ? '1 tour' : `${n} tours`),
    removeAria: (title: string) => `Remove ${title} from saved tours`,
    unavailable: 'No longer available',
    // Task 9 (hướng A): copy dạy hành vi — không chỉ nói "chưa có gì", còn
    // nói RÕ khách phải bấm tim ở đâu để có.
    emptyState: {
      heading: 'Nothing saved yet',
      body: 'Tap the heart on any tour to keep it here for later.',
      cta: 'Browse tours',
    },
    // Task 7 (A2): bỏ lưu optimistic, `wishlist.set` lỗi → rollback + toast
    // (chỉ toast lỗi — thành công đã tự hiện qua card biến mất, không cần
    // xác nhận thêm, khác các form khác trong khu account).
    removeErrorToast: {
      title: "Couldn't remove this tour",
      body: 'Please try again.',
    },
  },
  // Chỉ còn phần SỐNG sau khi trang `/account/bookings` (Trips) nhập vào
  // trang hộ chiếu `/account` (spec 2026-08-11, M1) — namespace này giờ nuôi
  // `JourneyRow` (trang hộ chiếu) và grid nhãn của trang chi tiết booking.
  // Dọn key mồ côi ngày 11/08 (fixer cuối, xem docs/CHANGELOG.md).
  accountBookings: {
    /** Eyebrow đếm ngược `JourneyRow` (trang hộ chiếu) — biên hai đầu có câu
     *  riêng, "N days" chỉ dùng từ ngày thứ hai trở đi. */
    inDays: (n: number) => (n === 0 ? 'Departing today' : n === 1 ? 'In 1 day' : `In ${n} days`),
    /** Eyebrow `JourneyRow` khi chuyến đã bắt đầu — thay `inDays`. */
    endsOn: (d: string) => `Ends ${d}`,
    // Một nguồn cho cả trang hộ chiếu VÀ trang chi tiết booking (không tự
    // chế bản thứ hai) — tránh lệch số nhiều/số ít giữa hai nơi cùng hiển
    // thị travellers của MỘT booking.
    travellers: (adults: number, children: number) =>
      children > 0
        ? `${adults} adult${adults > 1 ? 's' : ''}, ${children} child${children > 1 ? 'ren' : ''}`
        : `${adults} adult${adults > 1 ? 's' : ''}`,
    // Trang hộ chiếu: nút hiện diện tĩnh cho "Load more" (chunk `?page=`,
    // xem `AccountPassportPage`).
    loadMore: 'Load more',
  },
  // Trang `/account/bookings/[code]` — grid thông tin + hành động theo
  // `BookingView` (Task 2 `bookingView`, `@/lib/booking-vm`). Mã lạ/không
  // phải của mình → `notFound()` (page tự gọi, không cần copy riêng ở đây).
  /** Trang hộ chiếu `/account` (spec 2026-08-11, M1) — mặt tiền duy nhất của
   *  khu account: header passport + tem + stats + bản đồ + journey. Copy
   *  "explored" đếm theo CATALOG thật ("of the map"), không hứa địa lý. */
  passportHome: {
    /** Hero chuẩn site (ContentHero) — vòng góp ý 11/08: tái dùng hero có sẵn
     *  thay band tự chế; danh tính (tên/MRZ/tem) vẫn ở trang giấy bên dưới. */
    heroBreadcrumb: 'Account',
    heroTitle: 'Traveler passport',
    /** Khung hộ chiếu — PassportCard (addendum spec §7.4): nhãn field nhỏ
     *  KHÔNG đánh số (bản đánh số đã bị bác); giá trị P/TRV là "ngữ pháp
     *  giấy tờ", không phải copy cần dịch. */
    zoneType: 'Type',
    zoneTypeValue: 'P',
    zoneCode: 'Code',
    zoneCodeValue: 'TRV',
    fieldName: 'Name',
    fieldEmail: 'Email',
    fieldPhone: 'Phone',
    fieldSince: 'Traveler since',
    fieldNo: 'Passport no.',
    settingsLink: 'Settings ⚙',
    /** Nút lối vào bookings trong khung hộ chiếu (góp ý 11/08 — đứng cạnh
     *  Settings ở góc phải trên của khung). */
    bookingsLink: 'My bookings',
    savedLink: 'Saved tours',
    signOutLink: 'Sign out',
    stampsHeading: 'Stamps',
    /** Sub-label (sr-only) của dấu ghost "chờ đóng" trên trang visa mở. */
    awaitingStamp: 'next stamp',
    /** Dòng chữ mờ dưới trang tem — các nơi CHƯA từng đóng dấu. */
    stillBlank: (names: string) => `Still blank in this passport: ${names}`,
    /** SỔ HÀNH TRÌNH (vòng ReUI 11/08): trái = địa danh đã đi (scrollspy +
     *  ảnh), phải = các lần đã đi (card + icon). */
    travelLogHeading: 'Travel log',
    travelLogVisits: (n: number) => `${n} visit${n === 1 ? '' : 's'}`,
    tripMeta: (dest: string, month: string, days: number) =>
      `${dest} · ${month} · ${days} day${days === 1 ? '' : 's'}`,
    /** Badge cạnh title node timeline (bản timeline 11/08 — thay stepper). */
    tripDuration: (month: string, days: number) => `${month} · ${days} day${days === 1 ? '' : 's'}`,
    viewBooking: 'View booking →',
    mapCaption: (n: number, total: number) =>
      n === 0
        ? `Your map is waiting for its first color — ${total} destinations to go.`
        : `${n} of our ${total} destinations — the map is turning jade.`,
    /** Dòng ledger nén thay hàng stats 4 ô (user chọn 11/08) — một câu mono
     *  mảnh dưới khung hộ chiếu. */
    statLine: (trips: number, places: number, pct: number, days: number) =>
      `${trips} trip${trips === 1 ? '' : 's'} · ${places} place${places === 1 ? '' : 's'} visited · ${pct}% of the map explored · ${days} day${days === 1 ? '' : 's'} on the road`,
    /** Động từ hàng journey — chọn theo `bookingView`, một nguồn ba trạng thái. */
    journeyView: 'View →',
    journeyPayNow: 'Pay now →',
    journeyReview: 'Review →',
  },
  /** Trang `/account/bookings` (addendum spec §7.4) — "Your journey" dời
   *  TRỌN từ trang hộ chiếu sang đây; route khôi phục từ redirect 308. */
  passportBookings: {
    breadcrumb: 'Bookings',
    title: 'My bookings',
    metaTrips: (n: number) => `${n} trip${n === 1 ? '' : 's'}`,
    back: '← Passport',
    emptyHeading: 'No trips booked yet',
    emptyBody: 'Book a tour and it will show up here with dates, status, and your voucher.',
    emptyCta: 'Browse tours',
  },
  /** Empty state hộ chiếu mới tinh (M4) — trang KHÔNG trống: nó là lời mời
   *  đóng con tem đầu tiên; số 0 hiển thị chính danh, không giấu. */
  passportEmpty: {
    heading: 'Every passport starts blank',
    body: 'Book your first tour and we’ll ink this page — dates, places, and a stamp to prove you were there.',
    cta: 'Browse tours',
  },
  /** Trang visa (M2) — chi tiết booking dựng như giấy tờ dán trong hộ chiếu:
   *  mộc trạng thái đóng nghiêng, lưới nhãn IATA, fine print mono. Cùng vũ trụ
   *  ấn phẩm với tấm vé checkout ("View voucher" mở đúng tấm vé đó). */
  passportVisa: {
    heroBreadcrumb: 'Booking',
    back: '← Passport',
    kicker: 'Entry · Tour booking',
    labels: {
      dates: 'Dates',
      travellers: 'Travellers',
      reference: 'Reference',
      total: 'Total paid',
    },
    /** Chữ trên mộc — MỘT ngôn ngữ dấu cho cả 5 trạng thái, màu mực đi theo
     *  `bookingView.tone` ở component. */
    stampByStatus: {
      PENDING: 'AWAITING PAYMENT',
      PAID: 'CONFIRMED',
      CANCELLED: 'CANCELLED',
      REFUNDED: 'REFUNDED',
      PARTIALLY_REFUNDED: 'PARTLY REFUNDED',
    },
    viewVoucher: 'View voucher',
    contactUs: 'Contact us',
    cancelLead: 'Need to change plans?',
    /** Fine print đáy giấy tờ — thay section Contact cũ, gọn một dòng mono. */
    fineLine: (name: string, email: string, booked: string, provider: string) =>
      `Lead traveler: ${name} · ${email} · Booked ${booked} · ${provider}`.toUpperCase(),
    requestsLine: (requests: string) => `Special requests: ${requests}`.toUpperCase(),
  },
  accountBookingDetail: {
    // Task 7 (redesign hướng A): link cạnh H1 sang trang tour công khai
    // (`/tours/{tourSlug}`) — riêng cho namespace này, KHÔNG tái dùng
    // `view`/`viewTour` của namespace khác (đã có tiền lệ mỗi trang giữ bản
    // copy riêng dù cùng chữ, xem `accountBookings.list.viewTour`).
    viewTour: 'View tour',
    /** Trang visa (M2) chỉ còn dùng đúng hai mục còn sống của bộ ba cũ —
     *  `bookingHeading`/`contactHeading`/… (redesign 11/08) đã dọn ngày
     *  11/08 (không còn section riêng cho booking/contact/actions trên
     *  trang visa, xem `AccountBookingDetailPage`). */
    sections: {
      reviewHeading: 'Your review',
      reviewBlurb: 'Tell other travellers how it went.',
    },
    // Terminal (CANCELLED/REFUNDED/PARTIALLY_REFUNDED — `actions: []` ở
    // `bookingView`) không có amount đã hoàn ở đây: `Booking` (contract
    // khách, `BookingSchema`) KHÔNG mang field ledger đó — chỉ
    // `AdminBookingDetailSchema`/`Refund` (admin-only) có. Ghi rõ để A2
    // không tưởng lầm đây là thiếu sót UI có thể tự vá bằng mock.
    terminalNote: {
      CANCELLED: 'This booking was cancelled.',
      REFUNDED: 'This booking was refunded.',
      PARTIALLY_REFUNDED: 'Part of this booking was refunded.',
    } as Record<string, string>,
    actions: {
      payNow: 'Pay now',
      cancelPending: 'Cancel booking',
      cancelConfirmTitle: 'Cancel this booking?',
      cancelConfirmBody: 'This releases your pending reservation. You can book again any time.',
      cancelConfirmCta: 'Yes, cancel it',
      cancelDismiss: 'Keep booking',
      requestCancellation: 'Request cancellation',
      viewCancellationPending: 'Cancellation requested — pending review.',
      resubmitCancellation: 'Request cancellation again',
    },
    deniedNote: (note: string) => `Your previous request was declined: ${note}`,
    policyLink: 'Read our cancellation & refund policy',
    // Chừa chỗ cụm B (form review thật) — placeholder nhẹ, không dựng logic.
    review: {
      heading: 'Your review',
      body: 'Once your trip is done, you’ll be able to leave a review here.',
    },
    // Toast SAU khi hành động ghi thành công (Task 7/A2) — trang tự
    // `router.refresh()` để đọc lại trạng thái mới, toast chỉ báo kết quả.
    toast: {
      cancelPendingTitle: 'Booking cancelled',
      cancelPendingBody: 'Your pending reservation has been released.',
      cancelRequestedTitle: 'Cancellation requested',
      cancelRequestedBody: "We'll review your request and follow up by email.",
    },
  },
  // Trang `/account/profile` hợp nhất (spec §3): tên/phone + đổi mật khẩu +
  // connected accounts + xoá tài khoản. Avatar/đổi email PARK (spec §4) —
  // avatar chữ-cái tĩnh, email read-only kèm chú thích, KHÔNG dựng form ghi.
  /** Tầng sau của hộ chiếu (M3) — form KHÔNG được lên mặt tiền: nằm sau link
   *  ⚙, khoác giấy, tái dùng nguyên logic nở-inline/password/delete. */
  passportSettings: {
    heroBreadcrumb: 'Settings',
    back: '← Passport',
    title: 'Traveler details',
    subtitle: 'The information printed in your passport.',
  },
  accountProfile: {
    /** Khối upload avatar trong Settings (mảnh 12/08, nối thật 12/08 — signed
     *  upload Cloudinary + `account.setAvatar`, ADR-0021). */
    avatar: {
      upload: 'Upload avatar',
      selected: 'Avatar selected',
      hint: (size: string) => `PNG, JPG up to ${size}. Click or drop a photo.`,
      remove: 'Remove avatar',
      errorsTitle: 'Avatar upload error(s)',
      errNotImage: 'File must be an image.',
      errTooLarge: (size: string) => `File size must be less than ${size}.`,
      uploading: (pct: number) => `Uploading… ${pct}%`,
      errUpload: 'Upload failed. Please try again.',
    },
    details: {
      heading: 'Personal information',
      /** Mô tả cột trái (redesign 11/08). Mọi mục trong khu account đều có một
       *  dòng như thế này — mục im lặng cạnh mục đang nói đọc như lỗi tải. */
      blurb: 'Your name, contact details, and password.',
      nameLabel: 'Full name',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      emailHint: 'Your sign-in email — changing it isn’t available yet.',
      save: 'Save changes',
    },
    /** Redesign 10/08: danh sách tóm tắt đọc-trước (kiểu GOV.UK) thay hai form
     *  luôn mở. Đa số lần vào trang này người ta chỉ muốn XEM lại thông tin,
     *  không sửa — mở sẵn sáu ô nhập bắt họ đọc form thay vì đọc dữ liệu. */
    summary: {
      /** Redesign hàng-nở-inline (Task 8): "Edit" thay "Change" — mỗi dòng
       *  tĩnh label/giá trị/nút, bấm vào nở form NGAY tại dòng. */
      edit: 'Edit',
      /** Cancel của MỘT dòng đang nở (khác `danger.cancel` — cancel trong
       *  dialog xoá tài khoản, hai ngữ cảnh khác nhau). */
      cancelEdit: 'Cancel',
      saveName: 'Save name',
      savePhone: 'Save phone',
      passwordLabel: 'Password',
      /** Chấm tròn, KHÔNG phải độ dài thật — hiện đúng số ký tự là rò rỉ. */
      passwordMask: '••••••••••',
      emailLocked: 'Can’t be changed yet',
      phoneHint: 'So the guide can reach you on the day.',
      notSet: 'Not set',
      /** Nhãn cho trình đọc màn hình: "Edit" trần lặp ba lần thì nghe giống
       *  nhau hệt, không biết đang sửa cái gì. */
      editAria: (field: string) => `Edit ${field}`,
    },
    password: {
      heading: 'Change password',
      // Better Auth `changePassword` BẮT BUỘC `currentPassword` (đối chiếu
      // `.d.mts`/nguồn `update-user.mjs` của gói pin — không phải suy đoán)
      // — markup A1 thiếu field này, Task 7 (A2) thêm tối thiểu để form CHẠY
      // ĐƯỢC, không phải một vòng thiết kế lại (xem AMENDED 06/08 trong spec).
      currentLabel: 'Current password',
      newLabel: 'New password',
      confirmLabel: 'Confirm new password',
      submit: 'Update password',
      mismatch: 'New password and confirmation do not match.',
    },
    connected: {
      heading: 'Connected accounts',
      subtitle: 'Sign-in methods linked to your account.',
      emailPassword: 'Email & password',
    },
    danger: {
      heading: 'Danger zone',
      subtitle: 'Irreversible account actions.',
      deleteCta: 'Delete account',
      dialogTitle: 'Delete your account?',
      dialogBody:
        'This permanently removes your account and all your data. This action cannot be undone.',
      typeToConfirm: (word: string) => `Type ${word} to confirm`,
      confirmCta: 'Yes, delete my account',
      cancel: 'Cancel',
    },
    // Toast SAU khi hành động ghi thành công (Task 7/A2).
    toast: {
      profileSavedTitle: 'Profile updated',
      passwordUpdatedTitle: 'Password updated',
      accountDeletedTitle: 'Account deleted',
      accountDeletedBody: 'Sorry to see you go — you have been signed out.',
    },
  },
  // Copy lỗi DÙNG CHUNG cho mọi hành động ghi trong khu account (booking
  // actions, bỏ lưu, xoá tài khoản — Task 7/A2). Một nguồn duy nhất tránh mỗi
  // component tự chế câu chữ hơi khác nhau cho cùng 3 tình huống: mạng/5xx,
  // 429 (hiếm ở đường authed nhưng vẫn phòng), và 401 giữa chừng (session hết
  // hạn khi đang thao tác — spec §5: message + link đăng nhập lại, KHÔNG
  // auto-signout, KHÔNG toast — đây là copy cho khối lỗi inline).
  accountActionErrors: {
    generic: 'Something went wrong. Please try again.',
    throttle: 'Too many requests — please wait a minute and try again.',
    /** 409 từ `bookings.cancel` — đã có một đơn đang mở cho booking này. Trước
     *  đây rơi vào `generic` dù copy riêng đã tồn tại ở `booking.errors`. */
    alreadyRequested: 'You’ve already sent a cancellation request for this booking.',
    /** 422 — booking ở trạng thái không huỷ online được (đã đi, đã hoàn…). */
    notCancellable: 'This booking can’t be cancelled online. Contact us for help.',
    sessionExpired: 'Your session has expired.',
    loginLink: 'Log in again',
  },
} as const;

export type Messages = typeof messages;
