import { messages } from '@tourism/i18n';
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
import { HeartIcon, StarIcon, UsersIcon } from 'lucide-react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { discountPercent, formatMoney, routeChain } from '@/lib/tours';
import type { MockTourCard } from '@/mocks/types';

// Card tour chuẩn — giữ thiết kế đã chốt ở trang Home (ảnh 4:3 hover scale,
// header, hàng meta, footer giá + hành động), đổi nguồn sang field contract.
// Dùng cho listing; sau này cả trang vùng và wishlist.
export function TourCard({ tour }: { tour: MockTourCard }) {
  const chain = routeChain(tour.destinations);
  const primary = chain[0];
  const discount = discountPercent(tour.basePrice, tour.compareAtPrice);

  return (
    <Card className="group relative h-full pt-0 transition-shadow hover:shadow-(--shadow-dropdown)">
      <div className="relative">
        {/* Trợ năng: KHÔNG dùng tour.title làm nhãn ảnh — nó trùng y hệt
            <CardTitle> ngay dưới, trình đọc màn hình đọc tiêu đề hai lần.
            Dùng tên destination chính làm mô tả riêng cho ảnh. */}
        <ImagePlaceholder
          label={primary?.name}
          className="aspect-(--aspect-card) w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {discount !== null ? (
          <Badge variant="destructive" className="absolute top-3 left-3">
            −{discount}%
          </Badge>
        ) : tour.isFeatured ? (
          <Badge className="absolute top-3 left-3">{messages.toursPage.featuredLabel}</Badge>
        ) : null}
      </div>

      <CardHeader>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {tour.category.name}
        </p>
        <CardTitle className="text-lg">
          {/* Lớp phủ vô hình biến cả card thành vùng bấm. Nút wishlist bên dưới
              phải relative z-10 để nổi lên trên, không thì bấm tim lại mở tour. */}
          <a href={`/tours/${tour.slug}`} className="after:absolute after:inset-0">
            {tour.title}
          </a>
        </CardTitle>
        {/* Chuỗi chặng — thứ duy nhất phân biệt card tour với card khách sạn.
            Template viết "7 days • Small group • Vietnam"; đây là dữ liệu thật
            từ destinations[], điểm chính in đậm. */}
        <CardDescription className="font-mono text-xs">
          {chain.map((dest, i) => (
            <span key={dest.slug}>
              {i > 0 ? <span aria-hidden="true"> → </span> : null}
              <span className={dest.isPrimary ? 'font-medium text-foreground' : undefined}>
                {dest.name}
              </span>
            </span>
          ))}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {tour.durationDays} {tour.durationDays === 1 ? 'day' : 'days'}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <UsersIcon className="size-3!" aria-hidden="true" />
          max {tour.maxGroupSize}
        </Badge>
        {tour.difficulty ? (
          // Nhãn độ khó lấy từ i18n, KHÔNG khai lại tại chỗ: bản cũ có hằng
          // DIFFICULTY_LABEL riêng trùng y hệt `toursPage.difficultyLabels`, và
          // hai tên cho một thứ là cách copy bắt đầu lệch nhau.
          <Badge variant="secondary">{messages.toursPage.difficultyLabels[tour.difficulty]}</Badge>
        ) : null}

        {/* ratingAvg null = CHƯA AI đánh giá. Bỏ hẳn dòng sao thay vì hiện "0.0"
            hay 5 sao rỗng — mẫu GetYourGuide dùng badge "New activity". */}
        <span className="ml-auto text-sm text-muted-foreground">
          {tour.ratingAvg === null ? (
            <span className="text-xs">{messages.toursPage.notRated}</span>
          ) : (
            <span className="flex items-center gap-1">
              <StarIcon className="size-3.5! fill-rating text-rating" aria-hidden="true" />
              {/* toFixed(1) như TourListCard: in thô thì rating 4.0 hiện thành
                  "4" và hai card cạnh nhau lệch định dạng. */}
              <span className="font-medium text-foreground">{tour.ratingAvg.toFixed(1)}</span>(
              {tour.ratingCount.toLocaleString('en-US')})
            </span>
          )}
        </span>
      </CardContent>

      <CardFooter className="mt-auto items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(tour.basePrice, tour.currency)}
        </span>
        {tour.compareAtPrice ? (
          <span className="text-sm text-price-compare tabular-nums line-through">
            {formatMoney(tour.compareAtPrice, tour.currency)}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">/ {messages.toursPage.perPerson}</span>
        <span className="relative z-10 ml-auto">
          <Button variant="ghost" size="icon-sm" aria-label={`Save ${tour.title} to wishlist`}>
            <HeartIcon />
          </Button>
        </span>
      </CardFooter>
    </Card>
  );
}
