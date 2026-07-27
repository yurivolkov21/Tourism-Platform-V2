'use client';

import { cn } from '@tourism/ui/lib/utils';
import { motion } from 'motion/react';
import {
  type ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

// Vendor từ MagicUI (`@magicui/animated-grid-pattern`). Không thêm dependency
// npm nào: component chỉ cần `motion`, thứ apps/web vốn đã có.
//
// Đặt ở apps/web chứ KHÔNG ở gói @tourism/ui dùng chung: gói đó không khai
// `motion` (animated-theme-toggler của MagicUI trong đó chạy bằng View
// Transitions, không phải motion), và mọi component dùng motion của repo đều
// nằm trong thư mục này.
//
// BA CHỖ SỬA so với bản gốc, đều là thứ bản gốc thiếu:
//  1. `cn` import từ '@tourism/ui/lib/utils' (bản gốc dùng alias '@/lib/utils'
//     mà repo này không có ở apps/web).
//  2. Tôn trọng `prefers-reduced-motion`: bản gốc KHÔNG tự kiểm, và
//     `MotionConfig reducedMotion="user"` của mình chỉ tắt transform/layout
//     chứ KHÔNG tắt opacity — nên với bản gốc, người xin giảm chuyển động vẫn
//     bị lưới nhấp nháy. Ở đây: chỉ vẽ lưới tĩnh, không sinh ô nào.
//  3. Dừng khi cuộn khỏi khung nhìn: bản gốc chạy vô hạn kể cả khi không ai
//     nhìn, mỗi vòng lặp lại setState cho từng ô (~12 lần/giây với 50 ô).
//     IntersectionObserver cắt hẳn phần đó.
//
// Màu do caller đặt bằng class token (vd `fill-primary/20 stroke-primary/20`)
// — bản gốc mặc định `fill-gray-400/30`, là mã màu cứng, vi phạm luật
// tokens-only của repo nên đã bỏ khỏi class mặc định.

export interface AnimatedGridPatternProps extends ComponentPropsWithoutRef<'svg'> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: number;
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

type Square = {
  id: number;
  pos: [number, number];
  iteration: number;
};

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
  ...props
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squares, setSquares] = useState<Array<Square>>([]);
  const [animate, setAnimate] = useState(false);

  const getPos = useCallback((): [number, number] => {
    return [
      Math.floor((Math.random() * dimensions.width) / width),
      Math.floor((Math.random() * dimensions.height) / height),
    ];
  }, [dimensions.height, dimensions.width, height, width]);

  const generateSquares = useCallback(
    (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        pos: getPos(),
        iteration: 0,
      })),
    [getPos],
  );

  const updateSquarePosition = useCallback(
    (squareId: number) => {
      setSquares((currentSquares) => {
        const current = currentSquares[squareId];
        if (!current || current.id !== squareId) return currentSquares;

        const nextSquares = currentSquares.slice();
        nextSquares[squareId] = {
          ...current,
          pos: getPos(),
          iteration: current.iteration + 1,
        };
        return nextSquares;
      });
    },
    [getPos],
  );

  useEffect(() => {
    if (animate && dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares));
    } else if (!animate) {
      setSquares([]);
    }
  }, [animate, dimensions.width, dimensions.height, generateSquares, numSquares]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Người xin giảm chuyển động: dừng hẳn ở lưới tĩnh, không mở observer nào.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions((current) => {
          const nextWidth = entry.contentRect.width;
          const nextHeight = entry.contentRect.height;
          if (current.width === nextWidth && current.height === nextHeight) return current;
          return { width: nextWidth, height: nextHeight };
        });
      }
    });
    resizeObserver.observe(element);

    const inViewObserver = new IntersectionObserver(([entry]) => {
      setAnimate(entry?.isIntersecting ?? false);
    });
    inViewObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      inViewObserver.disconnect();
    };
  }, []);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      {...props}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {/* svg lồng bên trong cũng phải aria-hidden: Biome kiểm từng thẻ svg
          riêng, không suy ra từ thẻ cha. Cả khối này thuần trang trí. */}
      <svg aria-hidden="true" x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [squareX, squareY], id: squareId, iteration }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: 1,
              delay: index * 0.1,
              repeatType: 'reverse',
              repeatDelay,
            }}
            onAnimationComplete={() => updateSquarePosition(squareId)}
            key={`${squareId}-${iteration}`}
            width={width - 1}
            height={height - 1}
            x={squareX * width + 1}
            y={squareY * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}
