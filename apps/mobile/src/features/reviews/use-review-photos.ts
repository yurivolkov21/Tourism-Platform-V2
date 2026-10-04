import { useMutation } from '@tanstack/react-query';
import type { messages } from '@tourism/i18n';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { imageExtensionOfMime } from '@/features/account/avatar-flow';
import {
  donePhotoPublicIds,
  type ReviewPhotoError,
  type ReviewPhotoItem,
  validateReviewPhoto,
} from '@/features/reviews/review-photos';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { uploadToCloudinary } from '@/lib/media-upload';

/** Ảnh review (R2) dùng chung cho viết mới (R1) và sửa lại (R5): chọn, tải thẳng lên Cloudinary, giữ publicId. */
export function useReviewPhotos(
  bookingCode: string,
  copy: typeof messages.reviews.photos,
  initial: ReviewPhotoItem[] = [],
) {
  const [photos, setPhotos] = useState<ReviewPhotoItem[]>(initial);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const signUploadMutation = useMutation(
    orpc.media.signUpload.mutationOptions({ context: withMobileAuth() }),
  );

  function photoErrorText(error: ReviewPhotoError): string {
    if (error === 'notImage') return copy.errNotImage;
    if (error === 'tooLarge') return copy.errTooLarge('10 MB');
    return copy.errTooMany(5);
  }

  function updatePhoto(key: string, patch: Partial<ReviewPhotoItem>) {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function uploadPhoto(key: string, uri: string, ext: ReviewPhotoItem['ext']) {
    try {
      const params = await signUploadMutation.mutateAsync({
        purpose: 'REVIEW_PHOTO',
        ext,
        bookingCode,
      });
      const publicId = await uploadToCloudinary(uri, ext, params);
      updatePhoto(key, { status: 'done', publicId });
    } catch {
      updatePhoto(key, { status: 'error', publicId: null });
      setPhotoError(copy.errUpload);
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setSheetError(null);
    setPhotoError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSheetError(copy.errPermission);
        return;
      }
      // Thư viện cho chọn nhiều ảnh cùng lúc, tối đa số ô còn trống.
      const remaining = 5 - photos.length;
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.5,
              allowsMultipleSelection: true,
              selectionLimit: remaining,
            });
      if (result.canceled) return;
      const accepted: ReviewPhotoItem[] = [];
      let count = photos.length;
      let rejected: string | null = null;
      for (const asset of result.assets) {
        const error = validateReviewPhoto(asset, count);
        if (error !== null) {
          rejected = rejected ?? photoErrorText(error);
          continue;
        }
        const ext = imageExtensionOfMime(asset.mimeType);
        if (ext === null) continue;
        accepted.push({
          key: `${Date.now()}-${accepted.length}-${asset.uri}`,
          uri: asset.uri,
          ext,
          status: 'uploading',
          publicId: null,
        });
        count += 1;
      }
      if (accepted.length === 0) {
        setSheetError(rejected);
        return;
      }
      // Có ảnh nhận được thì đóng sheet; lỗi của ảnh bị loại hiện ngay trong khối ảnh.
      if (rejected !== null) setPhotoError(rejected);
      setSheetOpen(false);
      setPhotos((prev) => [...prev, ...accepted]);
      for (const photo of accepted) void uploadPhoto(photo.key, photo.uri, photo.ext);
    } catch {
      setSheetError(copy.errUpload);
    }
  }

  function retryPhoto(key: string) {
    const photo = photos.find((p) => p.key === key);
    if (photo === undefined) return;
    setPhotoError(null);
    updatePhoto(key, { status: 'uploading' });
    void uploadPhoto(key, photo.uri, photo.ext);
  }

  return {
    photos,
    setPhotos,
    photoIds: donePhotoPublicIds(photos),
    photoError,
    setPhotoError,
    sheetOpen,
    setSheetOpen,
    sheetError,
    setSheetError,
    pickPhoto,
    retryPhoto,
    removePhoto: (key: string) => setPhotos((prev) => prev.filter((p) => p.key !== key)),
  };
}
