import { AlertTriangleIcon } from 'lucide-react';

// Phân biệt "API chết" với "rỗng thật". Nexora ghi thẳng bài học này trong
// comment app/tours/page.tsx: hiện "No tours match your filters" khi API lỗi là
// NÓI DỐI người dùng — họ sẽ đi gỡ từng bộ lọc mà chẳng bao giờ thấy tour nào.
//
// GIỚI HẠN HIỆN TẠI: cụm này còn chạy bằng mock nên chưa có API để mà lỗi. Đây
// là khung dựng sẵn CHƯA có dữ liệu chạy qua — nó chỉ chứng minh được gì ở cụm
// gắn API. Dựng bây giờ vì rẻ hơn nhét vào lúc wire, không phải vì nó đang bảo
// vệ điều gì.
export function LoadErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="mt-10 rounded-2xl border border-dashed border-destructive/40 p-12 text-center"
    >
      <AlertTriangleIcon className="mx-auto size-6 text-destructive" aria-hidden="true" />
      <h2 className="mt-4 font-heading text-xl font-medium text-foreground">{title}</h2>
      <p className="mt-2 text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}
