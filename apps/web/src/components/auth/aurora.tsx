'use client';

import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

// Nền "bình minh sống" cho panel auth — port từ React Bits <Aurora>
// (reactbits.dev/backgrounds/aurora, MIT) với 2 chỉnh sửa cho dự án:
// 1. KHÔNG nhận hex — nhận TÊN CSS variable (tokens-only, luật #6) và phân
//    giải oklch → sRGB lúc mount bằng canvas 2D (fillStyle hiểu mọi màu CSS).
// 2. Tôn trọng prefers-reduced-motion: vẽ đúng 1 khung tĩnh rồi dừng RAF.
// Shader giữ nguyên của React Bits: simplex noise tạo "rèm sáng" rủ từ mép
// trên, ramp màu 3 stop chạy theo trục ngang.

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

/** Phân giải 1 CSS variable màu (kể cả oklch) về [r,g,b] 0..1 qua canvas 2D */
function resolveTokenRgb(
  ctx: CanvasRenderingContext2D,
  scope: HTMLElement,
  varName: string,
): [number, number, number] {
  const raw = getComputedStyle(scope).getPropertyValue(varName).trim();
  // Fallback xám trung tính nếu token không tồn tại — lộ rõ khi dev, không crash
  if (!raw) return [0.5, 0.5, 0.5];
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [(d[0] ?? 0) / 255, (d[1] ?? 0) / 255, (d[2] ?? 0) / 255];
}

interface AuroraProps {
  /** 3 TÊN CSS variable làm color ramp trái→phải, vd ['--region-deep','--primary','--region-spark'] */
  tokenStops: [string, string, string];
  amplitude?: number;
  blend?: number;
  speed?: number;
  className?: string;
}

export function Aurora({
  tokenStops,
  amplitude = 1.0,
  blend = 0.5,
  speed = 1.0,
  className,
}: AuroraProps) {
  const ctnDom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    // Phân giải token → sRGB một lần lúc mount (panel auth cố định scope dark,
    // không cần re-resolve khi user đổi theme)
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return;
    const colorStopsArray = tokenStops.map((v) => resolveTokenRgb(probeCtx, ctn, v));

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';

    let program: Program | undefined;

    function resize() {
      if (!ctn) return;
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      if (program) {
        program.uniforms.uResolution.value = [ctn.offsetWidth, ctn.offsetHeight];
      }
    }
    window.addEventListener('resize', resize);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animateId = 0;
    const update = (t: number) => {
      if (program) {
        program.uniforms.uTime.value = t * 0.001 * speed;
        renderer.render({ scene: mesh });
      }
      // reduce-motion: giữ khung đầu tiên làm nền tĩnh, không loop
      if (!reducedMotion) animateId = requestAnimationFrame(update);
    };
    resize();
    animateId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [tokenStops, amplitude, blend, speed]);

  return <div ref={ctnDom} className={className} aria-hidden="true" />;
}
