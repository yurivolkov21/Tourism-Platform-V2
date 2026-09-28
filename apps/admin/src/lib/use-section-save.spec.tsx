import { act, renderHook } from '@testing-library/react';
import { tourReadiness } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { readinessIssues } from './tour-editor-view';
import {
  type DetailsContractCode,
  detailsErrorCopy,
  type EditorWriteResult,
} from './tour-editor-write';
import { useSectionSave } from './use-section-save';

/**
 * Vòng đời MỘT lần Save của một tab (spec F17 §2i) — mỗi kết cục một lối ra.
 */
const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh(), push: (href: string) => push(href) }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
  push.mockReset();
});

const PROJECTED = tourReadiness({
  summary: null,
  destinations: [{ isPrimary: true }],
  durationDays: 2,
  itineraryDays: [1],
  hasCover: true,
});

function setup(onFieldError?: (code: DetailsContractCode) => boolean) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ version }) =>
      useSectionSave<DetailsContractCode>({
        copy: detailsErrorCopy,
        projected: () => PROJECTED,
        slug: 'ha-long',
        version,
        onSaved,
        onFieldError,
      }),
    { initialProps: { version: '2026-09-28T01:00:00.000Z' } },
  );
  const save = async (result: EditorWriteResult<DetailsContractCode>) => {
    await act(async () => {
      await hook.result.current.save(async () => result);
    });
  };
  return { hook, onSaved, save };
}

describe('useSectionSave', () => {
  it('thành công → form nhận tour mới đúng một lần, toast, refresh, không dải báo', async () => {
    const { hook, onSaved, save } = setup();
    const detail = detailFixture();

    await save({ ok: true, detail });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(detail);
    expect(success).toHaveBeenCalledWith(messages.admin.tours.editor.saved);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hook.result.current.banner).toBeNull();
    expect(hook.result.current.pending).toBe(false);
  });

  it('STALE_TOUR → dải "stale", không toast, không refresh', async () => {
    const { hook, save } = setup();

    await save({ ok: false, code: 'STALE_TOUR' });

    expect(hook.result.current.banner).toEqual({ kind: 'stale' });
    expect(success).not.toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('TOUR_NOT_READY → dải liệt kê chỗ thiếu, tính từ bản dự tính của chính lệnh này', async () => {
    const { hook, save } = setup();

    await save({ ok: false, code: 'TOUR_NOT_READY' });

    expect(hook.result.current.banner).toEqual({
      kind: 'notReady',
      issues: readinessIssues(PROJECTED, 'ha-long'),
    });
    expect(readinessIssues(PROJECTED, 'ha-long')).toHaveLength(2);
  });

  it('NOT_FOUND → toast lỗi rồi về /tours', async () => {
    const { hook, save } = setup();

    await save({ ok: false, code: 'NOT_FOUND' });

    expect(errorToast).toHaveBeenCalledWith(detailsErrorCopy('NOT_FOUND'));
    expect(push).toHaveBeenCalledWith('/tours');
    expect(hook.result.current.banner).toBeNull();
  });

  it('mã thuộc về một ô (onFieldError trả true) → không dải, không toast', async () => {
    const onFieldError = vi.fn((code: DetailsContractCode) => code === 'DURATION_LOCKED');
    const { hook, save } = setup(onFieldError);

    await save({ ok: false, code: 'DURATION_LOCKED' });

    expect(onFieldError).toHaveBeenCalledWith('DURATION_LOCKED');
    expect(hook.result.current.banner).toBeNull();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it('mã KHÔNG thuộc ô nào (onFieldError trả false) → vẫn ra dải lỗi', async () => {
    // Vòng review F17: `onFieldError` thật của tab Details trả false cho mọi lỗi
    // vận chuyển; một nhánh lỡ trả true ở đây là nuốt lỗi — không dải, không toast.
    const onFieldError = vi.fn(() => false);
    const { hook, save } = setup(onFieldError);

    await save({ ok: false, code: 'FORBIDDEN' });

    expect(onFieldError).toHaveBeenCalledWith('FORBIDDEN');
    expect(hook.result.current.banner).toEqual({
      kind: 'error',
      message: detailsErrorCopy('FORBIDDEN'),
      uncertain: false,
    });
  });

  it('dải báo gắn với phiên bản của form: form nạp bản mới thì dải cũ tự tắt', async () => {
    const { hook, save } = setup();
    await save({ ok: false, code: 'STALE_TOUR' });
    expect(hook.result.current.banner).toEqual({ kind: 'stale' });

    hook.rerender({ version: '2026-09-28T02:00:00.000Z' });

    expect(hook.result.current.banner).toBeNull();
  });

  it('GENERIC là kết cục KHÔNG RÕ; FORBIDDEN thì rõ', async () => {
    const { hook, save } = setup();

    await save({ ok: false, code: 'GENERIC' });
    expect(hook.result.current.banner).toEqual({
      kind: 'error',
      message: detailsErrorCopy('GENERIC'),
      uncertain: true,
    });

    await save({ ok: false, code: 'FORBIDDEN' });
    expect(hook.result.current.banner).toEqual({
      kind: 'error',
      message: detailsErrorCopy('FORBIDDEN'),
      uncertain: false,
    });
  });

  it('action ném → xử như GENERIC', async () => {
    const { hook } = setup();

    await act(async () => {
      await hook.result.current.save(async () => {
        throw new Error('network down');
      });
    });

    expect(hook.result.current.banner).toEqual({
      kind: 'error',
      message: detailsErrorCopy('GENERIC'),
      uncertain: true,
    });
  });

  it('gọi save hai lần khi lần đầu chưa xong → run chạy đúng MỘT lần', async () => {
    const { hook } = setup();
    let release: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<EditorWriteResult<DetailsContractCode>>((resolve) => {
          release = () => resolve({ ok: true, detail: detailFixture() });
        }),
    );

    let first: Promise<void> | undefined;
    await act(async () => {
      first = hook.result.current.save(run);
      void hook.result.current.save(run);
    });
    expect(hook.result.current.pending).toBe(true);

    await act(async () => {
      release?.();
      await first;
    });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
