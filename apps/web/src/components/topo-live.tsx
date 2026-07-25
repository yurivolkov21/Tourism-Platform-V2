'use client';

import { cn } from '@tourism/ui/lib/utils';
import { useEffect, useRef } from 'react';
import { createNoiseField, marchingSquares, sampleField } from '@/lib/topo-field';

// Bản ĐỘNG của TopoPattern: đường đồng mức sinh bằng noise + marching squares,
// trôi ngang chậm trên canvas 2D. Học tinh thần từ "Line Waves" của ReactBits
// nhưng tự sinh bằng thuật toán đã dùng cho topo-wide.svg — khỏi thêm shader
// WebGL, màu ăn token, và tắt được sạch khi người dùng xin giảm chuyển động.
//
// Màu KHÔNG hardcode: canvas đọc `color` đã tính của chính nó, nên caller đặt
// bằng class token (vd `text-primary`) như mọi chỗ khác trong repo.

const PRESETS = {
  /** Nền hero trang nội dung — mờ, chậm, chỉ đủ để band "sống". */
  ambient: { levels: 5, cell: 16, speed: 0.014, lineWidth: 1, alpha: 0.5, fieldCols: 26 },
  /** Trang 404 — dày và rõ hơn, vẫn dưới ngưỡng gây nhiễu chữ. */
  bold: { levels: 9, cell: 13, speed: 0.03, lineWidth: 1.15, alpha: 0.85, fieldCols: 30 },
} as const;

export function TopoLive({
  variant = 'ambient',
  seed = 11,
  className,
}: {
  variant?: keyof typeof PRESETS;
  /** Đổi seed để hai trang cạnh nhau không trùng vân. */
  seed?: number;
  /** Đặt màu + độ mờ tại đây, vd "text-primary opacity-25". */
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const preset = PRESETS[variant];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stroke = getComputedStyle(canvas).color;

    let field = createNoiseField(seed, preset.fieldCols, 12);
    let cols = 0;
    let rows = 0;
    let grid = new Float32Array(0);
    let frame = 0;
    let visible = true;

    // Lưới vẽ bám theo kích thước thật của phần tử; DPR kẹp ở 1.5 vì vân mờ
    // không cần sắc nét mà nhân đôi pixel thì nhân đôi luôn chi phí vẽ.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / preset.cell) + 1;
      rows = Math.ceil(height / preset.cell) + 1;
      grid = new Float32Array(cols * rows);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height || !cols || !rows) return;

      // Nạp lại trường: trôi ngang theo thời gian, thêm nhịp dọc rất nhẹ để
      // đường không chỉ trượt cứng mà còn phập phồng như địa hình thật.
      const drift = time * preset.speed;
      const sway = Math.sin(time * 0.00016) * 0.6;
      const fx = field.cols / cols;
      const fy = field.rows / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          grid[row * cols + col] = sampleField(field, col * fx + drift, row * fy + sway);
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = preset.lineWidth;
      ctx.globalAlpha = preset.alpha;
      ctx.beginPath();
      for (let i = 1; i <= preset.levels; i++) {
        const level = i / (preset.levels + 1);
        for (const s of marchingSquares(grid, cols, rows, level)) {
          ctx.moveTo(s.x1 * preset.cell, s.y1 * preset.cell);
          ctx.lineTo(s.x2 * preset.cell, s.y2 * preset.cell);
        }
      }
      ctx.stroke();
    };

    resize();

    if (reduced) {
      // Xin giảm chuyển động: vẽ đúng MỘT khung tĩnh, không mở vòng lặp nào.
      draw(0);
    } else {
      // Chỉ chạy khi band còn trong khung nhìn — cuộn qua rồi thì thôi, khỏi
      // đốt CPU cho thứ không ai thấy (bài học quạt gào 23/07).
      const io = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
      });
      io.observe(canvas);

      let last = 0;
      const loop = (time: number) => {
        frame = requestAnimationFrame(loop);
        // Khoá ~30fps: vân trôi chậm nên 60fps không đẹp hơn, chỉ tốn gấp đôi.
        if (!visible || time - last < 33) return;
        last = time;
        draw(time);
      };
      frame = requestAnimationFrame(loop);

      const onResize = () => {
        resize();
        field = createNoiseField(seed, preset.fieldCols, 12);
      };
      window.addEventListener('resize', onResize, { passive: true });

      return () => {
        cancelAnimationFrame(frame);
        io.disconnect();
        window.removeEventListener('resize', onResize);
      };
    }
  }, [variant, seed]);

  // aria-hidden nằm ở DIV bọc chứ không đặt thẳng lên <canvas>: theo spec,
  // canvas là nội dung tương tác (có thể chứa fallback focus được) nên Biome
  // chặn aria-hidden trên nó. Bọc lại thì ý nghĩa trợ năng vẫn y hệt.
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
