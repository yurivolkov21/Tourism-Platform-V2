import { messages } from '@tourism/i18n';
import { ThemeProvider } from '@tourism/mobile-ui';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { BackHandler, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DiscardDraftGuard } from './discard-draft-guard';

/**
 * Chặn rời màn khi bài đang viết dở, trên CÂY ROUTE THẬT (stack của expo-router): lệnh rời đi qua
 * `beforeRemove` thật, không phải router giả. Back cứng Android mô phỏng bằng chính listener
 * `hardwareBackPress` mà navigation container đăng ký — trên máy, nút back gọi đúng listener ấy.
 */

const copy = messages.reviews.unsentDraft;

// Số đo máy tầm trung có tai thỏ, cùng số với `test-utils`: `SafeAreaView` cần metrics thật.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider scheme="light">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
let backListeners: BackListener[] = [];
let backSpy: jest.SpyInstance | undefined;

beforeEach(() => {
  backListeners = [];
  backSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    backListeners.push(listener);
    return {
      remove: () => {
        backListeners = backListeners.filter((item) => item !== listener);
      },
    };
  });
});

// Chỉ gỡ đúng spy của file này: `restoreAllMocks` gỡ luôn bản giả mà `expo-router/testing-library`
// cài cho cây route, và từ test thứ hai `renderRouter` không dựng được cây mới nữa.
afterEach(() => {
  backSpy?.mockRestore();
});

/** Như BackHandler thật: listener đăng ký sau được hỏi trước, dừng ở listener đầu tiên nhận việc. */
async function pressHardwareBack() {
  await act(() => {
    const event = { type: 'hardwareBackPress', timeStamp: Date.now() };
    for (const listener of [...backListeners].reverse()) {
      if (listener(event)) return;
    }
  });
}

/** Xem chú thích `openApp` ở `routes.spec.tsx`: trả object thường bọc kết quả. */
async function openAt(path: '/draft' | '/blank') {
  const app = renderRouter(
    {
      _layout: () => <Stack />,
      index: () => <Text>Home</Text>,
      draft: () => <DiscardDraftGuard active copy={copy} />,
      blank: () => <DiscardDraftGuard active={false} copy={copy} />,
    },
    { initialUrl: '/', wrapper: Providers },
  );
  await app;
  await act(() => router.push(path));
  expect(app.getPathname()).toBe(path);
  return { pathname: () => app.getPathname() };
}

it('chưa viết gì thì back cứng rời màn ngay, không hỏi', async () => {
  const app = await openAt('/blank');

  await pressHardwareBack();

  expect(app.pathname()).toBe('/');
  expect(screen.queryByText(copy.title)).toBeNull();
});

it('bài đang viết dở thì back cứng không rời màn mà mở tấm hỏi lại', async () => {
  const app = await openAt('/draft');

  await pressHardwareBack();

  expect(app.pathname()).toBe('/draft');
  expect(screen.getByText(copy.title)).toBeTruthy();
  expect(screen.getByText(copy.body)).toBeTruthy();
});

it('"Keep writing" đóng tấm và ở lại màn; back lần nữa lại hỏi', async () => {
  const app = await openAt('/draft');
  await pressHardwareBack();

  await fireEvent.press(screen.getByText(copy.keep));

  await waitFor(() => expect(screen.queryByText(copy.title)).toBeNull());
  expect(app.pathname()).toBe('/draft');

  await pressHardwareBack();
  expect(app.pathname()).toBe('/draft');
  expect(screen.getByText(copy.title)).toBeTruthy();
});

it('"Discard and leave" cho lệnh rời ban đầu chạy tiếp: về màn trước', async () => {
  const app = await openAt('/draft');
  await pressHardwareBack();

  await fireEvent.press(screen.getByText(copy.discard));

  expect(app.pathname()).toBe('/');
});

it('lệnh back trong app (router.back) cũng bị chặn như back cứng', async () => {
  const app = await openAt('/draft');

  await act(() => router.back());

  expect(app.pathname()).toBe('/draft');
  expect(screen.getByText(copy.title)).toBeTruthy();
});
