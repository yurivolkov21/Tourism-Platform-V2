/**
 * Các slot key brand-chrome mà seed tạo dòng (`site_media_slots`). Phủ mọi khe của danh mục
 * ở contract (`libs/shared/contract/src/site-slots.ts`, ADR-0059) cộng năm khoá web không
 * đọc (`home-experiences`, `home-trust`, `content-hero`, `destinations-hero`,
 * `about-team-ops`); `site-slot-keys.spec.ts` canh điều đó. Tách khỏi `seed.ts` (19/10) để
 * spec import được mà không chạy seed.
 */
export const SITE_SLOT_KEYS = [
  'home-hero',
  'home-experiences',
  'home-why-choose',
  'home-trust',
  'cta-band',
  'content-hero',
  'destinations-hero',
  'auth-panel',
  'about-story',
  'about-hero',
  // Năm ảnh của khối "why choose us" trên Home — đặt tên theo CHỦ THỂ ảnh
  // (guide/food/river/evening/heritage) chứ không theo câu tiêu đề, để đổi chữ
  // sau này không làm tên khe lạc nghĩa.
  'why-guide',
  'why-food',
  'why-river',
  'why-evening',
  'why-heritage',
  // Ảnh chân khung thông tin ở /contact §2 — khe riêng chứ không mượn
  // `content-hero`: khe đó dùng chung 11 trang, gắn ảnh vào là đổi cả 11.
  'contact-panel',
  // 4 ô bento Gallery ở /about §"The country we call the office"
  'about-gallery-north',
  'about-gallery-central',
  'about-gallery-south',
  'about-gallery-all',
  // 4 mốc Timeline ở /about §"Twelve years, counted the slow way"
  'about-timeline-2014',
  'about-timeline-2017',
  'about-timeline-2021',
  'about-timeline-2026',
  // 4 avatar đội ngũ ở /about §Team — khoá theo chức danh, không theo tên người
  'about-team-ceo',
  'about-team-routes',
  'about-team-guides',
  'about-team-ops',
  // 5 ô khối "Moments from the journey" ở /destinations. Đặt tên theo CHỦ THỂ
  // trong khung hình (kayak/thung lũng/sông/cổng/chợ nổi) chứ không theo câu
  // caption — cùng lý lẽ với cụm `why-*`: đổi chữ sau này không làm tên khe
  // lạc nghĩa. Mỗi khoảnh khắc TỰ KHAI khoá khe của mình ở `mocks/moments.ts`
  // thay vì suy ra từ vị trí trong mảng: suy theo index thì sắp xếp lại mảng
  // là ảnh gắn nhầm chỗ mà không có gì báo.
  // Tên khe đặt theo ĐỊA DANH CÓ ẢNH, không theo ý tưởng ban đầu. Bốn khe đổi
  // tên ngày 18/08 vì Hạ Long / Sa Pa / Huế / Cần Thơ không có tấm nào trong
  // kho, còn Lan Hạ / Hà Giang / Mỹ Sơn / Bến Tre thì có sẵn và hợp cảnh. Giữ
  // tên cũ mà nhét ảnh nơi khác vào là gài bẫy người đọc sau: khoá khe cũng là
  // `publicId` trên Cloudinary, tra `moment-hue-gate` mà ra tháp Chăm thì mất
  // cả buổi mới hiểu. Khe cũ không có row media nào nên đổi tên là miễn phí.
  'moment-lanha-kayak',
  'moment-hagiang-valley',
  'moment-hoian-river',
  'moment-myson-towers',
  'moment-bentre-canal',
  // Video nền dải CTA cuối /about — khe VIDEO đầu tiên của dự án
  'about-cta-video',
  // 15 ô section "… in photos" của ba trang vùng (`RegionGallery`, thêm
  // 19/08): Bắc 6 ô (biến thể peaks) · Trung 6 (lanterns) · Nam 3 (panorama).
  // Khoá theo VÙNG + VỊ TRÍ Ô (không theo địa danh/chủ thể như `moment-*`) vì
  // hình ô là bất biến của bố cục đã duyệt (ô 3 miền Bắc cao ~vuông, ô 4 rất
  // dẹt…) — ảnh chọn theo hình ô, đổi ảnh vẫn giữ khoá; caption đi theo ảnh ở
  // i18n `regions[key].galleryTiles`, cùng chỉ số 1-based với khoá.
  'region-gallery-north-1',
  'region-gallery-north-2',
  'region-gallery-north-3',
  'region-gallery-north-4',
  'region-gallery-north-5',
  'region-gallery-north-6',
  'region-gallery-central-1',
  'region-gallery-central-2',
  'region-gallery-central-3',
  'region-gallery-central-4',
  'region-gallery-central-5',
  'region-gallery-central-6',
  'region-gallery-south-1',
  'region-gallery-south-2',
  'region-gallery-south-3',
  // 3 bưu thiếp khối "Signature" trang Nam (`RegionSignaturePostcards`, thêm
  // 19/08, cùng luật khoá theo vị trí như `region-gallery-*`; tiêu đề/caption
  // ở i18n `regions.south.signature.postcards` cùng chỉ số). Bắc/Trung không
  // có khối này (intro chữ / timeline chữ).
  'region-signature-south-1',
  'region-signature-south-2',
  'region-signature-south-3',
] as const;
