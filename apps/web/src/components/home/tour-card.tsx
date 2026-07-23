import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { HeartIcon, StarIcon } from 'lucide-react';
import Image from 'next/image';
import type { MockTour } from '@/mocks/types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

// Card tour chuẩn — sẽ tái dùng ở listing/trang vùng/wishlist khi các trang đó được chốt.
export function TourCard({ tour }: { tour: MockTour }) {
  return (
    <Card className="group pt-0 transition-shadow hover:shadow-(--shadow-dropdown)">
      <div className="relative">
        <Image
          src={tour.image}
          alt={tour.title}
          width={800}
          height={600}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="aspect-(--aspect-card) w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {tour.flag ? (
          <Badge variant="destructive" className="absolute top-3 left-3">
            {tour.flag}
          </Badge>
        ) : null}
      </div>
      <CardHeader>
        <CardTitle className="text-lg">{tour.title}</CardTitle>
        <CardDescription>{tour.place}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        {tour.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
        <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
          <StarIcon className="size-3.5! fill-rating text-rating" aria-hidden="true" />
          <span className="font-medium text-foreground">{tour.rating}</span>(
          {tour.reviews.toLocaleString('en-US')})
        </span>
      </CardContent>
      <CardFooter className="items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">{usd.format(tour.priceUsd)}</span>
        {tour.compareUsd ? (
          <span className="text-sm text-price-compare tabular-nums line-through">
            {usd.format(tour.compareUsd)}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">/ person</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" aria-label="Add to wishlist">
            <HeartIcon />
          </Button>
          <Button size="sm">Book now</Button>
        </span>
      </CardFooter>
    </Card>
  );
}
