/**
 * Alt text cho ảnh, khoá theo `publicId` của Cloudinary.
 *
 * ── Vì sao có file này ──
 * Trước 09/09/2026 cả 517 dòng `media_assets` đều có `alt = NULL`. Web có đường
 * rơi-về (suy alt từ chủ sở hữu) nên trang không vỡ, nhưng trình đọc màn hình
 * chỉ nghe được tên tour chứ không biết trong ảnh có gì — và Google cũng vậy.
 *
 * ── Vì sao khoá theo publicId chứ không theo id dòng ──
 * Gallery của tour MƯỢN ảnh địa danh: 276 dòng tour dùng chung 137 publicId với
 * gallery địa danh. Alt mô tả NỘI DUNG ảnh, mà nội dung thì giống nhau dù treo ở
 * trang tour hay trang địa danh. Khoá theo publicId nên một dòng ở đây phủ mọi
 * dòng dùng chung ảnh đó, và không bao giờ lệch nhau.
 *
 * ── Luật viết ──
 * Mỗi câu dưới đây được viết SAU KHI NHÌN ảnh thật (tải từ Cloudinary rồi xem),
 * không suy từ tên file hay tiêu đề tour. Alt đoán mò còn hại hơn alt trống: nó
 * nói với người dùng trình đọc màn hình một điều sai mà họ không kiểm chứng được.
 * Mô tả cái NHÌN THẤY, không lặp lại tiêu đề đã nằm cạnh ảnh, không mở đầu bằng
 * "Ảnh chụp…". Tiếng Anh theo luật 7 (copy hướng người dùng).
 */
export const altText: Record<string, string> = {
  // ── Ảnh bìa blog (9) ──────────────────────────────────────────────────────
  'tourism/catalog/post/bridges-beaches-and-bun-cha-ca/hero':
    "Đà Nẵng's Dragon Bridge breathing a jet of flame over the Hàn River at night, spectators lined along the rail and heart-shaped lamps glowing red on the bridge beyond.",
  'tourism/catalog/post/crossing-hanoi-on-foot/hero':
    'A train easing down the narrow lane of Hanoi Train Street at dusk, headlight on, while onlookers press back against café fronts hung with lanterns.',
  'tourism/catalog/post/eating-your-way-through-hoi-an/hero':
    "Hội An's Old Town at dusk, silk lanterns strung between mustard-yellow shophouses and cyclo drivers waiting at the kerb.",
  'tourism/catalog/post/floating-markets-before-sunrise/hero':
    'Cái Răng floating market at blue hour, produce boats rafted together under strings of light while a trader poles past drifting water hyacinth.',
  'tourism/catalog/post/reading-a-hue-royal-tomb/hero':
    'A stele pavilion at a Huế royal tomb catching low morning light through mist, its tiled roof and mosaic panels framing the stone tablet inside.',
  'tourism/catalog/post/the-bay-without-the-crowds/hero':
    'Lan Hạ Bay seen from a forested ridge on Cát Bà, limestone islands scattered across still water with a handful of boats between them.',
  'tourism/catalog/post/two-days-among-the-karsts/hero':
    'Sampans threading a green river between forested karst hills at Tràng An, seen from directly above.',
  'tourism/catalog/post/what-to-pack-for-the-mist-season/hero':
    'Sa Pa town half-swallowed by cloud, a hotel façade and pine tops rising out of the mist with mountains behind.',
  'tourism/catalog/post/when-to-come-and-when-not-to/hero':
    'Terraced paddies stepping down a northern valley under low cloud, ridge behind ridge fading into rain light.',
};
