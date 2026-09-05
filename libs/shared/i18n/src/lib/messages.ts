// Kho copy user-facing tập trung (chỉ tiếng Anh, luật #7). Mọi bề mặt đọc từ
// đây — không rải chuỗi inline.
import { resilience } from './resilience.js';

// MỘT câu cho luật "refund phải > 0" dù bị chặn ở client (validation.zero) hay
// server (errors.ZERO_OR_NEGATIVE) — hằng chung để hai chỗ không trôi lệch
// (bài học F1: hai bản travellers lệch số nhiều ngay lúc viết).
const REFUND_ZERO_COPY = 'Refund amount must be greater than zero.';

// MỘT bộ nhãn cho enum CancellationRequestStatus, dùng ở CẢ hai chỗ in nó:
// hàng đợi `/cancellations` (F3) và lịch sử append-only trên trang chi tiết
// booking (F1). Hai bản chép tay là hai bản sẽ trôi lệch (bài học travellers).
const CANCELLATION_STATUS_COPY = {
  REQUESTED: 'Awaiting review',
  DENIED: 'Denied',
  REFUNDED: 'Approved — refunded',
} as const;

// Ba nhãn ngữ cảnh của vùng cancellations dùng ở CẢ header cột lẫn dialog
// quyết định — một khái niệm một chữ (review F3 31/08, bài học travellers).
const CANCELLATION_CONTEXT_COPY = {
  booking: 'Booking',
  tour: 'Tour',
  customer: 'Customer',
} as const;

// Bốn nhãn ngữ cảnh của vùng reviews dùng ở CẢ header cột lẫn dialog duyệt —
// cùng luật một-khái-niệm-một-chữ với CANCELLATION_CONTEXT_COPY ở trên.
// "Author" chứ không "Customer": review CURATED không có khách nào sau lưng,
// và AdminReviewSchema cố ý KHÔNG phơi PII khách (email/tên booking).
const REVIEW_CONTEXT_COPY = {
  review: 'Review',
  rating: 'Rating',
  tour: 'Tour',
  author: 'Author',
} as const;

// MỘT chữ cho tác giả đã xoá tài khoản ở CẢ ba bề mặt (trang tour, tab
// reviews, queue admin) — bản thứ ba từng bị chép tay ở admin (review F4).
const DELETED_ACCOUNT_COPY = 'Deleted account';

// MỘT câu a11y cho cụm sao ở mọi bề mặt — bản admin từng rụng chữ "stars"
// ngay khi sinh (review F4): screen reader phải nghe cùng một câu ở admin
// lẫn web.
const RATING_LABEL_COPY = (rating: number) => `${rating} out of 5 stars`;

