/**
 * Bỏ dấu tiếng Việt để gõ "ha long" vẫn tìm ra "Hạ Long" — khách nước ngoài
 * không gõ được dấu, mà địa danh trong dữ liệu thì có dấu đầy đủ.
 *
 * Bản cài đặt chuyển xuống `@tourism/contract` ngày 22/09: ô slug của admin
 * cần đúng luật này, mà gói `contract` không import được `apps/web`. Giữ lại
 * re-export ở đây để mười chỗ gọi trong web khỏi phải đổi đường dẫn — và để
 * chỉ có MỘT bản cài đặt, chứ không phải hai bản trôi lệch nhau.
 */
export { foldAccents } from '@tourism/contract';
