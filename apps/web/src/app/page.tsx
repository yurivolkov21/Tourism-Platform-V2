import { Button } from '@tourism/ui/components/button';

/**
 * Placeholder trang chủ P3b — scaffold Next 16 (ADR-0011). UI thật + bộ
 * components/blocks dùng chung (@tourism/ui) dựng ở bước phối hợp kế tiếp.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-semibold text-2xl tracking-tight">Tourism v2</h1>
      <p className="text-sm opacity-70">Web (P3b) — scaffold + shadcn UI sẵn sàng.</p>
      <Button>Demo button</Button>
    </main>
  );
}