export const messages = {
  // Dọn 19/08 (sổ nợ B1 mở rộng): 21 khối cấp-1 KHÔNG consumer nào trên web —
  // bản nháp static-first/port Nexora đã bị thay bằng copy trong component hoặc
  // khối mới (`authForms`, `contactForm`, `formErrors`, `homeContact`…): auth ·
  // pagination · topBar · hero · features · featuredTours · destinations ·
  // travelTips · experiences · trust · testimonials · about · tourGallery ·
  // gallery · availability · paymentTrust · contact · planTrip · fieldErrors ·
  // footer · trustBand (787 dòng). GIỮ `mobile` (P5), `chatBot`/`contactLauncher`
  // (P6) và `brand` dù chưa có consumer — đó là copy cho phase sắp tới, không
  // phải nháp cũ. Quét bằng: với mỗi khoá cấp-1, grep `messages.<khoá>` ở
  // apps/web + libs/ui (bỏ spec) — 0 kết quả là mồ côi.
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
        // Siết 20/08: verify KHÔNG tự đăng nhập (đo int test) — nhắc bước kế.
        body: 'Welcome aboard — log in to start travelling.',
      },
      // Login bị chặn vì chưa verify (EMAIL_NOT_VERIFIED) → toast này rồi
      // đưa sang /verify-email kèm OTP mới.
      loginBlocked: {
        title: 'Verify your email first',
        body: 'We just sent you a fresh code.',
      },
      // Dải nhắc cho session CŨ chưa verify (tạo trước đợt siết 20/08).
      banner: {
        text: 'Please verify your email to keep your account active.',
        action: 'Verify now',
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
      // Sweep bắt lỗi form 19/08: bốn mã Better Auth từng bị gom vào `generic`
      // dù server nói rõ chuyện gì — `INVALID_EMAIL`, `PASSWORD_TOO_SHORT/LONG`
      // (đăng ký / đặt lại / đổi mật khẩu), `INVALID_PASSWORD` (đổi mật khẩu
      // nhưng mật khẩu HIỆN TẠI sai), `CREDENTIAL_ACCOUNT_NOT_FOUND` (tài
      // khoản chỉ có Google, chưa từng đặt mật khẩu).
      invalidEmail: 'Enter a valid email address, e.g. you@example.com.',
      passwordTooShort: 'Your password needs at least 8 characters.',
      passwordTooLong: 'Keep your password under 128 characters.',
      wrongCurrentPassword: 'That isn’t your current password. Try again.',
      noPasswordAccount:
        'This account signs in with Google and has no password yet — use “Forgot password” to set one.',
      generic: 'Something went wrong. Please try again.',
    },
  },
  // Lỗi TỪNG Ô NHẬP kiểm ở client (sweep 19/08) — dùng chung cho cụm auth,
  // hồ sơ tài khoản và hai form đặt chỗ (wizard + chuyến riêng). Copy nói
  // đúng ô nào sai và sai vì sao — không dùng câu gộp "valid name and email"
  // cho mọi trường hợp nữa. Ngưỡng bám ĐÚNG contract/Better Auth: name ≥2
  // (enquiry) hoặc ≥1 (booking/profile), password 8–128, phone 6–30,
  // message ≥10, requests ≤1000. `contactForm.errors`/`newsletterForm.errors`
  // giữ nguyên bản riêng đã có test — chỉ hai form đó dùng.
  formErrors: {
    name: {
      required: 'Enter your name.',
      tooShort: 'A first name is enough — just 2 characters or more.',
      tooLong: 'Keep your name under 120 characters.',
    },
    email: {
      required: 'Enter your email address.',
      invalid: 'Enter a valid email address, e.g. you@example.com.',
    },
    phone: {
      invalid: 'Enter a phone number between 6 and 30 characters, or leave it blank.',
    },
    message: {
      required: 'Tell us a little about your trip.',
      tooShort: 'A few more words would help — at least 10 characters.',
      tooLong: 'Keep your message under 2000 characters.',
    },
    specialRequests: {
      tooLong: 'Keep special requests under 1000 characters.',
    },
    password: {
      required: 'Enter your password.',
      tooShort: 'Use at least 8 characters.',
      tooLong: 'Keep it under 128 characters.',
    },
    newPassword: {
      required: 'Enter a new password.',
      tooShort: 'Use at least 8 characters.',
      tooLong: 'Keep it under 128 characters.',
    },
    currentPassword: {
      required: 'Enter your current password.',
    },
    confirmPassword: {
      required: 'Type your new password once more.',
      mismatch: 'New password and confirmation do not match.',
    },
    otp: {
      required: 'Enter the 6-digit code from your email.',
      incomplete: 'The code has 6 digits — a few are still missing.',
    },
  },
  // Booking flow (book → pay → confirm). Login-required; Stripe + PayPal. EN-only (ADR-0005).
  booking: {
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
    // Wizard 4 bước của `/tours/[slug]/book` (18/08). CỐ Ý chỉ khai thứ MỚI —
    // nhãn ô, gợi ý, tên nhà cung cấp… đã có ở `form` ngay trên và dùng lại
    // nguyên vẹn. Khai trùng một câu ở hai khoá là cách chắc chắn để sau này
    // sửa một chỗ và quên chỗ kia.
    wizard: {
      title: 'Checkout',
      // Dòng meta ngắn dưới tiêu đề — cố ý NGẮN, danh tính tour đã nằm ở cột
      // tóm tắt bên phải; in lại đầy đủ ở đây làm dòng xuống hai hàng và đẩy
      // lệch thanh bước (đo được lúc dựng wireframe).
      meta: (days: number, travellers: number) =>
        `${days} day${days > 1 ? 's' : ''} · ${travellers} traveller${travellers > 1 ? 's' : ''}`,
      stepsAria: 'Checkout steps',
      steps: {
        dates: 'Dates',
        travellers: 'Travellers',
        review: 'Review',
        pay: 'Pay',
      },
      dates: {
        heading: 'Dates',
        sub: 'Choose a departure. Prices are per adult.',
      },
      travellers: {
        heading: 'Travellers',
        sub: 'Who is going, and where we send the confirmation.',
        // Nói THẲNG chuyện trẻ em cùng giá người lớn. Quyết định 18/08 là không
        // làm giá riêng cho trẻ em; im lặng về nó thì khách chỉ phát hiện lúc
        // nhìn tổng tiền, và đó là lúc tệ nhất để ngạc nhiên.
        childRateNote: 'Children are charged at the adult rate.',
      },
      review: {
        heading: 'Review',
        sub: 'Check everything before you pay. Nothing is charged yet.',
        departure: 'Departure',
        dates: 'Dates',
        duration: 'Duration',
        pricePerPerson: 'Price per person',
        travellers: 'Travellers',
        contact: 'Contact',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        requests: 'Special requests',
        none: '—',
        edit: 'Edit',
      },
      pay: {
        heading: 'Payment',
        sub: 'Choose how to pay. You will be redirected to finish, then brought back here.',
        // KHÔNG có ô nhập thẻ ở bước này — thẻ nhập trên trang của nhà cung cấp.
        testModeNote:
          "Test mode — no real payment is taken. Card details are entered on the provider's own page, never here.",
      },
      back: 'Back',
      continue: 'Continue',
      secureNote: 'Secure encrypted checkout',
      payCta: (total: string) => `Pay ${total}`,
      // Tour hết sạch chỗ: KHÔNG dựng wizard rỗng. Thay hành vi tự-rơi-về-Private
      // của `BookingModes` (gỡ 18/08 khi hai nhánh tách trang).
      soldOut: {
        heading: 'This trip is fully booked',
        body: 'Every scheduled departure is sold out. We can still run it on your own dates — tell us when, and we’ll quote within 24h.',
        cta: 'Request a private trip',
      },
    },
    // Friendly EN for each error code (form + API). Keep the keys in sync with BookingFormError.
    errors: {
      MISSING_TOUR: 'That tour is no longer available.',
      MISSING_DEPARTURE: 'Please choose a departure date.',
      INVALID_PARTY_SIZE: 'Please enter 1–20 adults and up to 20 children.',
      INVALID_PROVIDER: 'Please choose a payment method.',
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
      // ── Receipt thay tấm vé ở /checkout/success (19/08) ──
      // CỐ Ý chỉ khai thứ MỚI. Dùng lại nguyên: travellersLabel · paymentLabel ·
      // totalLabel ('Total paid') · refLabel · stubShowCode · copyCode ở ngay
      // cụm này, và checkoutSummary.adultsLine/childrenLine/taxesNote cho bảng
      // tiền — khai trùng một câu ở hai khoá là cách chắc chắn để sau này sửa
      // một chỗ rồi quên chỗ kia.
      receiptSentTo: (email: string) => `A copy of this receipt was sent to ${email}.`,
      // Hai nhãn của bảng meta góc phải. 'Booking' đứng cạnh mã, khác
      // `refLabel` ('Booking reference') vốn là nhãn của mã CỠ LỚN trong cuống.
      bookingMetaLabel: 'Booking',
      dateMetaLabel: 'Date',
      // Nhãn cột giữa. Khác `departureLabel` ('Departure'): cột này gộp cả ngày
      // đi, thời lượng và điểm đến, không chỉ mỗi đợt khởi hành.
      tripLabel: 'Trip',
      paidAtLine: (when: string) => `Paid ${when}`,
      perTraveller: 'per traveller',
      departsOn: (date: string) => `Departs ${date}`,
      departedOn: (date: string) => `Departed ${date}`,
      print: 'Print',
      needHelp: 'Need help with this booking?',
      // Dòng cuống khi booking CHƯA trả tiền (trang /checkout/cancel dùng chung
      // khuôn receipt từ 19/08). KHÔNG được dùng `stubShowCode` ở đây: câu đó
      // bảo khách chìa mã ra ở điểm hẹn, tức ngụ ý mã đã là voucher và ghế đã
      // được giữ — sai thẳng invariant #1 (booking PENDING KHÔNG giữ seat nào).
      // Repo đã bị đúng lớp lỗi này một lần: câu "Your reservation is held" bị
      // bác ở final review cụm C vì ngụ ý giữ chỗ.
      stubNotYetVoucher: 'This code becomes your voucher once payment is complete.',
      // Nhãn pill trạng thái — NGẮN, vì nó đứng cạnh tiêu đề vốn đã nói đủ câu.
      statusPaid: 'Paid',
      statusConfirming: 'Confirming',
      statusSettled: 'Settled',
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
      /**
       * Ước tính hoàn tiền hiện NGAY TRONG dialog xin huỷ (ADR-0030 §3b) —
       * khách biết trước khi bấm, không phải chờ đội ngũ trả lời. Con số do
       * chính bảng bậc ở contract tính, cùng hàm mà màn admin dùng, nên hai
       * bên không thể nói hai số khác nhau.
       */
      /**
       * Khối tóm tắt trong dialog xin huỷ. Chia hai nửa vì đó là hai câu hỏi
       * khác nhau người ta đang hỏi cùng lúc: "tôi đang huỷ đúng cái chưa" và
       * "tôi lấy lại được bao nhiêu". Nhãn viết theo thứ NGƯỜI nhận ra, không
       * theo tên field.
       */
      cancelSummaryBooking: 'Booking',
      cancelSummaryGetBack: 'back to you',
      /** Đặt DƯỚI con số lớn: nó giải thích con số, không thay thế con số. */
      cancelSummaryOfTotal: (percent: number, total: string) => `${percent}% of ${total}`,
      /** Đã hoàn một phần từ trước — con số lớn là phần CÒN LẠI. */
      cancelSummaryAlready: (amount: string) => `${amount} already refunded`,
      /**
       * Ba việc xảy ra SAU khi bấm gửi. Có ở đây vì đây là lúc người ta cần
       * biết, chứ không phải trong một trang chính sách họ sẽ không mở.
       */
      cancelNextHeading: 'What happens next',
      cancelNextReview: 'Our team reviews your request, usually within 2 business days.',
      cancelNextMethod: 'Any refund goes back to the card or PayPal account you paid with.',
      cancelNextTiming: 'It typically takes 5–10 business days to appear on your statement.',
      refundEstimateDays: (days: number) =>
        days === 0
          ? 'Your tour departs today.'
          : days < 0
            ? 'Your tour has already started.'
            : `Your tour departs in ${days} ${days === 1 ? 'day' : 'days'}.`,
      /** Đang trong cửa sổ ân hạn — nói rõ vì sao được 100%, kẻo con số trông
       *  như may mắn và khách không biết cửa sổ ấy sắp hết. */
      refundEstimateGrace:
        'You are still within 24 hours of paying, so this cancellation is refunded in full.',
      refundEstimateLink: 'See the full refund schedule',
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
      // % lấy từ bậc đang áp (ADR-0030) chứ không viết cứng 50: bảng bậc nay
      // có cả dải 25%, và bản cũ hardcode nên dải ấy vô hình ở checkout.
      partial: (percent: number, date: string) =>
        `${percent}% refund available until ${date} — see our`,
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
        // Caption viết THEO ẢNH đã gắn vào 6 khe `region-gallery-north-*` (19/08,
        // đảo chiều như đợt Moments: chọn ảnh có sẵn trước, sửa chữ sau) — không
        // còn Ô Quy Hồ / Bắc Hà vì kho không có ảnh Sa Pa/Hạ Long; đổi ảnh thì
        // phải đổi caption cùng chỉ số.
        galleryTiles: [
          'Junks among the karst islands of Lan Hạ Bay',
          'Rowing into the flooded caves at Tràng An',
          'The Mưa Cave viewpoint above the paddies, Ninh Bình',
          'Terraced valleys along the Hà Giang loop',
          'Lantern-lit Train Street in Hanoi’s Old Quarter',
          'Paddies at dusk in the Mai Châu valley',
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
        // Caption theo ảnh 6 khe `region-gallery-central-*` (19/08) — kho không có
        // ảnh Huế nên hai ô Huế nhường cho Đà Nẵng/Phong Nha; xem ghi chú ở north.
        galleryTiles: [
          'Boats along the Hội An riverfront',
          'Lanterns over the Thu Bồn river, Hội An',
          'The Golden Bridge above Bà Nà',
          'Lady Buddha on the Sơn Trà peninsula, Đà Nẵng',
          'Coracles waiting on Mỹ Khê beach',
          'Daylight at the mouth of a Phong Nha cave',
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
        // Caption theo ảnh 3 khe `region-gallery-south-*` (19/08); ô lớn 16/9 là
        // ảnh Phú Quốc từ trên cao (tỉ lệ 1.86 — khớp ô), xem ghi chú ở north.
        galleryTiles: [
          'The fishing harbour at Phú Quốc from above',
          'The Sài Gòn skyline at dusk',
          'Sampans in the Bến Tre canals',
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
            // 'Island sunsets' (trước 'Island beaches'): caption đi theo ảnh khe
            // `region-signature-south-3` — kho chưa có ảnh bãi biển Phú Quốc.
            { title: 'Phú Quốc', caption: 'Island sunsets' },
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
      ratingLabel: RATING_LABEL_COPY,
      /** Tác giả đã xoá tài khoản — `PublicReviewSchema.authorName` là null và
          schema ghi rõ FE render đúng chuỗi này. Review vẫn ở lại vì nó là đánh
          giá thật; chỉ danh tính biến mất. */
      deletedAuthor: DELETED_ACCOUNT_COPY,
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
      deletedAccount: DELETED_ACCOUNT_COPY,
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
      /** Thu/phóng trong lightbox (nợ A12). Bản duyệt có sẵn khung CSS cho hàng
          công cụ này nhưng không có hành vi — hành vi là mới. */
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomLevel: (percent: number) => `${percent}%`,
      zoomToggle: 'Zoom photo',
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
      /**
       * Vế SAU của lời hứa miễn phí (ADR-0030 §3b). Badge cũ dừng ở đúng hạn
       * chót nên khách lỡ một ngày bị bất ngờ — mà cái họ rơi vào không phải
       * hư không, nó là bảng bậc đã công bố. Câu này nói ra điều đó, và link
       * đổi hướng về chính bảng ấy thay vì tab policy riêng của tour.
       */
      afterFreeWindow: 'After that, our standard refund schedule applies.',
      viewRefundSchedule: 'See the refund schedule',
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
    fallbackAuthor: 'Nexora guides',
    fallbackCategory: 'Journal',
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
    /**
     * Ba trạng thái mới của chỗ đánh giá (ADR-0032 §7). Trước đó MỌI review đã
     * gửi đều đọc chung câu `alreadyReviewedBody` — kể cả bài vừa bị bác, nên
     * khách bị bác quay lại đọc thấy một lời cảm ơn.
     */
    pendingTitle: 'Your review is with our team',
    pendingBody:
      'We read every review before it goes live. You can still change it until someone does.',
    rejectedTitle: 'Your review wasn’t published',
    /** Nhãn cho nguyên văn lý do người duyệt viết — cùng câu khách nhận qua mail. */
    rejectedReason: 'Why',
    rejectedBody: 'Rewrite it below and we’ll take another look.',
    /**
     * Hết lượt. KHÔNG xin lỗi và KHÔNG mập mờ: nói đã xem mấy lần, rồi mở một
     * cửa thật (liên hệ) thay vì để khách bấm vào một form không còn ở đó.
     */
    rejectedFinalTitle: 'We’ve looked at this review twice',
    rejectedFinalBody:
      'We can’t publish it, and it can’t be edited again. If you think we got this wrong, get in touch and a person will read it.',
    /** Nút gửi ở chế độ SỬA — khác "Submit review" vì việc khác nhau. */
    resubmit: 'Send for review again',
    resubmitting: 'Sending…',
    /** Ảnh cũ hiện sẵn ở chế độ sửa; gỡ được, vì bác vì ảnh là ca có thật. */
    keptPhoto: 'Photo already on this review',
    // Friendly EN for each `POST /reviews` error code (+ generic fallback).
    errors: {
      USER_NOT_SYNCED: 'We couldn’t verify your account. Sign out and back in, then try again.',
      REVIEW_NOT_ELIGIBLE: 'This booking isn’t eligible for a review yet.',
      BOOKING_FORBIDDEN: 'This booking doesn’t belong to your account.',
      BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
      REVIEW_ALREADY_EXISTS: 'You’ve already reviewed this trip.',
      REVIEW_NOT_FOUND: 'We couldn’t find that review.',
      /** Đã duyệt (đang hiển thị) hoặc đã hết lượt — server là phán quyết cuối. */
      REVIEW_NOT_EDITABLE: 'This review can’t be edited any more.',
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
  // Form "Tell us your dates" ở TRANG CHỦ (home/contact.tsx) — nối
  // `enquiries.create` 19/08 cùng khuôn contact-split (validate client
  // `validateEnquiry`, honeypot, toast). Lỗi từng ô DÙNG CHUNG
  // `contactForm.errors`; toast có bản riêng vì copy "letter" của /contact là
  // ẩn dụ lá thư, không hợp với form trang chủ.
  homeContact: {
    regionLabel: 'Region',
    regionAny: 'Anywhere in Vietnam',
    submitting: 'Sending…',
    toast: {
      success: {
        title: 'Request sent — thank you!',
        body: 'Our local experts will draft two or three routes and reply within about 24 hours.',
      },
      error: {
        title: "Your request didn't send",
        body: 'Something went wrong on our side. Please try again, or email us directly.',
      },
      throttle: {
        title: 'Sending a little fast',
        body: 'Give it about a minute before your next request.',
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
    /**
     * Chuyện gì đã xảy ra với tiền, in ngay trên giấy tờ booking. Trước 04/09
     * khách hoàn một phần chỉ thấy chữ "Cancelled" — bằng chứng duy nhất về số
     * tiền nằm trong hộp mail.
     */
    refundLine: {
      full: (amount: string) => `${amount} has been refunded to your original payment method.`,
      /** Nói CẢ hai số: chỉ in số đã hoàn thì khách dễ tưởng đó là toàn bộ. */
      partial: (amount: string, total: string) =>
        `${amount} of ${total} has been refunded to your original payment method.`,
      /** Huỷ mà không hoàn đồng nào cũng phải nói ra, kẻo khách ngồi đợi. */
      none: 'No refund was due on this booking.',
      timing: 'It can take 5–10 business days to appear on your statement.',
      schedule: 'See the refund schedule',
    },
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
      // `mismatch` chuyển sang `formErrors.confirmPassword.mismatch` (sweep
      // 19/08 — dùng chung với /reset-password); không giữ bản sao ở đây.
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
  // ── P4 Admin (apps/admin — ADR-0026) ──────────────────────────────────
  // Copy back-office cũng English-only (luật #7); consumer là app admin.
  admin: {
    login: {
      // Copy theo wireframe ReUI auth-8 (vòng redesign 20/08 v2 — mockup lưu
      // ở docs/design/mockups/admin-login/): card đặc giữa màn, topbar pill.
      title: 'Sign in to Nexora',
      subtitle: 'Pick up where you left off.',
      lookingForSite: 'Looking for the main site?',
      visitSite: 'Visit nexora-travel.agency',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Sign in',
      submitting: 'Signing in…',
      errors: {
        emailRequired: 'Enter your email address.',
        emailInvalid: 'Enter a valid email address, e.g. you@example.com.',
        passwordRequired: 'Enter your password.',
        invalidCredentials: 'Incorrect email or password.',
        emailNotVerified: 'Verify your email on nexora-travel.agency first, then sign in here.',
        generic: 'Something went wrong. Please try again.',
      },
      backToSite: 'Back to nexora-travel.agency',
    },
    notAuthorized: {
      title: 'Not authorized',
      body: 'This area is for the Nexora team. Your account doesn’t have admin access.',
      signOut: 'Sign out',
      backToSite: 'Go to the main site',
    },
    shell: {
      // Nhãn sidebar — 18 vùng theo khảo sát 20/08, nhóm 3 cụm.
      groups: {
        operations: 'Operations',
        content: 'Content',
        system: 'System',
      },
      soon: 'Soon',
      dashboard: 'Dashboard',
      bookings: 'Bookings',
      cancellations: 'Cancellations',
      reviews: 'Reviews',
      enquiries: 'Enquiries',
      subscribers: 'Subscribers',
      tours: 'Tours',
      departures: 'Departures',
      categories: 'Categories',
      destinations: 'Destinations',
      posts: 'Posts',
      media: 'Media library',
      appearance: 'Appearance',
      reports: 'Reports',
      outbox: 'Outbox',
      paymentEvents: 'Payment events',
      users: 'Users',
      signOut: 'Sign out',
      viewSite: 'View site',
    },
    // Dashboard chờ số thật (vòng gọt bước 4, 21/08): khung card/chart của
    // dashboard-01 giữ nguyên, label theo 4 metric SẼ CÓ ở P4d (map từ
    // admin-stats của Nexora cũ); demo số đã dọn — không bịa số.
    dashboard: {
      cards: {
        revenue: 'Total revenue',
        paidBookings: 'Paid bookings',
        pendingReviews: 'Reviews to moderate',
        newEnquiries: 'New enquiries',
      },
      awaiting: 'Awaiting live data',
      chart: {
        title: 'Revenue over time',
        description: 'Numbers arrive with the stats service (P4d).',
        /**
         * Cửa sổ thời gian của biểu đồ. Ba chuỗi này TRƯỚC 01/09 nằm cứng
         * trong `chart-area-interactive.tsx` (di sản block `dashboard-01`);
         * đưa về đây khi cụm nút đó chuyển sang dùng `StatusFilterTabs` —
         * copy user-facing thì ở i18n, luật 7.
         */
        rangeLabel: 'Select a time range',
        range90d: 'Last 3 months',
        range30d: 'Last 30 days',
        range7d: 'Last 7 days',
      },
      table: {
        tab: 'Recent bookings',
        /**
         * Nhãn cả cụm chọn khung nhìn (01/09 — bảng dashboard dùng lại
         * `StatusFilterTabs` của kit). Hiện chỉ có MỘT khung nhìn; câu này
         * tồn tại vì cụm điều khiển phải tự giới thiệu cho trình đọc màn
         * hình, kể cả khi nó mới có một lựa chọn.
         */
        viewLabel: 'Select a view',
      },
    },
    // Copy DÙNG CHUNG của kit bảng admin (spec P4b §2.1 — kit mọc từ vùng
    // bookings, ba vùng sau tiêu thụ lại): phân trang server + menu cột.
    table: {
      // Câu tổng đứng trước, nút điều hướng chỉ mang nhãn đọc-màn-hình (mũi
      // tên đã đủ nghĩa cho mắt thường).
      summary: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
      page: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
      firstPage: 'Go to first page',
      previousPage: 'Go to previous page',
      nextPage: 'Go to next page',
      lastPage: 'Go to last page',
      rowsPerPage: 'Rows per page',
      columns: 'Columns',
      /**
       * Tiêu đề nhóm BÊN TRONG menu cột (khuôn `dropdown-menu-12`, user chốt
       * 01/09). Không lặp lại chữ trên nút bấm ("Columns") — người ta vừa bấm
       * vào đó xong; câu này nói việc menu LÀM được, thứ mà một danh sách
       * checkbox không tự nói ra.
       */
      columnsMenuLabel: 'Show or hide columns',
      /** aria-label cho landmark `<nav>` bọc cụm nút phân trang. */
      pagination: 'Pagination',
      /**
       * MỘT nhãn cho nút xoá của cả hàng điều khiển (05/09), thay bảy cặp
       * `clear`/`clearDates` rời trước đây. Chữ số nhiều "filters" là cố ý:
       * nút xoá mọi bộ lọc ở hàng bên phải, không phải riêng ô đứng cạnh nó.
       */
      clearFilters: 'Clear filters',
      /**
       * Nhãn nút khoảng ngày khi CHƯA lọc (05/09, cùng đợt đổi hai ô ngày
       * thành một range picker). Ở `admin.table` chứ không ở từng vùng: ba
       * vùng dùng chung một câu, còn câu RIÊNG của mỗi vùng — ngày nào đang
       * được lọc — vẫn nằm ở `dateFilterLabel` của vùng ấy.
       */
      dateAny: 'Any date',
      /** Mới có một đầu — xảy ra khi URL gõ tay chỉ mang `from` hoặc `to`. */
      dateFrom: (date: string) => `From ${date}`,
      dateUntil: (date: string) => `Until ${date}`,
    },
    /**
     * Khối payload trong drawer chi tiết (kit `JsonDrawer` — `/outbox` và
     * `/payment-events` dùng chung). User chốt 03/09: back-office này không
     * phải ai cũng đọc được JSON, nên payload có HAI chế độ xem và chế độ dễ
     * đọc là mặc định.
     */
    payload: {
      /** aria-label cụm chuyển chế độ — hai nút đã tự nói tên chế độ. */
      viewLabel: 'Payload view',
      /** Danh sách nhãn · giá trị, PHẲNG (user chốt: không lồng vào nhau). */
      simple: 'Simple',
      /** JSON nguyên văn, thụt lề — thứ vốn là mặc định trước 03/09. */
      developer: 'Developer',
      /**
       * Chuỗi rỗng, object rỗng, mảng rỗng. Khác `bookings.detail.empty` ('—',
       * dùng cho giá trị VẮNG): ở đây khoá có tồn tại và giá trị đúng là rỗng —
       * hai chuyện khác nhau, và một bề mặt vận hành phải phân biệt được.
       */
      emptyValue: '(empty)',
      /** Boolean đọc thành lời — `true`/`false` là chữ của lập trình viên. */
      yes: 'Yes',
      no: 'No',
      /** Phần tử mảng: đánh số TỪ 1 cho người đọc, không phải index từ 0. */
      item: (index: number) => `Item ${index}`,
      /** Payload không phải object (chuỗi/số trần) — một dòng duy nhất. */
      scalar: 'Value',
      /** Payload là `{}` — nói thẳng thay vì hiện một khoảng trắng. */
      none: 'This payload has no fields.',
      /**
       * Nhãn đọc-màn-hình của nút đóng drawer. Trước 03/09 chuỗi này nằm CỨNG
       * trong `SheetContent` của `@tourism/ui`; drawer mới tự dựng nút đóng
       * nên nó về đúng chỗ của copy user-facing (luật 7).
       */
      close: 'Close',
    },
    /**
     * Hàng stat card đứng TRÊN bảng của ba trang vùng (spec P4b §3-F5 — mẫu
     * user chốt 31/08: nhãn · số lớn · pill delta ↑/↓ · "vs X prior 28 days").
     * Copy DÙNG CHUNG ở đây vì cả ba vùng in cùng một hình dạng card; nhãn
     * riêng của từng vùng nằm trong ba khối con.
     *
     * Số ngày là THAM SỐ, không viết cứng "28": server trả `period.windowDays`
     * và mọi câu chữ ăn theo nó — đổi cửa sổ ở một chỗ là cả UI đổi theo,
     * không có chuỗi nào nói dối về kỳ mà nó đang mô tả.
     */
    stats: {
      /** aria-label cho landmark bọc hàng card — trang có hai vùng số liệu. */
      regionLabel: 'Key numbers',
      /** Caption của metric ĐẾM TRONG một cửa sổ ("vs $900.00 prior 28 days"). */
      comparison: (previous: string, days: number) => `vs ${previous} prior ${days} days`,
      /**
       * Caption khi kỳ do ADMIN chọn (ADR-0028) — in thẳng khoảng ngày của
       * kỳ TRƯỚC thay vì "prior N days".
       *
       * Vì sao hai câu chứ không một: cửa sổ trượt trôi theo đồng hồ nên một
       * ngày cụ thể in ra sẽ cũ đi từng phút, còn kỳ đã chọn thì đứng yên và
       * là thứ admin đem đối soát — lúc đó "prior 30 days" bắt người ta tự
       * đếm lùi để biết mình đang so với cái gì.
       */
      comparisonRange: (previous: string, range: string) => `vs ${previous} · ${range}`,
      /**
       * Dòng khoảng ngày đứng trên CẢ hàng card — nói một lần thay vì lặp
       * trong bốn caption. Chỉ hiện khi kỳ do admin chọn.
       */
      periodLabel: (range: string) => `Showing ${range}`,
      /**
       * Caption của metric ẢNH CHỤP (hàng đợi đang mở): con số ấy KHÔNG đếm
       * trong một kỳ, nó là số của MỘT MỐC — nên "prior 28 days" sẽ nói sai
       * về chính thứ đang hiện.
       *
       * Dấu `·` giữa hai phần là BẮT BUỘC, không phải trang trí (user báo
       * 04/09): đây là caption DUY NHẤT của cả bề mặt stats có hai con số
       * đứng cạnh nhau, và `vs 0 28 days ago` đọc thành "028". Các câu khác
       * đều có chữ chen giữa (`prior`, `on`). Cùng dấu phân cách với
       * `comparisonRange` nên hai caption của một hàng card vẫn là một hệ.
       */
      snapshotComparison: (previous: string, days: number) => `vs ${previous} · ${days} days ago`,
      /**
       * Cùng metric ảnh chụp nhưng kỳ do ADMIN chọn (ADR-0028 §AMEND): mốc so
       * sánh là một NGÀY cụ thể (đầu kỳ) chứ không phải "N ngày trước" — kỳ
       * đã chọn thì đứng yên, nên nói được tên ngày.
       */
      snapshotComparisonAt: (previous: string, date: string) => `vs ${previous} on ${date}`,
      /** Kỳ này không tính được (không mẫu số / không có dữ liệu) — không phải 0. */
      noValue: '—',
      /** Pill delta chỉ có mũi tên + độ lớn; trình đọc màn hình cần một câu.
       *  `amount` ĐÃ kèm đơn vị ('33.3%', '2.0 pp', '0.23') — up/down không
       *  tự thêm gì (vòng vá review F5: delta theo đơn vị của metric). */
      trend: {
        up: (amount: string) => `Up ${amount} on the previous period`,
        down: (amount: string) => `Down ${amount} on the previous period`,
        flat: 'Unchanged on the previous period',
        /** Điểm phần trăm — cho metric vốn là %. */
        percentagePoints: (points: string) => `${points} pp`,
        /** Kỳ trước bằng 0 — không có % tương đối nhưng PHẢI có tín hiệu. */
        newLabel: 'New',
        fromZero: 'Up from zero in the previous period',
      },
      bookings: {
        revenue: 'Revenue',
        paid: 'Paid bookings',
        created: 'New bookings',
        cancellationRate: 'Cancellation rate',
      },
      cancellations: {
        pendingQueue: 'Pending queue',
        approved: (days: number) => `Approved ${days}d`,
        denied: (days: number) => `Denied ${days}d`,
        /**
         * Nhãn khi kỳ do ADMIN chọn — BỎ hậu tố "Nd" (ADR-0028 §AMEND).
         * "Approved 31d" đọc thành "31 ngày gần nhất", tức một cửa sổ TRƯỢT;
         * nhưng lọc tháng 5 là một kỳ đứng yên, và khoảng ngày đã nói ở dòng
         * ngay trên hàng card rồi.
         */
        approvedInPeriod: 'Approved',
        deniedInPeriod: 'Denied',
      },
      reviews: {
        pending: 'Pending',
        /**
         * MẪU SỐ của hàng đợi (ADR-0028 §AMEND 2 §4): không có nó thì
         * "Approved 12" không đọc được — 12 trên 12 hay 12 trên 300 là hai
         * tình trạng khác hẳn. Cùng tập, cùng cột neo với `averageRating`.
         */
        submitted: (days: number) => `Submitted ${days}d`,
        approved: (days: number) => `Approved ${days}d`,
        averageRating: 'Average rating',
        /** Nhãn khi kỳ do ADMIN chọn — BỎ hậu tố "Nd" (cùng luật cancellations). */
        submittedInPeriod: 'Submitted',
        approvedInPeriod: 'Approved',
      },
      /**
       * Vùng outbox (spec P4c §3-F7). Chỉ `sent` đếm trong kỳ; hai card còn
       * lại là ẢNH CHỤP hàng đợi — không có kỳ trước, caption nói thẳng con
       * số ấy đang chờ gì.
       */
      outbox: {
        sent: (days: number) => `Sent ${days}d`,
        /**
         * Sent là số ĐƠN của kỳ này, không có "vs kỳ trước" (vòng vá review
         * F7): purge 30 ngày xoá gần hết kỳ 28–56 ngày trước.
         */
        sentCaption: (days: number) =>
          `Delivered in the last ${days} days — skipped emails not counted`,
        queued: 'Queued now',
        /** Ảnh chụp không có delta — caption thay cho dòng "vs …". */
        queuedCaption: 'Waiting for the next worker run',
        failed: 'Failed now',
        failedCaption: 'Parked after too many attempts — needs an operator',
        failedCaptionNone: 'Nothing is waiting for a retry',
        /** Pill đỏ trên card Failed khi > 0 — không có mũi tên, chỉ là lời gọi. */
        needsAttention: 'Needs attention',
        needsAttentionSr: (count: string) => `${count} failed emails need an operator`,
      },
      /**
       * Vùng payment events (spec P4c §3-F8). `received`/`linked` đếm trong
       * kỳ theo receivedAt (có kỳ trước thật — sổ không purge); `unprocessed`
       * là ẢNH CHỤP: row đã nhận mà handler chưa xong.
       */
      paymentEvents: {
        received: (days: number) => `Received ${days}d`,
        unprocessed: 'Unprocessed now',
        /** Ảnh chụp không có delta — caption nói row ấy đang ở đâu. */
        unprocessedCaption: 'Received, handler not finished — the provider will retry',
        unprocessedCaptionNone: 'Every delivery has been handled',
        /**
         * Caption khi có row KẸT (chưa xong quá `PAYMENT_EVENT_STUCK_MINUTES`
         * phút — vòng vá review F8): provider đã retry mà vẫn không xong.
         */
        stuckCaption: (count: string, minutes: number) =>
          `${count} stuck for more than ${minutes} min — the provider's retries did not finish`,
        linked: (days: number) => `Linked to a booking ${days}d`,
        /** Pill đỏ trên card Unprocessed CHỈ khi có row kẹt — không mũi tên, chỉ là lời gọi. */
        needsAttention: 'Needs attention',
        needsAttentionSr: (count: string, minutes: number) =>
          `${count} payment events have been unprocessed for more than ${minutes} minutes`,
      },
      /**
       * Vùng enquiries (spec P4c §3-F9). `created`/`won` đếm trong kỳ (won
       * neo mốc của EVENT audit, không phải `updatedAt` — xem JSDoc
       * StatsService); `open` là ẢNH CHỤP hàng chờ, KHÔNG có callout đỏ:
       * lead đang mở là trạng thái bình thường của một đường bán hàng.
       */
      enquiries: {
        /** "New" ở đây là "mới đến trong kỳ", KHÔNG phải trạng thái NEW. */
        created: (days: number) => `New ${days}d`,
        won: (days: number) => `Won ${days}d`,
        open: 'Open now',
        /**
         * Nhận danh sách nhãn dựng từ `OPEN_ENQUIRY_STATUSES` (vòng vá review
         * F9) — không kể tay ba trạng thái ở đây để thêm một trạng thái mở
         * là caption tự đúng theo.
         */
        openCaption: (statuses: string) => `Leads still to work — ${statuses}`,
        openCaptionNone: 'Nothing left in the pipeline',
      },
      /**
       * Vùng subscribers (spec P4c §3-F10). `created`/`unsubscribed` đếm
       * trong kỳ nhưng neo HAI cột khác nhau (`created_at` / `unsubscribed_at`)
       * — caption nói rõ cột nào, vì "New" và "Unsubscribed" cạnh nhau rất dễ
       * bị đọc thành hai lát của cùng một tập. `active` là ẢNH CHỤP danh
       * sách, KHÔNG có callout đỏ: đây là con số người ta muốn thấy LỚN.
       */
      subscribers: {
        /** "New" là "đăng ký mới trong kỳ", kể cả địa chỉ sau đó đã huỷ. */
        created: (days: number) => `New ${days}d`,
        unsubscribed: (days: number) => `Unsubscribed ${days}d`,
        active: 'Active now',
        /**
         * Ảnh chụp không có delta — caption thay cho dòng "vs …". Nói rõ
         * "whole list" (vòng vá review F10): card đếm TOÀN bảng, còn bảng
         * bên dưới có thể đang lọc theo email/nguồn — hai con số khác nhau
         * về cùng một vị từ là chuyện phải nói trước.
         */
        activeCaption:
          'Addresses that still receive the newsletter — whole list, not the current filter',
        activeCaptionNone: 'Nobody is on the list right now',
      },
    },
    /**
     * Trang báo cáo tháng (spec P4b §3-F6) — bề mặt admin đầu tiên được thiết
     * kế để IN RA GIẤY (browser Print → PDF), nên copy ở đây phải tự đứng
     * vững khi không còn sidebar, không còn tooltip, không còn chỗ nào để hỏi.
     *
     * Vì vậy `definitions` nói thẳng ba định nghĩa dễ hiểu nhầm nhất ngay
     * trên bản in: doanh thu là GROSS neo theo ngày trả tiền, hoàn tiền là
     * dòng tiền đi ra chứ không phải phép trừ vào doanh thu, và phân rã trạng
     * thái là ảnh chụp HÔM NAY của lứa booking tháng đó. Một tờ giấy không
     * kèm định nghĩa là một tờ giấy sẽ bị đọc sai.
     */
    reports: {
      title: 'Monthly report',
      /** Nhãn ô chọn tháng (sr-only — chữ trong ô đã tự nói). */
      monthLabel: 'Report month',
      print: 'Print',
      exportCsv: 'Export CSV',
      /** Dòng phụ đề: kỳ báo cáo, cả hai đầu là ngày TÍNH VÀO. */
      period: (from: string, to: string) => `${from} – ${to}`,
      generatedAt: (at: string) => `Generated ${at}`,
      cards: {
        /**
         * Cùng con số như trước (neo `paid_at`), tên đúng hơn từ 05/09: khi
         * cạnh nó đã có "Revenue recognised" thì chữ "Revenue" trần thành mơ
         * hồ — hai cái đều là doanh thu theo một nghĩa nào đó.
         */
        revenue: 'Cash collected',
        recognizedRevenue: 'Revenue recognised',
        grossProfit: 'Gross profit',
        netProfit: 'Net profit',
        /** Caption của card lợi nhuận gộp — biên % nói nhiều hơn kỳ báo cáo. */
        marginCaption: (pct: string) => `Gross margin ${pct}`,
      },
      /**
       * Bảng P&L (ADR-0033 §1) — khối số liệu neo NGÀY CHUYẾN CHẠY, đứng cạnh
       * hai bảng cũ vốn neo ngày trả tiền.
       */
      pnlTable: {
        heading: 'Profit and loss',
        metric: 'Line',
        value: 'Amount',
        recognizedRevenue: 'Revenue recognised',
        cogsVariable: 'Cost of sales — per traveller',
        cogsFixed: 'Cost of sales — per departure',
        cogsTotal: 'Total cost of sales',
        grossProfit: 'Gross profit',
        /** Nhãn mang CHÍNH thuế suất đã dùng — env không có ngày hiệu lực. */
        taxAmount: (rate: string) => `Tax on margin (${rate})`,
        paymentFees: 'Payment processing',
        netProfit: 'Net profit',
        /** Chú thích dưới dòng giá vốn cố định — mẫu số của nó. */
        departuresRun: (count: string) =>
          `${count} ${count === '1' ? 'departure' : 'departures'} ran this month`,
        /**
         * Không phải trang trí: một báo cáo in "Gross profit $8,400" trong khi
         * 12 booking chưa khai giá vốn là một báo cáo NÓI DỐI. Có câu này thì
         * nó chỉ là chưa đầy đủ.
         */
        costMissing: (count: string) =>
          `${count} bookings have no cost data, so cost of sales is understated.`,
        /** Biên gộp KHÔNG XÁC ĐỊNH — khác hẳn 0%. */
        marginUnknown: '—',
      },
      bookingsTable: {
        heading: 'Bookings created this month',
        status: 'Status',
        count: 'Bookings',
        total: 'Total',
        /** Bảng luôn đủ hàng, kể cả tháng trắng — nhưng vẫn cần một lời. */
        empty: 'No bookings were created in this month.',
      },
      operationsTable: {
        heading: 'Money and operations',
        metric: 'Metric',
        value: 'Value',
        revenue: 'Revenue (gross)',
        paidBookings: 'Paid bookings',
        newBookings: 'New bookings',
        refundedTotal: 'Refunds paid out',
        refunds: 'Refund payments',
        cancellationsApproved: 'Cancellations approved',
        cancellationsDenied: 'Cancellations denied',
        reviewsApproved: 'Reviews approved',
      },
      definitions: {
        heading: 'How to read these numbers',
        revenue:
          'Revenue counts money taken in this month (by payment date) and is gross — refunds are not subtracted from it.',
        refunds:
          'Refunds paid out is money that left this month; a refund may belong to a booking paid in an earlier month.',
        statuses:
          'The status table follows the bookings created this month and shows where each one stands today, so it can change after the month closes.',
        recognised:
          'Revenue recognised counts trips that finished this month, so it differs from cash collected — money for a December trip is taken today but earned in December.',
        costs:
          'Per-traveller costs follow the travellers who went; per-departure costs are charged once for each departure that ran, whether it sold out or not.',
        netProfit:
          'Net profit is after cost of sales, tax and payment fees. It does not include salaries, rent or marketing.',
      },
      /** Nút tải file — Excel từ 05/09 (ADR-0034), thay nút CSV cũ. */
      exportExcel: 'Export Excel',
      /**
       * Chữ RIÊNG của file Excel (ADR-0034). Tách khỏi `csv` cũ vì file này có
       * năm sheet chứ không phải hai cột, và tên sheet là thứ chỉ nó mới cần.
       */
      xlsx: {
        title: 'Nexora — monthly report',
        period: 'Period',
        generatedAt: 'Generated',
        currency: 'Currency',
        /**
         * In thuế suất lên chính file: env không có ngày hiệu lực, nên hai
         * file tải cùng một tháng ở hai thời điểm có thể mang hai số thuế khác
         * nhau (ADR-0033 §5). Không in suất thì không ai đối chiếu được.
         */
        taxRate: 'Tax rate on margin',
        cashHeading: 'Cash flow',
        grossMargin: 'Gross margin',
        departuresRun: 'Departures that ran',
        costDataMissing: 'Bookings with no cost data',
        sheets: {
          summary: 'Summary',
          bookings: 'Bookings',
          operations: 'Operations',
          /** Tiêu đề nói thẳng tập nào: người đọc sẽ thử cộng cột để kiểm chéo. */
          detail: 'Detail (created this month)',
          definitions: 'Definitions',
        },
        detail: {
          code: 'Code',
          tour: 'Tour',
          departureEnds: 'Departure ends',
          travellers: 'Travellers',
          total: 'Total',
          refunded: 'Refunded',
          status: 'Status',
        },
      },
    },
    /**
     * Copy cho hai tấm lưới đỡ lỗi của admin (`app/error.tsx` +
     * `app/not-found.tsx` — review F1 31/08): lỗi đọc API (401 phiên chết
     * giữa chừng, timeout, API sập) và địa chỉ không tồn tại.
     */
    errors: {
      title: 'Something went wrong',
      body: 'The back office could not load this view. Your session may have expired, or the API is unreachable.',
      retry: 'Try again',
      signIn: 'Sign in again',
      notFoundTitle: 'Nothing at this address',
      notFoundBody: 'This page does not exist — the link may be stale or the record was removed.',
      backHome: 'Back to dashboard',
      /**
       * Export không dựng được vì API không trả lời. Đây là BODY của một
       * response 502 mà người bấm nút Export nhận THAY CHO file, nên nó phải
       * nói đủ hai điều: KHÔNG có gì được tải về, và việc cần làm tiếp theo.
       *
       * Cố ý KHÔNG dùng chung `write.GENERIC`: câu đó mập mờ có chủ đích
       * ("may or may not have gone through") vì nó nói về hành vi GHI. Export
       * chỉ ĐỌC — không có gì để lỡ đi qua, và mượn giọng mập mờ ở đây sẽ làm
       * operator hoảng về một thứ chưa hề xảy ra.
       */
      exportFailed:
        'The export could not be built — the back office could not reach the API. Nothing was downloaded; go back and try again.',
      /**
       * BODY của response 409 khi `sel` không khớp hàng nào — trang đã đổi
       * dưới chân admin (hàng bị huỷ, bộ lọc khác, dữ liệu mới chen vào). Trả
       * một CSV chỉ có dòng tiêu đề là NÓI DỐI: người tải tưởng tập rỗng là
       * sự thật. Câu này phải nói được việc cần làm tiếp theo.
       */
      exportSelectionStale:
        'Those rows are no longer on this page — the list changed since you selected them. Go back, pick the rows again, then export.',
      /**
       * 409 của export-all khi tập đổi kích thước giữa vòng gom trang (vòng vá
       * review F10): hàng mới chen đầu list đẩy hàng cũ nhất ra khỏi cửa sổ
       * — không giao file thiếu hàng mà người tải tưởng là đủ.
       */
      exportListChanged:
        'The list changed while the file was being built, so it was not saved. Export again.',
      /**
       * Copy DÙNG CHUNG cho mã lỗi TẦNG VẬN CHUYỂN của mọi hành vi ghi admin
       * (refund F2, decide F3, moderate F4…) — tách khỏi mã CONTRACT của từng
       * endpoint (review F2 31/08): mỗi vùng chỉ khai câu cho mã riêng của
       * nó, còn "hết phiên/mất quyền/không rõ" là một giọng cho cả admin.
       */
      write: {
        UNAUTHORIZED: 'Your session expired. Sign in again, then retry the action.',
        FORBIDDEN: 'Your account no longer has admin access.',
        /** Request hỏng từ client — CHƯA từng rời lớp validate, không đụng gì. */
        INVALID_INPUT:
          'The request was invalid and never reached the payment provider. Reload the page and try again.',
        /** Không biết đã đi tới đâu — câu này cố ý mập mờ đúng mức. */
        GENERIC:
          'The action did not confirm. Check the fresh data on this page before trying again — it may or may not have gone through.',
      },
    },
    // Vùng bookings (spec P4b §3-F1/F2) — bảng có filter/tìm kiếm/phân trang
    // trên URL, trang chi tiết, và refund (khối `refund` cuối khối này).
    bookings: {
      list: {
        filterLabel: 'Filter by status',
        all: 'All',
        /**
         * Ô tìm kiếm dùng NHÃN NỔI (`input-24`, user chốt 01/09), nên hai
         * chuỗi này chia nhau MỘT chỗ trong ô: `searchLabel` là thứ nhìn
         * thấy lúc nghỉ (không còn sr-only), `searchPlaceholder` chỉ hiện khi
         * ô được focus. Vì vậy label phải tự đứng được một mình — người ta
         * đọc nó TRƯỚC khi biết ô tìm được theo những gì.
         */
        searchLabel: 'Search bookings',
        searchPlaceholder: 'Code, name or email',
        empty: 'No bookings match these filters.',
        /**
         * Bảng rỗng khi ĐANG lọc theo ngày (mặc định là tháng hiện tại, user
         * chốt 04/09). Nói thẳng khoảng ngày ra: "không có kết quả" mà không
         * nói vì sao là cách nhanh nhất để người tra một booking cũ kết luận
         * nhầm rằng booking đó không tồn tại.
         */
        emptyInRange: (range: string) => `No bookings were created between ${range}.`,
        /** Khoảng MỘT đầu (xoá riêng một ô, hoặc khoảng ngược làm rớt `to`). */
        emptyFrom: (date: string) => `No bookings were created on or after ${date}.`,
        emptyTo: (date: string) => `No bookings were created on or before ${date}.`,
        /** Nút thoát ngay trong ô rỗng — một cú bấm về xem toàn bộ. */
        showAllDates: 'Show bookings from all dates',
        columns: {
          code: 'Code',
          tour: 'Tour',
          status: 'Status',
          guests: 'Guests',
          amount: 'Amount',
          customer: 'Customer',
        },
        /**
         * Bộ lọc khoảng ngày + nút export (spec P4b §3-F6). Ngày lọc theo
         * lúc booking được TẠO, và nói rõ điều đó: "từ ngày nào" của một
         * booking có thể là ngày đặt hoặc ngày khởi hành, hai thứ khác hẳn.
         */
        dateFilterLabel: 'Filter by booking date',
        /**
         * Ô ngày là ô CHỮ (kiểu `date-picker-04`), nên gợi ý trong ô phải
         * làm luôn việc thứ hai: nói ra dạng ngày mà ô đọc được. Đổi nó thì
         * đổi cả `formatDateLabel` — hai thứ này là một lời hứa.
         */
        /** Nút lịch nằm trong ô — không có chữ, chỉ máy đọc màn hình nghe. */
        /** Xuất ĐÚNG tập đang lọc, không phải trang đang xem. */
        exportCsv: 'Export CSV',
        /**
         * Nhãn nút khi ĐANG có hàng được tích (01/09). Nói rõ số hàng vì người
         * bấm phải biết mình sắp tải về cái gì TRƯỚC cú bấm — để nguyên
         * "Export CSV" trong lúc tích 3 hàng là một lời hứa mơ hồ về chính thứ
         * vừa được chọn.
         */
        exportSelected: (n: number) => `Export ${n} ${n === 1 ? 'row' : 'rows'}`,
        /**
         * Checkbox ở hàng tiêu đề. Nói "on this page" vì đó là SỰ THẬT chứ
         * không phải rào trước: phân trang là điều hướng thật nên tích không
         * sống qua trang. Hứa "select all" rồi mất sạch khi sang trang là nói
         * dối bằng nhãn.
         */
        selectAllRows: 'Select all rows on this page',
        selectRow: (code: string) => `Select booking ${code}`,
        /**
         * Tập lọc vượt trần xuất file. Câu này là BODY của một response
         * 413 — người bấm nút thấy nó thay cho file, nên nó phải nói được
         * việc cần làm tiếp theo mà không cần bất kỳ ngữ cảnh nào khác.
         */
        exportTooLarge: (total: number, max: number) =>
          `This filter matches ${total} bookings and the export is capped at ${max}. Narrow the date range or the status filter, then export again.`,
      },
      /**
       * Nhãn cột của file CSV (spec P4b §3-F6) — English như mọi copy
       * user-facing (luật 7), và tách khỏi `list.columns` vì file mang NHIỀU
       * cột hơn bảng: bảng gộp "2 adults, 1 child" cho mắt người, file tách
       * từng số cho công thức của Excel.
       *
       * Giá trị trong file là DỮ LIỆU chứ không phải chữ hiển thị: tiền là
       * '117.00' (không phải '$117.00' — Excel đọc ký hiệu tiền thành text),
       * ngày giờ là ISO UTC, trạng thái là chính member enum. Ai mở file cũng
       * lọc/tính được ngay.
       */
      csv: {
        code: 'Booking code',
        status: 'Status',
        tour: 'Tour',
        departureStart: 'Departure start',
        departureEnd: 'Departure end',
        adults: 'Adults',
        children: 'Children',
        guests: 'Guests',
        unitPrice: 'Price per person',
        totalAmount: 'Total amount',
        currency: 'Currency',
        customer: 'Customer',
        email: 'Email',
        phone: 'Phone',
        createdAt: 'Booked at (UTC)',
        paidAt: 'Paid at (UTC)',
        cancelledAt: 'Cancelled at (UTC)',
      },
      status: {
        PENDING: 'Pending',
        PAID: 'Paid',
        CANCELLED: 'Cancelled',
        REFUNDED: 'Refunded',
        PARTIALLY_REFUNDED: 'Partially refunded',
      },
      // Diễn giải đoàn khách dùng CHUNG `accountBookings.travellers` (một
      // nguồn cho mọi bề mặt in travellers của một booking — xem JSDoc bên
      // đó); khối `guests` riêng từng ở đây là bản chép thứ hai, đã xoá
      // (review F1 31/08).
      detail: {
        back: 'Back to bookings',
        empty: '—',
        booked: 'Booked',
        customer: {
          heading: 'Customer',
          name: 'Name',
          email: 'Email',
          phone: 'Phone',
          requests: 'Special requests',
        },
        departure: {
          heading: 'Departure',
          tour: 'Tour',
          dates: 'Dates',
          guests: 'Guests',
        },
        payment: {
          heading: 'Payment',
          provider: 'Provider',
          // "per person": API tính totalAmount = unitPrice × (adults + children)
          // (pricing.ts) — ghi "per adult" là bịa ra một phép nhân không khớp.
          unitPrice: 'Price per person',
          total: 'Total',
          paidAt: 'Paid at',
          cancelledAt: 'Cancelled at',
        },
        cancellations: {
          heading: 'Cancellation history',
          empty: 'No cancellation requests for this booking.',
          reason: 'Reason',
          note: 'Decision note',
          requested: 'Requested',
          decided: 'Decided',
          // Enum CancellationRequestStatus — lịch sử append-only nên một
          // booking có thể mang nhiều dòng DENIED trước dòng cuối. Nhãn dùng
          // CHUNG với hàng đợi `/cancellations` (hằng trên đầu file).
          status: CANCELLATION_STATUS_COPY,
        },
      },
      /**
       * Refund — hành vi GHI đầu tiên của admin (spec P4b §3-F2), money-path.
       *
       * Bất biến §2.4: SÁU mã lỗi của contract (NOT_FOUND + 5 mã ledger
       * 422/502) có SÁU câu riêng dưới `errors` — khối đó là NGUỒN duy nhất
       * của tập mã contract phía admin (`refund.ts` derive từ keys, không chép
       * danh sách lần hai). Không gộp, không nuốt thành "Something went wrong"
       * — người đọc là operator, và mỗi mã nói một chuyện khác nhau về việc
       * tiền đã đi hay chưa (đặc biệt REFUND_FAILED 502: provider từ chối,
       * ledger chưa ghi gì). Mã tầng vận chuyển (401/403/input hỏng/lỗi lạ)
       * KHÔNG ở đây — chúng dùng chung `admin.errors.write`.
       */
      refund: {
        heading: 'Refunds',
        cta: 'Issue refund',
        /** Trạng thái ngoài PAID/PARTIALLY_REFUNDED — nút không hiện, câu này thay chỗ. */
        /**
         * Nút refund bị ẩn vì đang có yêu cầu huỷ chờ xử lý (ADR-0029 §AMEND).
         * Nói RÕ đường đúng thay vì chỉ tắt nút — một nút biến mất không lý do
         * là một admin đi tìm cách khác, và cách khác ở đây là cái bẫy.
         */
        openCancellation:
          'This booking has a cancellation request awaiting review. Approve it from Cancellations instead — that refunds, cancels the booking and releases the seats in one step.',
        unavailable: 'Only a paid or partially refunded booking can be refunded.',
        form: {
          title: 'Issue a refund',
          body: 'Step 1 of 2 — choose how much goes back to the customer.',
          modeLabel: 'Amount',
          modeFull: 'Full remaining balance',
          modePartial: 'A specific amount',
          amountLabel: 'Amount to refund',
          /** Trần là phần CÒN HOÀN ĐƯỢC (total − đã hoàn) — `byCode` trả
           *  `refundedTotal` thật từ review F2 31/08, hết cảnh đoán theo total. */
          amountHint: (currency: string, remaining: string) =>
            `${currency} — up to the ${remaining} still refundable.`,
          reasonLabel: 'Reason (optional)',
          reasonPlaceholder: 'Included in the refund email to the customer.',
          cancel: 'Cancel',
          next: 'Review refund',
        },
        confirm: {
          title: 'Confirm this refund',
          body: 'Step 2 of 2 — check the amount before the money moves.',
          booking: 'Booking',
          customer: 'Customer',
          amount: 'Amount',
          /** Nhánh full: số tiền do server tính (total − đã hoàn), client không biết. */
          amountFull: 'Full remaining balance',
          reason: 'Reason',
          warning:
            'This calls the payment provider straight away and cannot be undone from the back office.',
          back: 'Back',
          submit: 'Refund now',
          submitting: 'Refunding…',
        },
        /** Lỗi validate phía client — bản sao luật contract, chặn trước khi
         *  bắn. `zero` cố ý là CÙNG câu với `errors.ZERO_OR_NEGATIVE` (một
         *  luật một câu, dù chặn ở client hay server) — xem hằng dưới cùng
         *  khối admin. */
        validation: {
          required: 'Enter an amount to refund.',
          format: 'Digits only, e.g. 120.50.',
          zero: REFUND_ZERO_COPY,
          overRemaining: (remaining: string) =>
            `Refund amount cannot exceed the ${remaining} still refundable on this booking.`,
        },
        /** CHỈ 6 mã contract của `admin.bookings.refund` — tập keys này là
         *  nguồn sự thật cho `REFUND_CONTRACT_CODES` phía admin. Mã transport
         *  ở `admin.errors.write`. */
        errors: {
          NOT_FOUND: 'This booking no longer exists. Reload the list.',
          NOT_REFUNDABLE:
            'This booking is not refundable — it needs a captured payment and a PAID or PARTIALLY REFUNDED status. Reload to see where it stands now.',
          OVER_TOTAL:
            'This amount plus the refunds already issued would go over the booking total. Refund the full remaining balance instead, or enter a smaller amount.',
          ZERO_OR_NEGATIVE: REFUND_ZERO_COPY,
          NOTHING_LEFT: 'This booking is already fully refunded — nothing is left to send back.',
          REFUND_FAILED:
            'The payment provider rejected the refund, so nothing was recorded. Check the provider dashboard before trying again.',
        },
        toast: {
          title: 'Refund issued',
          body: (amount: string) => `${amount} is on its way back to the customer.`,
        },
        /**
         * Sổ cái: từ review F2 31/08 `admin.bookings.byCode` TRẢ ledger thật
         * (`refunds` + `refundedTotal`), nên bảng in số từ DB ngay khi mở
         * trang — hai câu "giải thích endpoint thiếu gì" (onRecord/unknown)
         * đã bị xoá cùng lỗ dữ liệu sinh ra chúng.
         */
        ledger: {
          heading: 'Refund ledger',
          amount: 'Amount',
          issued: 'Issued',
          reference: 'Provider reference',
          total: (amount: string) => `${amount} refunded in total`,
          /** Bảng refund của booking này thật sự rỗng — số từ DB, không phải đoán. */
          none: 'No refunds on this booking.',
        },
      },
    },
    /**
     * Vùng cancellations (spec P4b §3-F3) — hàng đợi request của khách cộng
     * MỘT hành vi ghi: `admin.cancellations.decide` (approve/deny một cửa).
     *
     * Approve là money-path: refund phần còn lại + booking CANCELLED + nhả
     * ghế, tất cả nguyên tử trong một advisory lock (CancellationsService
     * .approve). Vì thế copy xác nhận phải NÓI ĐỦ ba hệ quả — admin bấm
     * "Approve" không được phép ngạc nhiên vì tiền đã đi.
     */
    cancellations: {
      list: {
        filterLabel: 'Filter by status',
        all: 'All',
        empty: 'No cancellation requests match this filter.',
        /**
         * Cột Decision của hàng đợi không còn hai nút tiền (user chốt 04/09):
         * một yêu cầu huỷ được quyết trên trang RIÊNG của nó, nơi nhìn đủ sổ
         * hoàn tiền, ngày khởi hành và số tiền — không phải từ một hàng bảng.
         */
        review: 'Review request',
        reviewFor: (code: string) => `Review the cancellation request for ${code}`,
        /**
         * Bộ lọc khoảng ngày (ADR-0028 §AMEND) — theo ngày khách GỬI yêu cầu,
         * nên chữ phải nói "requested", không phải "booked" như `/bookings`.
         */
        dateFilterLabel: 'Filter by request date',
        /**
         * Ô rỗng KHI ĐANG lọc ngày — nói thẳng khoảng đang lọc và mở sẵn lối
         * thoát. Ở đây rủi ro nhẹ hơn `/bookings` (vùng này mặc định không lọc
         * ngày) nhưng vẫn có thật khi admin đã đặt khoảng rồi đổi tab trạng
         * thái: bảng rỗng mà thủ phạm là hai ô ngày họ đặt từ lúc trước.
         */
        emptyInRange: (range: string) => `No cancellation requests were made between ${range}.`,
        emptyFrom: (date: string) => `No cancellation requests were made on or after ${date}.`,
        emptyTo: (date: string) => `No cancellation requests were made on or before ${date}.`,
        showAllDates: 'Show requests from all dates',
        columns: {
          booking: CANCELLATION_CONTEXT_COPY.booking,
          tour: CANCELLATION_CONTEXT_COPY.tour,
          customer: CANCELLATION_CONTEXT_COPY.customer,
          reason: 'Reason',
          status: 'Status',
          requested: 'Requested',
          /** Cột cuối: nút quyết định khi còn mở, dấu vết quyết định khi đã đóng. */
          decision: 'Decision',
        },
        decidedAt: (when: string) => `Decided ${when}`,
        note: (note: string) => `Note: ${note}`,
      },
      /** Nhãn enum dùng CHUNG với lịch sử trên trang chi tiết booking. */
      status: CANCELLATION_STATUS_COPY,
      /**
       * Quyết định — hành vi GHI thứ hai của admin. BỐN mã contract dưới
       * `errors` là NGUỒN duy nhất của tập mã phía admin
       * (`cancellations-decide.ts` derive từ keys, không chép danh sách lần
       * hai — nếp `REFUND_CONTRACT_CODES` của F2). Mã tầng vận chuyển
       * (401/403/input hỏng/lỗi lạ) KHÔNG ở đây: chúng dùng chung
       * `admin.errors.write`.
       */
      /**
       * Trang chi tiết RIÊNG của vùng huỷ — `/cancellations/[code]` (user chốt
       * 04/09: hai vùng hai route, dùng chung kiểu thiết kế). Các khối ngữ
       * cảnh mượn nguyên chữ của `bookings.detail`; ở đây chỉ khai phần mà
       * chỉ trang này có.
       */
      detail: {
        back: 'Back to cancellations',
        /** Khối quyết định — thay cho hai nút vốn nằm trong bảng. */
        heading: 'Decision',
        /** Còn mở: nói rõ đang chờ ai làm gì trước khi bày hai nút. */
        open: 'This request is awaiting your decision.',
        /**
         * Đã quyết rồi: trang vẫn mở được (hàng đợi có tab Denied/Approved),
         * nên phải nói rõ không còn gì để bấm — quyết định là chung cuộc.
         */
        closed: 'This request has already been decided — a decision is final.',
        /** Booking chưa từng có yêu cầu huỷ nào (URL gõ tay). */
        none: 'This booking has no cancellation request.',
      },
      decide: {
        approve: 'Approve',
        deny: 'Deny',
        /** Nhãn cho cụm nút của một hàng — trình đọc màn hình cần biết hàng nào. */
        actionsLabel: (code: string) => `Decide the cancellation request for ${code}`,
        // Ba nhãn ngữ cảnh dùng CHUNG với header cột (một khái niệm một chữ —
        // bài học travellers F1); riêng reason đổi giọng có chủ ý.
        booking: CANCELLATION_CONTEXT_COPY.booking,
        tour: CANCELLATION_CONTEXT_COPY.tour,
        customer: CANCELLATION_CONTEXT_COPY.customer,
        reason: 'Customer reason',
        /** Dòng số tiền trong dialog approve — con số THẬT từ queue (review F3). */
        refundAmount: 'Refund amount',
        noteLabel: 'Decision note (optional)',
        notePlaceholder: 'Included in the email to the customer.',
        cancel: 'Cancel',
        /**
         * Stepper approve (ADR-0029 §5): xem yêu cầu → đối chiếu chính sách →
         * chốt số tiền → xác nhận hệ quả. Bốn bước tồn tại vì approve là lệnh
         * MỘT LẦN và không đảo ngược được — mỗi bước phải nói ra một thứ mà
         * người bấm cần biết, chứ không phải bốn lần bấm Next.
         */
        approveWizard: {
          /** Nhãn trên thanh bước — một từ, đủ để biết mình đang đứng đâu. */
          steps: {
            request: 'Request',
            policy: 'Policy',
            amount: 'Amount',
            confirm: 'Confirm',
          },
          progress: (current: number, total: number) => `Step ${current} of ${total}`,
          back: 'Back',
          next: 'Continue',
          request: {
            heading: 'What the customer asked for',
            body: 'This is everything they sent. Read it before you decide.',
            requestedAt: 'Requested',
            departure: 'Departure',
            /** Bao lâu rồi chưa ai quyết — hàng đợi cũ là một lời hứa đang trễ. */
            waiting: (days: number) =>
              days <= 0
                ? 'Sent today.'
                : `Waiting ${days} ${days === 1 ? 'day' : 'days'} for a decision.`,
          },
          policy: {
            heading: 'What the refund schedule says',
            body: 'The schedule is fixed, and the customer saw this same figure when they sent the request.',
            daysLine: (days: number) =>
              days < 0
                ? 'The tour had already started when the request was sent.'
                : days === 0
                  ? 'The request was sent on the departure date.'
                  : `Sent ${days} ${days === 1 ? 'day' : 'days'} before departure.`,
            /** Bậc nào đang áp — nói ra để con số không trông như tuỳ hứng. */
            band: (percent: number) =>
              percent === 0
                ? 'That falls outside the refundable window.'
                : `That band refunds ${percent}% of what the customer paid.`,
            countedFrom: 'Days are counted from the date the request was sent, not today.',
            grace:
              'Sent within 24 hours of payment, so the full amount is refundable whatever the schedule would otherwise say.',
            badge: (days: number) =>
              `This tour advertises free cancellation up to ${days} days before departure, which raises the refund to the full amount.`,
            alreadyRefunded: (amount: string) =>
              `${amount} has already been refunded on this booking, and is deducted from the figure below.`,
            result: 'Policy refund',
            resultValue: (percent: number, amount: string) =>
              `${amount} · ${percent}% of the total`,
          },
          amount: {
            heading: 'How much to refund',
            policyOption: 'Refund the policy amount',
            overrideOption: 'Refund a different amount',
            overrideHint: 'You will have to record why on the next step.',
            overrideLabel: 'Amount to refund',
            remainingHint: (amount: string) => `Up to ${amount} can still be refunded.`,
            /**
             * Câu quan trọng nhất của cả dialog. Approve chạy MỘT lần: nó đóng
             * request, huỷ booking và nhả ghế, và sau đó back-office không còn
             * đường hoàn nốt phần dư (ADR-0029 §AMEND 2).
             */
            onceWarning:
              'Approving happens once. Whatever you set here is the whole refund for this booking — the rest cannot be refunded from the back office afterwards.',
            zeroNotice:
              'There is nothing left to refund. Approving still closes the request, cancels the booking and releases the seats.',
          },
          confirm: {
            heading: 'Approve this cancellation',
            refundLine: 'Refund now',
            /** Số tiền khác bậc — nhãn để người duyệt sau đọc hồ sơ hiểu ngay. */
            overrideBadge: (amount: string) => `Off-policy — the schedule gives ${amount}.`,
            noteLabelRequired: 'Why this amount',
            noteRequired: 'Record why you are refunding an off-policy amount.',
          },
        },
        approveDialog: {
          title: 'Approve this cancellation?',
          body: 'Approving runs all three changes below in one go, straight away.',
          /** Ba hệ quả của nhánh approve — đọc từ summary contract + service. */
          consequences: {
            /**
             * Nói SỐ TIỀN THẬT sắp chuyển, không phải "phần còn lại": từ
             * ADR-0029 §1 approve hoàn theo bậc chính sách, nên câu cũ
             * ("the full remaining balance") sai ở mọi ca hoàn một phần.
             */
            refund: (amount: string) =>
              `Refunds ${amount} to the customer through the payment provider.`,
            cancelled: 'Marks the booking as cancelled.',
            seats: 'Releases the seats back to the departure.',
          },
          warning:
            'The refund cannot be undone from the back office, and the decision is final — the customer would have to book again.',
          submit: 'Approve and refund',
          submitting: 'Approving…',
        },
        denyDialog: {
          title: 'Deny this cancellation?',
          body: 'Denying closes the request and emails the customer. The booking is left exactly as it is — no refund, no seats released.',
          warning:
            'The decision is final: the customer has to send a new request to be reviewed again.',
          submit: 'Deny request',
          submitting: 'Denying…',
        },
        /** Ba mã đầu là lỗi TRẠNG-THÁI-CŨ: UI đóng dialog + toast + tự refresh
         *  queue (review F3 31/08 — copy từng bảo "reload" mà UI không làm);
         *  REFUND_FAILED là lỗi retryable duy nhất nên ở lại dialog. */
        errors: {
          NOT_FOUND:
            'This cancellation request no longer exists. The queue below has been refreshed.',
          ALREADY_DECIDED:
            'This request was already decided — a decision is final. The queue below has been refreshed with the outcome.',
          /**
           * ADR-0029 §2 đã gỡ ca "đã hoàn đủ" khỏi mã này — approve nay CHẠY
           * ĐƯỢC trên booking đã settle. Câu cũ dặn admin "deny nó thay vào
           * đó", lời dặn ấy nay sai và đã bỏ. Còn lại đúng nghĩa hẹp: payment
           * chưa capture, tức không có gì để hoàn qua provider.
           */
          NOT_REFUNDABLE:
            'This booking has no captured payment to refund against, so it cannot be approved. The queue has been refreshed — open the booking to check what happened.',
          /**
           * Hai mã tiền, chỉ với tới được từ ADR-0029 §1 khi approve bắt đầu
           * nhận số tiền. Chúng nói về CON SỐ vừa gửi chứ không về trạng thái
           * booking, nên request vẫn còn nguyên và sửa tại chỗ được — khác
           * nhóm "trạng thái cũ" phải refresh hàng đợi.
           */
          OVER_TOTAL:
            'That amount is more than this booking still has left to refund. Check the refund ledger and try a smaller amount.',
          ZERO_OR_NEGATIVE:
            'A refund has to be greater than zero. To approve without moving any money, the booking must already be fully refunded.',
          REFUND_FAILED:
            'The payment provider rejected the refund, so nothing changed and the request is still awaiting review. Check the provider dashboard before trying again.',
        },
        toast: {
          approvedTitle: 'Cancellation approved',
          approvedBody: (code: string) =>
            `${code} is cancelled and the remaining balance is on its way back.`,
          deniedTitle: 'Cancellation denied',
          deniedBody: (code: string) => `${code} is unchanged and the customer has been told.`,
        },
      },
    },
    /**
     * Vùng enquiries (spec P4c §3-F9) — CRM nhỏ trên form "Inquire Now" công
     * khai, cộng HAI hành vi ghi: `setStatus` (đổi trạng thái, nối một dòng
     * audit) và `addNote` (nối một note vào thread append-only).
     *
     * Hai luật copy của vùng này:
     * - Dialog đổi trạng thái phải NÊU RÕ `from → to` (spec §3-F9): chuyển
     *   là tự do giữa năm giá trị nên không có luật máy nào chặn nhầm — câu
     *   chữ là lớp bảo vệ duy nhất trước một cú bấm nhầm hàng.
     * - Thread note nói thẳng là KHÔNG SỬA, KHÔNG XOÁ trước khi người ta gõ,
     *   không phải sau khi đã gửi.
     *
     * Mã contract nằm dưới `setStatus.errors` / `addNote.errors` — NGUỒN duy
     * nhất của tập mã phía admin (`enquiries-write.ts` derive từ keys).
     */
    enquiries: {
      list: {
        filterLabel: 'Filter by status',
        all: 'All',
        searchLabel: 'Search enquiries',
        /** Khớp `name` HOẶC `email` — hai thứ operator cầm khi khách gọi lại. */
        searchPlaceholder: 'Name or email',
        empty: 'No enquiries match this filter.',
        columns: {
          name: 'Name',
          email: 'Email',
          tour: 'Tour',
          travelDate: 'Travel date',
          group: 'Group',
          status: 'Status',
          notes: 'Notes',
          created: 'Created',
        },
        /** Enquiry chung (không gắn tour) hoặc tour đã bị xoá. */
        noTour: 'General enquiry',
        /** Số khách khách tự khai — null khi form bỏ trống. */
        groupSize: (size: number) => (size === 1 ? '1 traveller' : `${size} travellers`),
        /** Đếm note của hàng — 0 nghĩa là chưa ai chạm vào lead này. */
        notesCount: (count: number) => (count === 1 ? '1 note' : `${count} notes`),
        /**
         * Chip lọc theo tour. KHÔNG có Select trên toolbar (quyết định tự
         * chọn F9 — chưa có endpoint list tour cho admin tới P4e), nhưng
         * `?tourId=` gõ tay/đi từ trang khác vẫn lọc thật, nên phải có một
         * chỗ NHÌN THẤY và gỡ được: một filter vô hình là một bảng "thiếu
         * hàng" không giải thích được. Chữ CỐ ĐỊNH (vòng vá review F9): tên
         * tour từng suy từ hàng đầu của trang nên đổi theo tab — nhãn của
         * một filter không được là hàm của tập kết quả.
         */
        tourFilter: 'Filtered by tour',
        tourFilterClear: 'Clear tour filter',
        viewLabel: (name: string) => `Open the enquiry from ${name}`,
      },
      /** Nhãn enum EnquiryStatus — `Record` đủ member để thêm trạng thái là đỏ typecheck. */
      status: {
        NEW: 'New',
        CONTACTED: 'Contacted',
        QUOTED: 'Quoted',
        WON: 'Won',
        LOST: 'Lost',
      },
      detail: {
        back: 'Back to enquiries',
        /** Nhãn dưới tên lead trên đầu trang. */
        received: 'Received',
        updated: 'Last touched',
        lead: {
          heading: 'Lead',
          email: 'Email',
          phone: 'Phone',
          nationality: 'Nationality',
          tour: 'Tour',
          travelDate: 'Travel date',
          groupSize: 'Group size',
          budgetTier: 'Budget',
          interests: 'Interests',
        },
        message: {
          heading: 'Message',
        },
        notes: {
          heading: 'Internal notes',
          /** Nói TRƯỚC khi người ta gõ, không phải sau khi đã gửi. */
          hint: 'Notes are internal, permanent and visible to every admin — they cannot be edited or deleted.',
          empty: 'No notes yet. The first one is below.',
          label: 'Add a note',
          placeholder: 'What happened on this lead?',
          /** "1840 / 2000" — trần đọc từ contract, không viết cứng. */
          counter: (used: number, max: number) => `${used} / ${max}`,
          submit: 'Add note',
          submitting: 'Adding…',
          /** Nút bị khoá khi ô rỗng — câu này giải thích vì sao. */
          emptyHint: 'Write something first.',
          by: (author: string) => `by ${author}`,
        },
        history: {
          heading: 'Status history',
          empty: 'This enquiry has never changed status.',
          /** Một dòng audit: "New → Contacted". */
          change: (from: string, to: string) => `${from} → ${to}`,
          by: (admin: string) => `by ${admin}`,
          /** `adminId` SetNull — tài khoản đã bị xoá, dòng audit vẫn còn. */
          unknownAdmin: 'by a removed account',
        },
      },
      setStatus: {
        heading: 'Status',
        /** Nhãn ô Select trên trang chi tiết (sr-only — chữ trong ô đã tự nói). */
        label: 'Move this enquiry to',
        action: 'Update status',
        cancel: 'Cancel',
        lead: 'Lead',
        from: 'From',
        to: 'To',
        dialog: {
          title: 'Change the status of this enquiry?',
          body: 'The move is recorded in the status history with your name and the time.',
          /** Ba hệ quả — đọc từ summary contract + JSDoc service. */
          consequences: {
            audit: 'Adds one line to the status history — that line cannot be edited or removed.',
            stats: 'Moving to Won counts towards the "Won" figure for this period.',
            free: 'Any status can move to any other — there is no fixed order to follow.',
          },
          warning:
            'The status history is append-only: a wrong move stays on the record and has to be corrected with another move.',
          submit: 'Change status',
          submitting: 'Changing…',
        },
        /** Mã CONTRACT của `admin.enquiries.setStatus` — trạng-thái-cũ: đóng dialog + refresh. */
        errors: {
          NOT_FOUND:
            'This enquiry no longer exists — it may have been removed. The page has been refreshed.',
        },
        toast: {
          title: 'Status updated',
          body: (name: string, status: string) => `${name} is now ${status}.`,
          /**
           * NO-OP (`changed = false`, vòng vá review F9): lead đã ở trạng thái
           * đó — thường là tab cũ, người khác đã đổi trước. Không nói "updated"
           * cho một cú bấm không để lại dòng audit nào.
           */
          unchangedTitle: 'No change made',
          unchanged: (name: string, status: string) =>
            `${name} was already ${status} — someone may have moved it before you. The page has been refreshed.`,
        },
      },
      addNote: {
        /** Mã CONTRACT của `admin.enquiries.addNote`. */
        errors: {
          NOT_FOUND:
            'This enquiry no longer exists — it may have been removed, and the note was not saved.',
        },
        toast: {
          title: 'Note added',
          body: 'The note is now part of this enquiry’s thread.',
        },
      },
    },
    /**
     * Vùng subscribers (spec P4c §3-F10) — danh sách nhận tin mà form footer
     * CÔNG KHAI của web ghi vào, cộng MỘT hành vi ghi: gỡ một địa chỉ khỏi
     * danh sách THAY khách.
     *
     * Giọng của cả khối phải nhớ một điều: hàng ở đây là NGƯỜI đã đồng ý
     * nhận thư, và lệnh ghi là rút lại sự đồng ý ấy. Nên copy nói "leave the
     * list" chứ không phải "delete", và dialog nêu thẳng chuyện admin KHÔNG
     * đăng ký lại hộ được — chỉ chính chủ hộp thư mới làm được, bằng link
     * trong email của họ. HAI mã contract dưới `unsubscribe.errors` là NGUỒN
     * duy nhất của tập mã phía admin (`subscribers-unsubscribe.ts` derive từ
     * keys).
     */
    subscribers: {
      list: {
        filterLabel: 'Filter by status',
        /**
         * Ba tab = ba trạng thái của cờ `active` ở contract. "All" tồn tại vì
         * nó là cách DUY NHẤT thấy trọn lịch sử một địa chỉ trên một màn hình
         * — và là tập mà nút Export dựng file "cả danh sách".
         */
        all: 'All',
        active: 'Active',
        unsubscribed: 'Unsubscribed',
        searchLabel: 'Search subscribers',
        /** Chỉ khớp email — bảng này không có cột chữ nào khác để tìm. */
        searchPlaceholder: 'Email address',
        empty: 'No subscribers match this filter.',
        columns: {
          email: 'Email',
          source: 'Source',
          subscribed: 'Subscribed at',
          unsubscribed: 'Unsubscribed at',
          actions: 'Actions',
        },
        /**
         * Hàng không khai nguồn — hình dạng của MỌI hàng thật hôm nay (form
         * footer gọi `subscribe({email})` không kèm `source`). Nói "Direct
         * sign-up" chứ không để ô trống: ô trống đọc thành "dữ liệu bị mất",
         * còn đây là một sự thật bình thường.
         */
        noSource: 'Direct sign-up',
        /** Hàng còn nhận tin — cột "Unsubscribed at" chưa có gì để in. */
        stillSubscribed: 'Still subscribed',
        sourceLabel: 'Filter by source',
        sourceAll: 'All sources',
        /**
         * Xuất ĐÚNG tập đang lọc (cả ba tab), không phải trang đang xem —
         * cùng lời hứa với nút Export của `/bookings`.
         */
        exportCsv: 'Export CSV',
        /**
         * BODY của một response 413 — người bấm nút thấy nó thay cho file,
         * nên nó phải nói được việc cần làm tiếp theo mà không cần ngữ cảnh
         * nào khác.
         */
        exportTooLarge: (total: number, max: number) =>
          `This filter matches ${total} subscribers and the export is capped at ${max}. Narrow it with the status tabs, the source filter or the email search, then export again.`,
      },
      /**
       * Nhãn cột của file CSV. Giá trị trong file là DỮ LIỆU chứ không phải
       * chữ hiển thị: mốc thời gian là ISO UTC, và ô trống là ô TRỐNG (không
       * phải "Direct sign-up"/"Still subscribed" — hai câu đó nấu cho mắt
       * người và sẽ phá lọc/pivot của người mở file).
       */
      csv: {
        email: 'Email',
        source: 'Source',
        subscribedAt: 'Subscribed at (UTC)',
        unsubscribedAt: 'Unsubscribed at (UTC)',
      },
      unsubscribe: {
        action: 'Unsubscribe',
        actionLabel: (email: string) => `Unsubscribe ${email}`,
        email: 'Email',
        source: 'Source',
        subscribed: 'Subscribed',
        cancel: 'Cancel',
        dialog: {
          title: 'Remove this address from the newsletter?',
          body: 'Do this when the person asked you to — by reply, by phone — and could not use the unsubscribe link in their email.',
          /** Ba hệ quả — đọc từ summary contract + JSDoc service. */
          consequences: {
            stops: 'Stops every newsletter to this address from the next send on.',
            kept: 'The address stays on record with the date it left — nothing is deleted.',
            /** Lý do KHÔNG có nút "resubscribe" ở back-office này. */
            oneWay:
              'You cannot sign them back up: only they can, from the link in an email they already have.',
          },
          warning:
            'Check the address below before you confirm — this is the wrong one to get wrong, and undoing it is not yours to do.',
          submit: 'Unsubscribe',
          submitting: 'Removing…',
        },
        /** Cả hai là lỗi TRẠNG-THÁI-CŨ: UI đóng dialog + toast + refresh bảng. */
        errors: {
          NOT_FOUND:
            'This address is no longer on the list — the record may have been removed. The list below has been refreshed.',
          ALREADY_UNSUBSCRIBED:
            'This address had already left the newsletter — its original opt-out date has been kept. The list below has been refreshed.',
        },
        toast: {
          title: 'Address unsubscribed',
          /**
           * Kể lại DÒNG VỪA GHI, không chỉ "xong": mốc rút consent là thứ duy
           * nhất lệnh này tạo ra và là thứ phải chỉ được vào khi có ai hỏi
           * ngày nào địa chỉ ấy rời danh sách. Email đọc từ hàng admin vừa
           * bấm (response cố ý không chở PII về — xem contract).
           */
          body: (email: string, at: string) => `${email} left the newsletter on ${at}.`,
        },
      },
    },
    /**
     * Vùng outbox (spec P4c §3-F7) — hàng đợi email mà worker drain mỗi phút,
     * cộng MỘT hành vi ghi: `admin.outbox.retry` (đưa hàng FAILED về hàng đợi).
     *
     * Retry KHÔNG gửi email ngay: nó chỉ đặt lại trạng thái, worker nhặt ở
     * lượt kế (~1 phút). Copy xác nhận phải nói đúng chuyện đó — và nói cả
     * hệ quả nếu nguyên nhân gốc (key provider hỏng…) chưa được sửa: hàng sẽ
     * lại FAILED sau đủ số lần thử. HAI mã contract dưới `retry.errors` là
     * NGUỒN duy nhất của tập mã phía admin (`outbox-retry.ts` derive từ keys).
     */
    outbox: {
      list: {
        filterLabel: 'Filter by status',
        all: 'All',
        typeLabel: 'Filter by email type',
        typeAll: 'All types',
        searchLabel: 'Search outbox',
        /**
         * Tìm trên mã booking/email trong payload VÀ dedupeKey (vòng vá review
         * F7: dedupeKey thật là `<event>:<uuid>`, không mang mã BK-… — thứ
         * operator đang cầm nằm trong payload).
         */
        searchPlaceholder: 'Booking code, email or dedupe key',
        empty: 'No outbox rows match this filter.',
        columns: {
          type: 'Type',
          recipient: 'Recipient',
          status: 'Status',
          attempts: 'Attempts',
          lastError: 'Last error',
          created: 'Created',
          processed: 'Processed',
          actions: 'Actions',
        },
        /** "3/5" — số lần đã thử trên trần của worker (`OUTBOX_MAX_ATTEMPTS`). */
        attempts: (used: number, max: number) => `${used}/${max}`,
        /** Hàng SENT: attempts là số lần HỎNG trước khi đi được. 0 = đi ngay lần đầu. */
        sentFirstTry: 'First try',
        sentAfterRetries: (failed: number) =>
          failed === 1 ? 'After 1 failed try' : `After ${failed} failed tries`,
        /**
         * Retry đặt attempts về 0 nhưng GIỮ lastError — đó là dấu vết duy nhất
         * rằng row từng được xếp lại (vòng vá review F7). Hai nhãn này đọc dấu
         * vết ấy thay vì nói dối "First try"/"0/5".
         */
        sentAfterRetry: 'Sent after a manual retry',
        requeued: 'Re-queued by an operator',
        /** SKIPPED: worker cố ý không gửi — người nhận đã huỷ đăng ký. */
        skipped: 'Not sent — recipient unsubscribed',
        /** Payload không có `to`/`email` — hiện chữ thay vì ô trống trơn. */
        noRecipient: 'No recipient in payload',
        view: 'Details',
        viewLabel: (key: string) => `View details of ${key}`,
      },
      /** Nhãn enum OutboxStatus — PENDING đọc là "đang xếp hàng", không phải "chờ duyệt". */
      status: {
        PENDING: 'Queued',
        SENT: 'Sent',
        FAILED: 'Failed',
        SKIPPED: 'Skipped',
      },
      /** Nhãn enum EmailType — `Record` đủ member để thêm loại email mới là đỏ typecheck. */
      type: {
        BOOKING_CONFIRMATION: 'Booking confirmation',
        BOOKING_REFUNDED: 'Booking refunded',
        REVIEW_APPROVED: 'Review approved',
        REVIEW_REJECTED: 'Review rejected',
        ENQUIRY_RECEIVED: 'Enquiry received',
        ENQUIRY_ADMIN_ALERT: 'Enquiry alert (team)',
        CANCELLATION_REQUESTED: 'Cancellation requested',
        CANCELLATION_APPROVED: 'Cancellation approved',
        CANCELLATION_DENIED: 'Cancellation denied',
        NEWSLETTER_WELCOME: 'Newsletter welcome',
        EMAIL_CHANGED: 'Email changed',
        PASSWORD_RESET: 'Password reset',
        EMAIL_VERIFICATION: 'Email verification',
        EMAIL_OTP: 'Email verification code',
      },
      /** Drawer chi tiết một hàng: payload JSON nguyên văn + lỗi đầy đủ. */
      detail: {
        title: 'Outbox row',
        description: (key: string) => `Dedupe key ${key}`,
        type: 'Type',
        recipient: 'Recipient',
        status: 'Status',
        attempts: 'Attempts',
        created: 'Created',
        processed: 'Processed',
        lastError: 'Last error',
        noError: 'No error recorded.',
        /** Cùng lý do "Provider payload" đổi tên (user báo 03/09). */
        payload: 'Email contents',
      },
      retry: {
        action: 'Retry',
        actionLabel: (key: string) => `Retry ${key}`,
        type: 'Type',
        recipient: 'Recipient',
        dedupeKey: 'Dedupe key',
        lastError: 'Last error',
        cancel: 'Cancel',
        dialog: {
          title: 'Retry this email?',
          body: 'The row goes back to the queue exactly as it is — same recipient, same content.',
          /** Ba hệ quả — đọc từ summary contract + JSDoc service. */
          consequences: {
            requeue: 'Moves the row back to the queue and resets its attempts to 0.',
            worker: 'The worker picks it up on its next run, within about a minute.',
            lastError: 'The last error stays on the row until the new attempt overwrites it.',
          },
          warning: (max: number) =>
            `If the cause (for example the email provider key) is not fixed yet, the retry fails again and the row is parked after ${max} attempts.`,
          submit: 'Retry now',
          submitting: 'Retrying…',
        },
        /** Cả hai là lỗi TRẠNG-THÁI-CŨ: UI đóng dialog + toast + refresh bảng. */
        errors: {
          NOT_FOUND:
            'This outbox row no longer exists — it may have been purged. The list below has been refreshed.',
          NOT_FAILED:
            'This row is no longer marked as failed — it may already be back in the queue or sent. The list below has been refreshed.',
        },
        toast: {
          title: 'Email re-queued',
          body: (key: string) =>
            `${key} is back in the queue — the worker sends it within about a minute.`,
        },
      },
    },
    /**
     * Vùng payment events (spec P4c §3-F8) — sổ webhook Stripe/PayPal, HOÀN
     * TOÀN đọc: không dialog, không mã lỗi ghi. Drawer gọi `byId` khi mở
     * (list không mang payload) nên có ba trạng thái tải; `NOT_FOUND` là mã
     * contract duy nhất — row không xoá được từ admin, chỉ biến mất nếu có
     * ai dọn DB tay.
     */
    paymentEvents: {
      list: {
        filterLabel: 'Filter by provider',
        all: 'All providers',
        typeLabel: 'Filter by event type',
        typeAll: 'All types',
        searchLabel: 'Search payment events',
        /** Khớp `eventId` — thứ operator dán từ dashboard Stripe/PayPal. */
        searchPlaceholder: 'Provider event id',
        /** Toggle URL `?unprocessed=true` — "chỉ hàng chưa xong", không phải "trạng thái". */
        unprocessedOnly: 'Unprocessed only',
        empty: 'No payment events match this filter.',
        columns: {
          provider: 'Provider',
          type: 'Type',
          amount: 'Amount',
          booking: 'Booking',
          received: 'Received',
          processed: 'Processed',
          actions: 'Actions',
        },
        /** Event không gắn booking (hoặc booking không còn) — chữ thay ô trống. */
        noBooking: 'Not linked',
        /** Badge ở cột Processed khi `processedAt` null. */
        unprocessed: 'Unprocessed',
        /**
         * Tooltip của badge — nghĩa CHÍNH XÁC của `processedAt` null theo
         * `PaymentsService.beginEvent`: đã ghi sổ, handler chưa chạy xong,
         * lượt retry của provider sẽ chạy lại (idempotent cấp booking).
         * Chỉ đi qua `TooltipContent` (vòng vá review F8: bản đầu đặt thêm
         * `title` cùng chuỗi → trình đọc màn hình đọc hai lần, hover hiện
         * hai bong bóng).
         */
        unprocessedHint:
          'Received and recorded, but the handler has not finished — the provider will retry this delivery.',
        view: 'Details',
        viewLabel: (eventId: string) => `View details of ${eventId}`,
      },
      /** Nhãn enum PaymentProvider — `Record` đủ member để thêm provider là đỏ typecheck. */
      provider: {
        STRIPE: 'Stripe',
        PAYPAL: 'PayPal',
      },
      /**
       * Nhãn bốn type trung lập của gateway (`PAYMENT_EVENT_TYPES`). Cột DB là
       * chuỗi tự do nên VM rơi về chuỗi thô khi gặp type lạ — không có nhãn
       * "Unknown" ở đây vì chuỗi thô ("payment.chargeback") nói nhiều hơn.
       */
      type: {
        'payment.completed': 'Payment completed',
        'payment.failed': 'Payment failed',
        'payment.expired': 'Checkout expired',
        other: 'Other',
      },
      /** Drawer chi tiết: field bảng + payload provider nguyên văn (đã redact credential). */
      detail: {
        title: 'Payment event',
        description: (eventId: string) => `Event ${eventId}`,
        provider: 'Provider',
        type: 'Type',
        amount: 'Amount',
        booking: 'Booking',
        received: 'Received',
        processed: 'Processed',
        /**
         * Tiêu đề khối payload. "Provider payload" cũ là chữ kỹ thuật — user
         * báo 03/09 là người không đọc code không hiểu; câu này nói thẳng nó
         * là cái gì.
         */
        payload: 'What the payment provider sent',
        loading: 'Loading payload…',
        /**
         * Tên đời thường cho trường của Stripe/PayPal, dùng ở chế độ xem
         * Simple (user chốt 03/09, phương án B sau bản demo). Payload ở vùng
         * này là NGUYÊN VĂN webhook, nên cột trái vốn là tên trường do provider
         * đặt — `amount_total`, `client_reference_id` — thứ chỉ người biết code
         * mới đọc ra.
         *
         * Vì sao ở đây LÀ từ điển được, trong khi payload của `/outbox` cố ý
         * KHÔNG có: tên trường này do người khác sở hữu, ta không thêm bớt, và
         * nó chỉ đổi khi provider đổi API — không mục theo tính năng của mình.
         * Trường lạ vẫn rơi êm về cách đọc bằng máy nên bảng này thiếu cũng
         * không gãy gì.
         *
         * Khoá có DẤU CHẤM là đường dẫn đầy đủ và được tra TRƯỚC (xem
         * `PayloadHints`): cần thế vì sau khi cắt khúc bao bì `data.object`
         * thì `id` của sự kiện và `id` của phiên checkout đọc ra cùng một chữ.
         */
        payloadFields: {
          // KHOÁ LÀ ĐƯỜNG DẪN ĐẦY ĐỦ (vòng vá review polish 2): khoá trần áp ở
          // mọi độ sâu nên nhãn sai loại đối tượng — mỗi dòng ở đây kiểm được
          // bằng mắt trên một webhook mẫu. Nhãn trung lập cho `data.object`: nó
          // là Session ở checkout.session.* nhưng là PaymentIntent/Charge ở
          // event khác — sổ webhook nhận gì ghi nấy.
          // ── Stripe: tầng ngoài của event ──
          id: 'Event reference',
          object: 'Kind',
          type: 'Event',
          created: 'Received at',
          livemode: 'Live mode',
          api_version: 'Provider API version',
          pending_webhooks: 'Deliveries still queued',
          // ── Stripe: `data.object` (sau khi cắt bao bì) ──
          'data.object.id': 'Object reference',
          'data.object.object': 'Kind',
          'data.object.status': 'Status',
          'data.object.amount_total': 'Amount charged',
          'data.object.currency': 'Currency',
          'data.object.payment_status': 'Payment status',
          'data.object.payment_intent': 'Payment reference',
          'data.object.client_reference_id': 'Our reference',
          'data.object.expires_at': 'Link expires',
          'data.object.customer_details': 'Customer',
          'data.object.customer_details.email': 'Email',
          'data.object.metadata': 'Our notes',
          'data.object.metadata.bookingId': 'Booking id',
          'data.object.metadata.bookingCode': 'Booking code',
          // ── PayPal: tầng ngoài ──
          event_type: 'Event',
          create_time: 'Received at',
          resource_type: 'Kind',
          summary: 'Summary',
          // ── PayPal: `resource` (sau khi cắt bao bì) ──
          'resource.id': 'Object reference',
          'resource.status': 'Status',
          'resource.custom_id': 'Booking id',
          'resource.purchase_units': 'Items paid for',
          'resource.amount': 'Amount charged',
          'resource.amount.value': 'Amount',
          'resource.amount.currency_code': 'Currency',
          'resource.payer': 'Customer',
          'resource.payer.email_address': 'Email',
          links: 'Provider links',
        },
        /**
         * Mã CONTRACT của `admin.paymentEvents.byId` — CHỈ mã contract ở
         * khối này (codec derive tập mã từ khoá, test đối chiếu `errorMap`).
         */
        errors: {
          NOT_FOUND: 'This payment event no longer exists — the list may be out of date.',
        },
        /**
         * Câu transport giọng ĐỌC, không mượn `errors.write` (câu đó cố ý
         * mập mờ "có thể đã đi qua" vì nói về hành vi ghi; ở đây không có gì
         * để lỡ đi qua). Tách khỏi `errors` để tập mã contract không lẫn mã
         * transport (vòng vá review F8).
         */
        transportErrors: {
          UNAUTHORIZED: 'Your session has expired. Sign in again to load the payload.',
          FORBIDDEN: 'Your account no longer has admin access.',
          GENERIC: 'The payload could not be loaded. Close the panel and try again.',
        },
      },
    },
    /**
     * Vùng reviews (spec P4b §3-F4) — hàng đợi moderation cộng MỘT hành vi
     * ghi: `admin.reviews.moderate` (approve/reject/unpublish một cửa).
     *
     * Moderate là transaction 4-TRONG-1 (`ReviewsService.moderate`): flip
     * trạng thái + audit trail + recompute rating tour + enqueue email cho
     * khách. HAI hệ quả sau CÓ ĐIỀU KIỆN — rating chỉ đổi khi review gắn
     * tour, email chỉ gửi ở lần false→true và chỉ khi sau review có một tài
     * khoản thật — nên dưới `consequences` có cả câu cho ca KHÔNG xảy ra;
     * dialog chọn câu theo đúng hàng đang mở (`moderateConsequences`, thuần,
     * có test). Hứa suông "khách sẽ nhận email" cho một review CURATED là
     * nói dối chính operator đang bấm nút.
     */
    reviews: {
      list: {
        filterLabel: 'Filter by state',
        all: 'All',
        /** Nhãn nổi + gợi ý-khi-focus — cùng luật với `bookings.list`. */
        searchLabel: 'Search reviews',
        searchPlaceholder: 'Text, title or author',
        empty: 'No reviews match these filters.',
        /**
         * Bộ lọc khoảng ngày (ADR-0028 §AMEND 2) — theo ngày review được GỬI,
         * nên chữ nói "submitted". KHÔNG phải ngày duyệt: review chưa duyệt có
         * `moderatedAt` null, lọc cột ấy là quét sạch hàng đợi khỏi bảng.
         */
        /**
         * Lọc theo NGUỒN (`AdminReviewsQuerySchema.source`). Nhãn từng mục
         * KHÔNG khai ở đây — chúng mượn `admin.reviews.source` mà cột State
         * của bảng đang dùng: một khái niệm thì một chữ, kẻo bộ lọc dạy admin
         * một bảng chữ cái còn bảng dạy một bảng khác.
         */
        sourceLabel: 'Filter by source',
        sourceAll: 'All sources',
        /**
         * Lọc theo SỐ SAO. Tên `ratingFilterLabel` chứ không `ratingLabel` —
         * khoá ấy đã có ở khối này và mang câu cho trình đọc màn hình
         * ("4 out of 5 stars"); hai thứ khác nhau, hai tên khác nhau.
         */
        ratingFilterLabel: 'Filter by rating',
        ratingAll: 'All ratings',
        ratingStars: (count: number) => `${count} ${count === 1 ? 'star' : 'stars'}`,
        dateFilterLabel: 'Filter by submitted date',
        /**
         * Ô rỗng KHI ĐANG lọc ngày — nói thẳng khoảng đang lọc và mở sẵn lối
         * thoát, cùng nếp hai vùng trước. Ở hàng đợi kiểm duyệt chuyện này
         * đáng nói hơn: một bảng rỗng dễ bị đọc thành "đã dọn sạch", trong khi
         * thủ phạm chỉ là hai ô ngày đặt từ lúc trước.
         */
        emptyInRange: (range: string) => `No reviews were submitted between ${range}.`,
        emptyFrom: (date: string) => `No reviews were submitted on or after ${date}.`,
        emptyTo: (date: string) => `No reviews were submitted on or before ${date}.`,
        showAllDates: 'Show reviews from all dates',
        columns: {
          review: REVIEW_CONTEXT_COPY.review,
          rating: REVIEW_CONTEXT_COPY.rating,
          tour: REVIEW_CONTEXT_COPY.tour,
          author: REVIEW_CONTEXT_COPY.author,
          state: 'State',
          submitted: 'Submitted',
          /** Cột cuối: nút duyệt/bỏ duyệt + dấu vết lần quyết định gần nhất. */
          moderation: 'Moderation',
        },
        /** Tác giả đã xoá tài khoản (`authorName` về null): review Ở LẠI vì
         *  nó là đánh giá thật, chỉ danh tính biến mất — cùng chữ với web. */
        deletedAuthor: DELETED_ACCOUNT_COPY,
        /** Cụm sao đọc thành MỘT câu cho trình đọc màn hình — cùng câu với web. */
        ratingLabel: RATING_LABEL_COPY,
        /** Ảnh khách đính kèm (ADR-0021) — thumbnail đứng ngay cạnh chữ. */
        photos: (count: number) => `${count} ${count === 1 ? 'photo' : 'photos'}`,
        /** Review CURATED có thể không gắn tour nào (`tourSlug` null). */
        noTour: 'Not attached to a tour',
        /** Dấu vết lần duyệt gần nhất — `moderatedAt` null khi chưa ai đụng. */
        moderated: (when: string) => `Moderated ${when}`,
        moderatedBy: (who: string) => `by ${who}`,
        neverModerated: 'Never moderated',
      },
      /** `isApproved` là boolean nên vùng này có ĐÚNG hai nhãn trạng thái. */
      state: {
        approved: 'Approved',
        pending: 'Pending',
        /**
         * ADR-0031: khác `pending` ở chỗ ĐÃ CÓ người quyết. Chữ "Rejected" chứ
         * không "Removed" — nó là một phán quyết, không phải một thao tác.
         */
        rejected: 'Rejected',
      },
      /** `AdminReviewSchema.source` — VERIFIED có booking thật sau lưng,
       *  CURATED là nội dung biên tập (không tài khoản, nên không email). */
      source: {
        VERIFIED: 'Verified',
        CURATED: 'Curated',
      },
      /**
       * Duyệt/bỏ duyệt — hành vi GHI thứ ba của admin. Contract khai ĐÚNG
       * MỘT mã lỗi cho `admin.reviews.moderate` (REVIEW_NOT_FOUND) và khối
       * `errors` dưới đây là NGUỒN duy nhất của tập mã phía admin
       * (`reviews-moderate.ts` derive từ keys, không chép danh sách lần hai
       * — nếp F2/F3). Mã tầng vận chuyển (401/403/input hỏng/lỗi lạ) KHÔNG
       * ở đây: chúng dùng chung `admin.errors.write`.
       */
      /**
       * Dialog CHỈ ĐỌC (vòng chỉnh 05/09). Trước đó cửa duy nhất để đọc trọn
       * một review là dialog xác nhận Approve — tức muốn đọc thì phải mở một
       * hành động GHI rồi bấm huỷ, và đó là dạy người ta bấm nút quyết định
       * khi chưa quyết.
       */
      details: {
        /** Nhãn của nút mở — nút chính là nội dung review trong bảng. */
        open: (author: string) => `Read the full review from ${author}`,
        title: 'Review',
        /** Ai viết, lúc nào — hai thứ định vị review trước khi đọc nó. */
        subtitle: (author: string, submitted: string) => `${author} · ${submitted}`,
        /** Review không có tiêu đề: nói ra thay vì chừa một khoảng trống. */
        noTitle: 'No title',
        /** Ảnh cỡ đọc được, không phải thumbnail của bảng. */
        photosHeading: 'Photos from the customer',
        source: 'Source',
        close: 'Close',
      },
      moderate: {
        approve: 'Approve',
        unpublish: 'Unpublish',
        /** Phán quyết CHUNG CUỘC — khác `unpublish` (gỡ tạm, ở lại hàng đợi). */
        reject: 'Reject',
        /**
         * CÙNG động từ `unpublish`, nhìn từ một review ĐÃ BỊ BÁC (vá 05/09,
         * user báo). "Unpublish" ở đó nói sai — review vốn đã không ở trên
         * site; việc thật sự xảy ra là nó quay lại hàng đợi.
         */
        reopen: 'Reopen',
        /** Nhãn cụm nút của MỘT hàng — cả trang toàn nút "Approve" giống hệt
         *  nhau thì trình đọc màn hình không phân biệt nổi hàng nào. */
        actionsLabel: (author: string) => `Moderate the review by ${author}`,
        // Nhãn ngữ cảnh dùng CHUNG với header cột (một khái niệm một chữ —
        // bài học travellers F1, nếp CANCELLATION_CONTEXT_COPY). KHÔNG có
        // alias `review` ở đây: dialog in nguyên văn review, không có dòng
        // nhãn nào dùng nó (key chết bị dọn ở review F4 31/08).
        rating: REVIEW_CONTEXT_COPY.rating,
        tour: REVIEW_CONTEXT_COPY.tour,
        author: REVIEW_CONTEXT_COPY.author,
        noteLabel: 'Moderation note (optional)',
        /** Note đi vào `ReviewModerationEvent` (audit A8), KHÔNG vào email —
         *  nói rõ để operator không viết lời nhắn cho khách vào ô này. */
        notePlaceholder: 'Kept in the moderation history — the author never sees it.',
        /**
         * Ở nhánh REJECT thì hai chuỗi trên nói SAI: note là LÝ DO, và nó đi
         * thẳng vào email cho khách (ADR-0031 §6). Bắt buộc nhập — một mail
         * "review của bạn không được đăng" mà không nói vì sao là đúng thứ §6
         * sinh ra để chặn.
         */
        reasonLabel: 'Why it was rejected',
        reasonPlaceholder: 'The author reads this in the email we send them.',
        reasonRequired: 'Tell the author why. This goes into the email they receive.',
        cancel: 'Cancel',
        approveDialog: {
          title: 'Approve this review?',
          body: 'Approving publishes the review and runs everything below in one go, straight away.',
          consequences: {
            publish: 'Publishes the review on the tour page for everyone to see.',
            /** Review không gắn tour thì KHÔNG hiện ở đâu — không hứa "lên
             *  trang tour" (review F4 31/08). */
            publishNoTour:
              'Marks the review as approved. It is not attached to a tour, so it does not appear anywhere on the site yet.',
            rating: (tour: string) =>
              `Recalculates the star rating of ${tour} from every approved review, this one included.`,
            noRating: 'No tour rating changes — this review is not attached to a tour.',
            email: 'Emails the author to tell them their review is live.',
            noEmailCurated:
              'No email goes out — a curated review has no customer account behind it.',
            noEmailDeleted: 'No email goes out — the author has deleted their account.',
          },
          warning: 'Everything the review says goes public, photos included.',
          submit: 'Approve review',
          submitting: 'Approving…',
        },
        unpublishDialog: {
          title: 'Unpublish this review?',
          body: 'Unpublishing takes the review off the public site and runs everything below in one go, straight away.',
          consequences: {
            hide: 'Removes the review from the tour page.',
            /** Không gắn tour thì vốn không hiện ở đâu — gỡ duyệt chỉ đổi cờ. */
            hideNoTour: 'Marks the review as not approved. It was not shown anywhere on the site.',
            /** Nói thẳng ca review-duy-nhất: rating tour BIẾN MẤT chứ không chỉ
             *  "tính lại" (review F4 31/08 — hệ quả nhìn thấy từ ngoài site). */
            rating: (tour: string) =>
              `Recalculates the star rating of ${tour} without this review — if it was the only approved review, the tour loses its star rating until another one is approved.`,
            noRating: 'No tour rating changes — this review is not attached to a tour.',
            /** Service chỉ enqueue email ở lần false→true — bỏ duyệt thì im
             *  lặng. Nói ra để operator biết khách KHÔNG hề được báo. */
            noEmail: 'The author is not told — no email goes out when a review is taken down.',
          },
          warning: 'The review stays in this queue and can be approved again at any time.',
          submit: 'Unpublish review',
          submitting: 'Unpublishing…',
        },
        reopenDialog: {
          title: 'Reopen this review?',
          body: 'Reopening puts the review back in the moderation queue. Nothing is published.',
          consequences: {
            queue: 'Puts the review back in the moderation queue for another look.',
            stillHidden: 'The review stays off the site until someone approves it.',
            noEmail: 'The author is not told — no email goes out when a review is reopened.',
          },
          /** Sổ moderation là append-only: mở lại KHÔNG xoá lần bác khỏi lịch sử. */
          warning: 'The rejection stays in the moderation history.',
          submit: 'Reopen review',
          submitting: 'Reopening…',
        },
        rejectDialog: {
          title: 'Reject this review?',
          body: 'Rejecting closes the review for good and runs everything below in one go, straight away.',
          consequences: {
            /** Khác `unpublish` ở đúng chỗ này: RỜI hàng đợi. */
            queue: 'Takes the review out of the moderation queue for good.',
            hide: 'Removes the review from the tour page.',
            hideNoTour: 'The review was not shown anywhere on the site.',
            rating: (tour: string) =>
              `Recalculates the star rating of ${tour} without this review — if it was the only approved review, the tour loses its star rating until another one is approved.`,
            noRating: 'No tour rating changes — this review is not attached to a tour.',
            /** Khác `unpublish`: bác bỏ thì khách ĐƯỢC báo (ADR-0031 §6). */
            email:
              'Emails the author to tell them their review was not published, with your reason.',
            noEmailCurated:
              'No email goes out — a curated review has no customer account behind it.',
            noEmailDeleted: 'No email goes out — the author has deleted their account.',
          },
          /**
           * Câu quan trọng nhất của dialog, và nó nói đúng sự thật hôm nay:
           * `booking_id` là UNIQUE và hệ thống KHÔNG có route sửa hay xoá
           * review, nên khách không viết lại được cho chuyến đi ấy. Đường quay
           * lại là bước 3, chưa làm.
           */
          warning:
            'The author cannot rewrite this review — one review per booking, and there is no way to edit it. Unapprove instead if you are unsure.',
          submit: 'Reject review',
          submitting: 'Rejecting…',
        },
        /** Mã TRẠNG-THÁI-CŨ duy nhất của vùng: review đã biến mất dưới chân
         *  dialog (tài khoản tác giả bị xoá, tour bị xoá — cả hai cascade).
         *  UI đóng dialog + toast + refresh THẬT: copy hứa thì phải làm
         *  (bài học review F3 31/08). */
        errors: {
          REVIEW_NOT_FOUND: 'This review no longer exists. The queue below has been refreshed.',
        },
        toast: {
          approvedTitle: 'Review approved',
          approvedBody: (author: string) => `The review by ${author} is live on the site.`,
          unpublishedTitle: 'Review unpublished',
          unpublishedBody: (author: string) =>
            `The review by ${author} is off the site and back in the queue.`,
          rejectedTitle: 'Review rejected',
          /** Nói luôn là khách đã được báo — đó là điểm khác `unpublish`. */
          rejectedBody: (author: string) =>
            `The review by ${author} is closed, and they have been emailed.`,
        },
      },
    },
  },
} as const;

export type Messages = typeof messages;
