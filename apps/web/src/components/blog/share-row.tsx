'use client';

import { CheckIcon, LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

// Hàng chia sẻ. URL lấy từ window.location, không nhận qua props: component
// này là client, biết chính xác URL đang đứng, khỏi phải kéo
// NEXT_PUBLIC_SITE_URL vào chỉ để dựng lại đúng chuỗi đó.
//
// `shareUrl` khởi tạo rỗng và chỉ set thật trong useEffect (sau mount) — cùng
// pattern với ScrollToTop. Lý do bắt buộc: đọc window.location.href thẳng lúc
// render vừa khiến SSR ném "window is not defined" (route 500), vừa (nếu chỉ
// thêm guard `typeof window === 'undefined' ? '' : ...`) khiến bản SSR ra
// href rỗng còn bản client render lần đầu ra href thật → React báo hydration
// mismatch. Để state mặc định khớp SSR rồi set lại bằng effect thì lần render
// đầu ở client vẫn khớp HTML server gửi xuống, không có gì để React phàn nàn.
export function ShareRow({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const copy = async () => {
    // Trên origin không bảo mật (vd mở bằng IP LAN từ điện thoại),
    // navigator.clipboard là undefined → gọi thẳng ném TypeError, promise
    // reject không ai bắt. Bọc try/catch, thất bại thì đừng bật cờ "Copied".
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Im lặng bỏ qua — nút vẫn hiện "Copy link", người dùng thử lại hoặc
      // tự copy URL từ thanh địa chỉ.
    }
  };

  return (
    <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-8">
      <span className="mr-1 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Share
      </span>

      <button
        type="button"
        onClick={copy}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        {copied ? (
          <CheckIcon className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
        {/* aria-live: trình đọc màn hình cần được báo khi trạng thái đổi
            thành "Copied" — nút không tự nhiên nhận focus lại sau click */}
        <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
      </button>

      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        Share on X
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        Share on Facebook
      </a>
    </div>
  );
}
