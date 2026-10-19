'use client';

import type { SignedUploadParams } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Progress } from '@tourism/ui/components/progress';
import * as React from 'react';
import type { TransportFailureCode } from '@/lib/api/write-error';
import { newItemKey } from '@/lib/list-editor';
import { type UploadedPhoto, uploadPhoto } from '@/lib/photo-upload';
import {
  acceptFiles,
  remainingCapacity,
  runWithConcurrency,
  type SignPhotoUploadsResult,
  type SkippedFile,
  UPLOAD_CONCURRENCY,
} from '@/lib/tour-photos';

/**
 * Phần tải ảnh lên của trình sửa danh sách ảnh — tách khỏi tab Photos của tour (F18) để trang
 * Photos của điểm đến (ADR-0060 §8) dùng chung một bản. Hành vi giữ nguyên từng dòng của tab
 * Photos, kể cả các luật của vòng review F18:
 *
 * - Ký MỘT lần cho cả lô, tối đa `UPLOAD_CONCURRENCY` file cùng lúc, thẳng lên Cloudinary.
 * - Dòng tải vào danh sách NGAY khi file được nhận, trước khi ký — lượt chọn kế đã thấy sức chứa
 *   trừ chúng.
 * - Lệnh ký có thể NÉM (mạng đứt, redeploy): coi như GENERIC; không dòng nào kẹt ở "đang tải".
 * - Đang lưu thì không nhận file mới: ảnh tải xong lúc ấy bị bản server vừa lưu đè.
 * - Rời trang thì huỷ lượt đang tải và không khởi động file xếp hàng; thu hồi mọi URL xem trước.
 * - Nút biến mất sau khi bấm (Retry, Remove) thì tiêu điểm được chuyển đi chủ động.
 *
 * Chữ chung của việc tải (đang tải, tải hỏng, Retry, Remove, đang lưu) lấy ở tab Photos của tour;
 * hai câu riêng của từng trình sửa — file không vừa và lỗi ký — do nơi gọi đưa vào.
 */
const t = messages.admin.tours.editor.photos;

export interface UploadDraft {
  key: string;
  file: File;
  preview: string;
  status: 'uploading' | 'failed';
  percent: number;
}

export const uploadProgressId = (key: string) => `upload-${key}-progress`;
export const uploadRetryId = (key: string) => `upload-${key}-retry`;
export const uploadRemoveId = (key: string) => `upload-${key}-remove`;

