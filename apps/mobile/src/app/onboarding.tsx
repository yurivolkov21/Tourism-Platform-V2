import { router } from 'expo-router';
import { useState } from 'react';
import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';

/**
 * Route onboarding. Ba trang nằm TRONG một route (state `index`) chứ không phải
 * ba route: đây là một màn trượt ngang, và đẩy ba màn vào stack thì back cứng
 * của Android lại đi ngược từng trang.
 *
 * Mọi đường ra đều `markSeen()` trước — kể cả Skip: đã thấy là đã thấy.
 */
export default function OnboardingRoute() {
  const store = useOnboardingStore();
  const [index, setIndex] = useState(0);

  const leaveTo = async (path: '/' | '/login') => {
    try {
      await store.markSeen();
    } catch {
      // Ghi cờ hỏng (Keychain đang khoá, keystore Android hỏng) vẫn phải cho
      // khách đi tiếp — cùng lẽ `readHasSeen` (F9) ở chiều đọc: lần mở sau thấy
      // lại onboarding chỉ mất ba trang giới thiệu, còn nút bấm không đi đâu là
      // kẹt ngoài cửa app (review M1).
    }
    router.replace(path);
  };

  return (
    <OnboardingScreen
      index={index}
      onNext={() => setIndex((current) => current + 1)}
      onSkip={() => void leaveTo('/')}
      onStart={() => void leaveTo('/')}
      onSignIn={() => void leaveTo('/login')}
    />
  );
}
