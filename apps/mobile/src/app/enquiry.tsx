import { useMutation, useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  buildEnquiryPayload,
  type EnquiryFormErrors,
  type EnquiryFormField,
  type EnquiryFormState,
  enquiryErrorCopy,
  validateEnquiry,
} from '@/features/booking/enquiry-form';
import { EnquiryScreen } from '@/features/booking/enquiry-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * E1/E2 (W6) — mở từ ba chỗ (đợt đã đóng, tour hết đợt — cả hai ở nhánh
 * `feat/mobile-browse-screens`; hộp huỷ quá hạn — `bookings/[code].tsx` của
 * nhánh này). `tourSlug` tuỳ chọn: `enquiries.create` KHÔNG bắt buộc gắn tour.
 */
export default function EnquiryRoute() {
  const { tourSlug, tripTitle, tripSubtitle, tripImageUrl } = useLocalSearchParams<{
    tourSlug?: string;
    tripTitle?: string;
    tripSubtitle?: string;
    tripImageUrl?: string;
  }>();
  const { data: session } = getAuthClient().useSession();
  const copy = messages.mobile.enquiry;

  const [values, setValues] = useState<EnquiryFormState>({
    name: session?.user?.name ?? '',
    email: session?.user?.email ?? '',
    phone: '',
    message: '',
  });
  const [errors, setErrors] = useState<EnquiryFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // `bookings` KHÔNG có cột `tourId`, chỉ có `tourSlug` — tra thêm đúng một
  // lượt gọi phụ CHỈ để lấy uuid đính vào payload (đã đọc
  // `libs/shared/contract/src/schemas/bookings.ts`, xác nhận không có cột đó).
  const tourQuery = useQuery(
    orpc.catalog.tours.bySlug.queryOptions({
      input: { slug: tourSlug ?? '' },
      enabled: tourSlug !== undefined,
    }),
  );

  // Chưa tải xong tour thì chưa có `tourId` — gửi lúc này sẽ mất liên kết tour.
  const tourLoading = tourSlug !== undefined && tourQuery.isPending;

  const enquiryMutation = useMutation(
    orpc.enquiries.create.mutationOptions({ context: withMobileAuth() }),
  );

  function handleChange(field: EnquiryFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: undefined },
    );
  }

  function handleSubmit() {
    if (tourLoading) return;
    const nextErrors = validateEnquiry(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setFormError(null);
    enquiryMutation.mutate(buildEnquiryPayload(values, tourQuery.data?.id), {
      onSuccess: () => setSent(true),
      onError: (error) => setFormError(enquiryErrorCopy(error)),
    });
  }

  function handleClose() {
    if (tourSlug !== undefined) router.push(`/tours/${tourSlug}`);
    else router.back();
  }

  return (
    <EnquiryScreen
      tripTitle={tripTitle}
      tripSubtitle={tripSubtitle}
      tripImageUrl={tripImageUrl}
      nameLabel={copy.nameLabel}
      emailLabel={copy.emailLabel}
      phoneLabel={copy.phoneLabel}
      messageLabel={copy.messageLabel}
      messagePlaceholder={copy.messagePlaceholder}
      values={values}
      errors={errors}
      onChange={handleChange}
      submitLabel={copy.submit}
      submitting={enquiryMutation.isPending || tourLoading}
      onSubmit={handleSubmit}
      formError={formError}
      sent={sent}
      successTitle={copy.successTitle}
      successBody={copy.success}
      backToTourLabel={copy.backToTour}
      onClose={handleClose}
      transformUrl={cloudinaryUrl}
    />
  );
}
