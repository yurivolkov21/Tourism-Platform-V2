import Image from 'next/image';
import { TOURS } from '@/mocks/tours';

// Convert từ PrebuiltUI "Image Gallery with Hover Expand Effect" (review #9,
// phương án A): 5 dải ảnh dọc, hover dải nào thì dải đó nở rộng (flex-grow
// transition thuần CSS), dải đang nở hiện tên tour + giá ở đáy.
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function StatsGallery() {
  return (
    <div className="flex h-full min-h-80 w-full gap-2 lg:min-h-0">
      {TOURS.slice(0, 5).map((tour) => (
        <a
          key={tour.slug}
          href="#gallery"
          className="group/strip relative min-w-0 flex-1 overflow-hidden rounded-xl transition-all duration-500 ease-out hover:flex-[2.6]"
        >
          <Image
            src={tour.image}
            alt={tour.title}
            fill
            sizes="(max-width: 1024px) 40vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover/strip:scale-105"
          />
          {/* Scrim đáy + caption chỉ hiện khi dải đang nở */}
          <span className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-overlay to-transparent opacity-0 transition-opacity duration-300 group-hover/strip:opacity-100" />
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-on-media opacity-0 transition-opacity delay-150 duration-300 group-hover/strip:opacity-100">
            <span className="truncate font-heading text-sm font-medium">{tour.title}</span>
            <span className="text-xs opacity-85">from {usd.format(tour.priceUsd)} / person</span>
          </span>
        </a>
      ))}
    </div>
  );
}