export function usePhotoUploads<Code extends string>({
  sign,
  pending,
  photoCount,
  uploadButtonId,
  skippedCopy,
  signErrorCopy,
  onUploaded,
}: {
  /** Ký `count` lượt tải; có thể ném. */
  sign: (count: number) => Promise<SignPhotoUploadsResult<Code>>;
  /** Form đang lưu — không nhận file mới. */
  pending: boolean;
  /** Số ảnh đang có trong danh sách — sức chứa trừ thêm file đang tải. */
  photoCount: number;
  /** Nút Upload photos — tiêu điểm về đây khi gỡ dòng tải hỏng cuối cùng. */
  uploadButtonId: string;
  skippedCopy: (file: SkippedFile) => string;
  signErrorCopy: (code: Code | TransportFailureCode) => string;
  /** Ảnh tải xong: nơi gọi thêm dòng, trả `id` phần tử nhận tiêu điểm nếu dòng tải đang giữ nó. */
  onUploaded: (photo: UploadedPhoto, cloudName: string) => string;
}) {
  const [uploads, setUploads] = React.useState<UploadDraft[]>([]);
  const [notices, setNotices] = React.useState<string[]>([]);
  /** `id` của phần tử nhận tiêu điểm sau lượt render kế — nút vừa bấm có thể đã biến mất. */
  const [focusId, setFocusId] = React.useState<string | null>(null);
  /** URL xem trước còn sống — thu hồi hết khi rời trang. */
  const previews = React.useRef(new Set<string>());
  /** Huỷ mọi lượt tải khi rời trang. Dựng lại trong effect: StrictMode gỡ rồi gắn lại. */
  const aborter = React.useRef(new AbortController());

  const uploadingCount = uploads.filter((upload) => upload.status === 'uploading').length;
  const capacity = remainingCapacity(photoCount, uploads.length);

  React.useEffect(() => {
    const controller = new AbortController();
    aborter.current = controller;
    const live = previews.current;
    return () => {
      controller.abort();
      for (const url of live) URL.revokeObjectURL(url);
    };
  }, []);

  React.useEffect(() => {
    if (focusId === null) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  function patchUpload(key: string, next: Partial<UploadDraft>) {
    setUploads((current) =>
      current.map((upload) => (upload.key === key ? { ...upload, ...next } : upload)),
    );
  }

  function dropUpload(draft: UploadDraft) {
    URL.revokeObjectURL(draft.preview);
    previews.current.delete(draft.preview);
    setUploads((current) => current.filter((upload) => upload.key !== draft.key));
  }

  /** Server action có thể NÉM (mạng đứt, redeploy) — coi như GENERIC, như `useSectionSave`. */
  async function signSafely(count: number): Promise<SignPhotoUploadsResult<Code>> {
    try {
      return await sign(count);
    } catch {
      return { ok: false, code: 'GENERIC' };
    }
  }

  async function uploadOne(draft: UploadDraft, params: SignedUploadParams, signal: AbortSignal) {
    // Tiêu điểm đang ở thanh tiến độ của dòng (vừa bấm Retry) thì đi theo kết cục của nó.
    const followsRow = () => document.activeElement?.id === uploadProgressId(draft.key);
    try {
      const done = await uploadPhoto(
        draft.file,
        params,
        (percent) => patchUpload(draft.key, { percent }),
        signal,
      );
      const refocus = followsRow();
      dropUpload(draft);
      const target = onUploaded(done, params.cloudName);
      if (refocus) setFocusId(target);
    } catch {
      if (signal.aborted) return;
      const refocus = followsRow();
      patchUpload(draft.key, { status: 'failed' });
      if (refocus) setFocusId(uploadRetryId(draft.key));
    }
  }

  async function startUploads(files: readonly File[]) {
    if (pending) {
      setNotices([t.busySaving]);
      return;
    }
    const { accepted, skipped } = acceptFiles(files, capacity);
    const skippedNotes = skipped.map(skippedCopy);
    setNotices(skippedNotes);
    if (accepted.length === 0) return;

    // Giữ chỗ NGAY, trước khi ký: lượt chọn kế đã thấy sức chứa trừ các dòng này.
    const drafts: UploadDraft[] = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: newItemKey(), file, preview, status: 'uploading', percent: 0 };
    });
    setUploads((current) => [...current, ...drafts]);
    const signal = aborter.current.signal;
    const signed = await signSafely(accepted.length);
    if (signal.aborted) return;
    if (!signed.ok) {
      for (const draft of drafts) dropUpload(draft);
      setNotices([...skippedNotes, signErrorCopy(signed.code)]);
      return;
    }
    await runWithConcurrency(
      drafts.flatMap((draft, index) => {
        const params = signed.params[index];
        return params ? [() => uploadOne(draft, params, signal)] : [];
      }),
      UPLOAD_CONCURRENCY,
      signal,
    );
  }

  /** Chữ ký cũ có thể đã hết hạn — Retry luôn ký lại MỘT chữ ký mới. */
  async function retry(draft: UploadDraft) {
    if (pending) {
      setNotices([t.busySaving]);
      return;
    }
    patchUpload(draft.key, { status: 'uploading', percent: 0 });
    setFocusId(uploadProgressId(draft.key));
    const signal = aborter.current.signal;
    const signed = await signSafely(1);
    if (signal.aborted) return;
    const params = signed.ok ? signed.params[0] : undefined;
    if (params === undefined) {
      patchUpload(draft.key, { status: 'failed' });
      setFocusId(uploadRetryId(draft.key));
      setNotices([signErrorCopy(signed.ok ? 'GENERIC' : signed.code)]);
      return;
    }
    await uploadOne(draft, params, signal);
  }

  /** Gỡ một dòng tải hỏng; tiêu điểm sang dòng hỏng kế, hết thì về nút Upload photos. */
  function removeUpload(draft: UploadDraft) {
    const index = uploads.findIndex((upload) => upload.key === draft.key);
    const next = [...uploads.slice(index + 1), ...uploads.slice(0, Math.max(0, index))].find(
      (upload) => upload.status === 'failed',
    );
    dropUpload(draft);
    setFocusId(next ? uploadRemoveId(next.key) : uploadButtonId);
  }

  return {
    uploads,
    notices,
    uploadingCount,
    capacity,
    startUploads,
    retry,
    removeUpload,
    /** Chuyển tiêu điểm sau lượt render kế — Make cover cũng dùng. */
    setFocusId,
  };
}

/** Các dòng file đang tải hay tải hỏng — dưới danh sách ảnh, chưa phải ảnh của danh sách. */
export function PhotoUploadRows({
  uploads,
  onRetry,
  onRemove,
}: {
  uploads: readonly UploadDraft[];
  onRetry: (draft: UploadDraft) => void;
  onRemove: (draft: UploadDraft) => void;
}) {
  return uploads.map((upload) => (
    <div key={upload.key} className="flex items-center gap-3 rounded-md border border-dashed p-3">
      {/* biome-ignore lint/performance/noImgElement: ảnh xem trước là blob: cục bộ, next/image không nhận */}
      <img
        src={upload.preview}
        alt=""
        className="aspect-[3/2] w-32 rounded-md bg-muted object-cover"
      />
      <div className="grid flex-1 gap-1.5">
        {upload.status === 'uploading' ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t.uploading(upload.file.name, upload.percent)}
            </p>
            {/* Progress của kit dùng chung, như ô tải ảnh review của web (G14). */}
            <Progress
              id={uploadProgressId(upload.key)}
              // Nhận tiêu điểm khi Retry làm nút vừa bấm biến mất (vòng review F18).
              tabIndex={-1}
              aria-label={t.uploadingLabel(upload.file.name)}
              value={upload.percent}
            />
          </>
        ) : (
          <>
            <p role="alert" className="text-sm text-destructive-emphasis">
              {t.uploadFailed(upload.file.name)}
            </p>
            <div className="flex gap-2">
              <Button
                id={uploadRetryId(upload.key)}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRetry(upload)}
              >
                {t.retry}
              </Button>
              <Button
                id={uploadRemoveId(upload.key)}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(upload)}
              >
                {t.remove}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  ));
}
