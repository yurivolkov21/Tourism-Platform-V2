// Ba vùng dời vào `@tourism/contract` (ADR-0045): picker của admin và các trang
// vùng của web phải đọc MỘT nguồn, không thì chúng trôi xa nhau mà không gì bắt
// được. File này chỉ còn tái xuất khẩu để các trang vùng khỏi phải sửa đường
// import — và `generateStaticParams` của `/destinations/[region]` đọc qua đây,
// nên `lib/region-static-params.spec.ts` ghim đủ ba slug.
export { REGIONS } from '@tourism/contract';
