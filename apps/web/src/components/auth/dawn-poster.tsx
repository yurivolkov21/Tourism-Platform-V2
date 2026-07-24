// Panel phải cụm auth (redesign vòng 2 sau khảo sát login thực tế): tấm POSTER
// du lịch cổ điển "SAPA EXPRESS" vẽ vector thuần SVG/CSS — cùng họ ephemera với
// tấm vé bên trái (vé + poster = đồ lưu niệm đường sắt). Học từ Airbnb (nền
// login = tường poster du lịch) và Resend (cả trang là MỘT tác phẩm, không blob
// trừu tượng). Bảng màu 100% token qua color-mix: trời đêm jade → rạng đông hổ
// phách, 4 lớp ruộng bậc thang, mặt trời spark, đoàn tàu băng cầu cạn theo chu
// kỳ (keyframes ở globals.css — reduced-motion thì tàu đậu giữa cầu, mây đứng).
// Không WebGL: bản aurora/ogl vòng 1 bị user chê "không thẩm mỹ", đã gỡ.

/** Một toa tàu: thân tối + 3 cửa sổ sáng đèn hổ phách */
function Carriage({ x }: { x: number }) {
  return (
    <g>
      <rect
        x={x}
        y={778}
        width={30}
        height={15}
        rx={2}
        style={{ fill: 'color-mix(in oklab, var(--region-deep) 30%, var(--background))' }}
      />
      {[5, 13, 21].map((wx) => (
        <rect
          key={wx}
          x={x + wx}
          y={782}
          width={4.5}
          height={5}
          rx={1}
          style={{ fill: 'var(--region-spark)' }}
        />
      ))}
    </g>
  );
}

export function DawnPoster() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        {/* Trời: đêm jade sẫm trên cao → jade → quầng hổ phách sát đường chân trời */}
        <linearGradient id="poster-sky" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: 'color-mix(in oklab, var(--region-deep) 45%, var(--background))' }}
          />
          <stop offset="0.42" style={{ stopColor: 'var(--region-deep)' }} />
          <stop
            offset="0.58"
            style={{ stopColor: 'color-mix(in oklab, var(--primary) 78%, var(--region-spark))' }}
          />
          <stop
            offset="0.66"
            style={{ stopColor: 'color-mix(in oklab, var(--region-spark) 55%, var(--primary))' }}
          />
          <stop offset="1" style={{ stopColor: 'var(--primary)' }} />
        </linearGradient>
      </defs>

      <rect width="800" height="1000" fill="url(#poster-sky)" />

      {/* Mặt trời rạng đông + 2 quầng halo kiểu poster */}
      <circle cx="340" cy="600" r="185" style={{ fill: 'var(--region-spark)' }} opacity="0.08" />
      <circle cx="340" cy="600" r="130" style={{ fill: 'var(--region-spark)' }} opacity="0.16" />
      <circle cx="340" cy="600" r="85" style={{ fill: 'var(--region-spark)' }} />

      {/* Mây phẳng kiểu poster, trôi rất chậm */}
      <g className="poster-cloud" style={{ fill: 'var(--foreground)' }} opacity="0.09">
        <rect x="70" y="170" width="190" height="13" rx="6.5" />
        <rect x="120" y="190" width="110" height="11" rx="5.5" />
      </g>
      <g
        className="poster-cloud poster-cloud-slow"
        style={{ fill: 'var(--foreground)' }}
        opacity="0.07"
      >
        <rect x="480" y="280" width="230" height="13" rx="6.5" />
        <rect x="560" y="300" width="120" height="11" rx="5.5" />
      </g>

      {/* Đàn én sớm gần mặt trời — nét "v" poster cổ điển */}
      <g
        fill="none"
        style={{ stroke: 'color-mix(in oklab, var(--foreground) 55%, transparent)' }}
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M500 418 Q 506 410 512 418 M512 418 Q 518 410 524 418" />
        <path d="M548 396 Q 553 389 558 396 M558 396 Q 563 389 568 396" />
        <path d="M586 434 Q 590 428 594 434 M594 434 Q 598 428 602 434" />
      </g>

      {/* Lớp núi xa nhất — ngược sáng, pha spark cho hơi thở rạng đông */}
      <path
        d="M0 660 C 130 615, 260 655, 400 630 S 660 585, 800 625 L800 1000 L0 1000 Z"
        style={{ fill: 'color-mix(in oklab, var(--primary) 60%, var(--region-spark))' }}
      />

      {/* Lớp ruộng bậc thang giữa + 2 đường bờ ruộng sáng mảnh */}
      <path
        d="M0 725 C 170 680, 330 730, 500 705 S 700 665, 800 700 L800 1000 L0 1000 Z"
        style={{ fill: 'var(--primary)' }}
      />
      <path
        d="M0 750 C 170 705, 330 755, 500 730 S 700 690, 800 725"
        fill="none"
        style={{ stroke: 'color-mix(in oklab, var(--region-spark) 30%, transparent)' }}
        strokeWidth="1.5"
      />
      <path
        d="M0 776 C 170 731, 330 781, 500 756 S 700 716, 800 751"
        fill="none"
        style={{ stroke: 'color-mix(in oklab, var(--region-spark) 22%, transparent)' }}
        strokeWidth="1.5"
      />

      {/* Sườn núi mang CẦU CẠN: hai mỏm hai bên, thung lũng ở giữa */}
      <path
        d="M0 830 C 90 795, 170 800, 235 825 L 235 845 C 320 880, 480 880, 565 845 L 565 822 C 640 796, 730 792, 800 815 L800 1000 L0 1000 Z"
        style={{ fill: 'var(--region-deep)' }}
      />

      {/* Đường ray chạy suốt chiều ngang — tàu luôn có ray dưới bánh dù đang ở
          đoạn nào của chu kỳ, không "lơ lửng" khi ra ngoài nhịp cầu */}
      <rect
        x="0"
        y="794"
        width="800"
        height="2.5"
        style={{ fill: 'color-mix(in oklab, var(--region-deep) 55%, var(--background))' }}
      />

      {/* Cầu cạn: mặt cầu + 4 trụ xuống thung lũng */}
      <rect
        x="225"
        y="796"
        width="350"
        height="7"
        style={{ fill: 'color-mix(in oklab, var(--region-deep) 55%, var(--background))' }}
      />
      {[268, 344, 420, 496].map((px) => (
        <rect
          key={px}
          x={px}
          y={803}
          width={9}
          height={70}
          style={{ fill: 'color-mix(in oklab, var(--region-deep) 55%, var(--background))' }}
        />
      ))}

      {/* Đoàn tàu SAPA EXPRESS: đầu kéo + 3 toa, cửa sổ sáng đèn — chạy bằng CSS */}
      <g className="poster-train">
        <rect
          x={-38}
          y={774}
          width={36}
          height={19}
          rx={3}
          style={{ fill: 'color-mix(in oklab, var(--region-deep) 22%, var(--background))' }}
        />
        <rect x={-32} y={779} width={7} height={6} rx={1} style={{ fill: 'var(--region-spark)' }} />
        <Carriage x={4} />
        <Carriage x={40} />
        <Carriage x={76} />
      </g>

      {/* Lớp đồi tiền cảnh tối nhất — chỗ đứng cho quote */}
      <path
        d="M0 905 C 210 865, 430 915, 620 892 S 760 875, 800 885 L800 1000 L0 1000 Z"
        style={{ fill: 'color-mix(in oklab, var(--region-deep) 40%, var(--background))' }}
      />
    </svg>
  );
}
