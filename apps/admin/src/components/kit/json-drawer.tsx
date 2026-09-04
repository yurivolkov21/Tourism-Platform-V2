'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@tourism/ui/components/drawer';
import { ScrollArea } from '@tourism/ui/components/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@tourism/ui/components/toggle-group';
import { BracesIcon, ListIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { type PayloadField, type PayloadHints, toPayloadFields } from '@/lib/payload-fields';

/**
 * Drawer xem MỘT bản ghi kèm khối payload (kit P4c — nâng từ
 * `OutboxDetailSheet` của F7 khi F8 payment events là consumer thứ hai, spec
 * P4c §2.6): panel trượt từ phải, tiêu đề + dòng mô tả mono (khoá định danh
 * của hàng), các field của vùng ở trên, khối payload ở dưới.
 *
 * ĐỔI VỎ 03/09 (user chốt qua bản demo `design/mockups/details-drawer.src.html`):
 * từ `Sheet` sang `Drawer` theo khuôn `@shadcn-space/drawer-02`. Ba thứ ĐO
 * ĐƯỢC đứng sau quyết định ấy — user báo "chuyển động chưa thật sự thiết kế
 * tốt" và "sheet khá hẹp":
 *
 * 1. `Sheet` KHÔNG thật sự trượt vào: nó chỉ `translate-x-[2.5rem]` — nhích
 *    40px rồi mờ dần, 200ms `ease-in-out`. Một tấm cao hết màn, rộng 576px mà
 *    dịch 40px thì mắt đọc ra là "pop" tại chỗ, không phải panel đi vào từ mép
 *    phải. `Drawer` trượt TRỌN từ ngoài mép màn, 450ms
 *    `cubic-bezier(0.22,1,0.36,1)`, kèm kéo-để-đóng với tốc độ ăn theo lực vẩy.
 * 2. Rộng 576px → **626px**, và panel NỔI cách mép 16px thay vì dính mép.
 * 3. Đầu panel giờ ĐỨNG YÊN. Bản `Sheet` cho cả panel cuộn, nên cuộn xuống đọc
 *    payload là mất luôn tiêu đề và dedupe key — không còn biết đang xem hàng
 *    nào.
 *
 * KHÔNG lấy gì từ file registry: drawer-02 là demo giỏ hàng, khai
 * `canvas-confetti` để bắn pháo giấy lúc đủ tiền free-ship. Ta mượn đúng cấu
 * hình vỏ. `Drawer` của `@tourism/ui` vốn đã là bản đầy đủ (swipe, biến
 * `--drawer-content-width`/`--drawer-inset`, xếp chồng), nên đây là đổi cách
 * LẮP chứ không phải thay thư viện — không thêm dependency nào.
 *
 * Kit lo đúng phần CHUNG: vỏ panel, hai chế độ xem payload, và ba trạng thái
 * của khối payload (đang tải · có dữ liệu · lỗi — F8 fetch `byId` khi mở vì
 * list không mang payload, F7 đưa thẳng dữ liệu đã có nên không bao giờ ở
 * trạng thái tải). Field nào, nhãn gì, có khối lỗi hay không là của vùng —
 * truyền qua `children` bằng `JsonDrawerFields`/`JsonDrawerField`/`JsonDrawerText`.
 *
 * Bảng giữ MỘT instance, mở/đóng qua `open` — 50 hàng không mount 50 panel.
 */
const t = messages.admin.payload;

/**
 * Cấu hình vỏ theo drawer-02. `Popup` (lớp ngoài) thành trong suốt, không
 * viền; hình hài panel đắp lên lớp TRONG (`data-slot=drawer-content`). Phải
 * chia hai lớp như vậy vì lớp ngoài còn phải trải hết chiều cao cho phép tính
 * vuốt/xếp chồng của primitive chạy đúng — co nó lại rồi bo góc là gãy chỗ đó.
 */
const DRAWER_SHELL = [
  'm-0 border-0! bg-transparent! shadow-none! [--drawer-bleed-background:transparent] [--drawer-inset:0px]',
  // 39.125rem = 626px, thay 24rem mặc định của primitive.
  'data-[swipe-axis=x]:[--drawer-content-width:100%] data-[swipe-axis=x]:sm:[--drawer-content-width:39.125rem]',
  '**:data-[slot=drawer-content]:m-4 **:data-[slot=drawer-content]:w-full **:data-[slot=drawer-content]:rounded-2xl **:data-[slot=drawer-content]:border **:data-[slot=drawer-content]:bg-popover **:data-[slot=drawer-content]:text-popover-foreground **:data-[slot=drawer-content]:shadow-2xl',
].join(' ');

/** Hai chế độ xem khối payload. Mặc định `simple` — xem JSDoc `JsonDrawer`. */
type PayloadMode = 'simple' | 'developer';

export interface JsonDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Khoá định danh của hàng (dedupeKey, eventId) — in mono, cho phép gãy. */
  description: string;
  /** Field/section của vùng, render TRÊN khối payload. */
  children?: React.ReactNode;
  /** Tiêu đề khối payload ("Payload"). */
  jsonLabel: string;
  /** Dữ liệu để xem; `undefined` = đang tải (in `loadingLabel`). */
  json: unknown;
  loadingLabel: string;
  /** Lỗi tải dữ liệu — thay khối payload bằng câu này (vai `alert`). */
  error?: string | null;
  /**
   * Vá NHÃN của chế độ Simple — cắt khúc bao bì và gọi trường theo tên đời
   * thường (user chốt 03/09, phương án B).
   *
   * MỘT consumer thôi (`/payment-events`), và đó là ngoại lệ có chủ ý so với
   * luật "kit chỉ nhận prop mới khi có ≥2 consumer": đường còn lại là fork
   * khối payload ra vùng, thứ user cấm dứt khoát 31/08. Prop này là DỮ LIỆU
   * thuần, có fallback rõ ràng (không truyền thì đọc bằng máy như cũ), nên
   * không mở ra nhánh hành vi nào để mà mục.
   */
  payloadHints?: PayloadHints;
}

export function JsonDrawer({
  open,
  onClose,
  title,
  description,
  children,
  jsonLabel,
  json,
  loadingLabel,
  error,
  payloadHints,
}: JsonDrawerProps) {
  /**
   * Chế độ xem là lựa chọn của NGƯỜI, không phải thuộc tính của hàng: giữ
   * nguyên khi mở sang hàng khác. Bảng chỉ mount một instance nên state này
   * sống đúng bằng phiên xem bảng. KHÔNG lên URL: spec P4b §2.2 nói về
   * filter/trang của bảng, còn đây là cách xem bên trong một panel.
   */
  const [mode, setMode] = React.useState<PayloadMode>('simple');

  /**
   * Ruột panel được GIỮ LẠI qua animation đóng (vòng vá review polish 2):
   * `open` về false là bảng đã bỏ `row`, mà drawer còn trượt ra 450ms — không
   * giữ thì người dùng nhìn một tấm trống trượt đi. Ref chép ruột của lần
   * render mở gần nhất; lần mở kế dựng ruột mới nên không dính hàng cũ.
   */
  const lastBody = React.useRef<React.ReactNode>(null);
  const body = open ? (
    <>
      <DrawerHeader className="flex-row items-start justify-between gap-3 border-b p-5">
        <div className="grid min-w-0 gap-0.5">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="wrap-anywhere font-mono text-xs">
            {description}
          </DrawerDescription>
        </div>
        {/* Nút đóng nằm TRONG header, không `absolute` như Sheet cũ:
                  header đứng yên nên nút không trôi đi khi cuộn. */}
        <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
          <XIcon />
          <span className="sr-only">{t.close}</span>
        </DrawerClose>
      </DrawerHeader>

      {/* `min-h-0` là thứ làm đầu panel đứng yên: thiếu nó thì flex item
                không co dưới nội dung, vùng cuộn phình ra và cả panel cuộn
                trở lại đúng như bản Sheet cũ. */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          {children}

          <section aria-label={jsonLabel} className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{jsonLabel}</h3>
              {/* Cụm chuyển đặt NGAY TRÊN khối payload (user chốt
                        03/09): các field phía trên vốn đã dễ đọc, chỉ khối này
                        mới cần đổi cách xem. */}
              <PayloadModeToggle mode={mode} onChange={setMode} />
            </div>
            <PayloadBlock
              json={json}
              mode={mode}
              loadingLabel={loadingLabel}
              error={error}
              hints={payloadHints}
            />
          </section>
        </div>
      </ScrollArea>
    </>
  ) : (
    lastBody.current
  );
  React.useEffect(() => {
    if (open) lastBody.current = body;
  });

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      swipeDirection="right"
    >
      <DrawerContent className={DRAWER_SHELL}>{body}</DrawerContent>
    </Drawer>
  );
}

/**
 * Hai nút chọn chế độ. `ToggleGroup` chứ không `Switch` (user để mở cả hai):
 * switch nói "bật/tắt MỘT thứ" và bắt người dùng đoán trạng thái tắt nghĩa là
 * gì; đây là chọn một trong hai cách xem, và mỗi cách cần tên riêng.
 */
function PayloadModeToggle({
  mode,
  onChange,
}: {
  mode: PayloadMode;
  onChange: (mode: PayloadMode) => void;
}) {
  return (
    <ToggleGroup
      value={[mode]}
      // `multiple` mặc định false, nên bấm lại mục đang chọn sẽ THẢ nó ra và
      // trả về mảng rỗng — cùng cái bẫy `StatusFilterTabs` đã chặn. Ở đây luôn
      // phải có đúng một chế độ.
      onValueChange={(next) => {
        const [first] = next;
        if (first === 'simple' || first === 'developer') onChange(first);
      }}
      aria-label={t.viewLabel}
      spacing={0}
      className="gap-1 rounded-lg border bg-muted/40 p-1"
    >
      <ToggleGroupItem value="simple" className="h-7 px-2.5 text-xs">
        <ListIcon aria-hidden="true" />
        {t.simple}
      </ToggleGroupItem>
      <ToggleGroupItem value="developer" className="h-7 px-2.5 text-xs">
        <BracesIcon aria-hidden="true" />
        {t.developer}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Ba trạng thái × hai chế độ, gom một chỗ để cả hai vùng cư xử như nhau. */
function PayloadBlock({
  json,
  mode,
  loadingLabel,
  error,
  hints,
}: {
  json: unknown;
  mode: PayloadMode;
  loadingLabel: string;
  error?: string | null;
  hints?: PayloadHints;
}) {
  // Nấu ĐÚNG dữ liệu đang mở, một lần (`useMemo` khoá theo `json`, vòng vá
  // review F7): bảng không nấu sẵn chuỗi cho cả trang.
  // Chỉ nấu biểu diễn ĐANG XEM (vòng vá review polish 2): mặc định là Simple
  // nên JSON thụt lề của cả webhook từng được stringify rồi vứt ở mọi lần mở.
  const pretty = React.useMemo(
    () => (json === undefined || mode !== 'developer' ? undefined : JSON.stringify(json, null, 2)),
    [json, mode],
  );
  const fields = React.useMemo(
    () => (json === undefined || mode !== 'simple' ? undefined : toPayloadFields(json, hints)),
    [json, mode, hints],
  );

  if (error) {
    return (
      <p role="alert" className="rounded-md border bg-muted/40 p-3 text-xs">
        {error}
      </p>
    );
  }

  if (json === undefined) {
    return (
      <p aria-busy="true" className="rounded-md border bg-muted/40 p-3 text-xs">
        {loadingLabel}
      </p>
    );
  }

  if (mode === 'developer') {
    return (
      /* `overflow-auto` cho cả hai chiều: chuỗi dài không gãy cấu trúc thụt lề. */
      <pre
        data-testid="json-drawer-json"
        className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
      >
        {pretty}
      </pre>
    );
  }

  if (fields === undefined || fields.length === 0) {
    return <p className="rounded-md border bg-muted/40 p-3 text-xs">{t.none}</p>;
  }

  return (
    <dl data-testid="json-drawer-simple" className="grid gap-2 text-sm">
      {fields.map((field) => (
        <PayloadRow key={field.path} field={field} />
      ))}
    </dl>
  );
}

/** Một dòng của chế độ Simple. */
function PayloadRow({ field }: { field: PayloadField }) {
  return (
    // Cột nhãn rộng hơn `JsonDrawerField` (10rem so với 8rem): nhãn ở đây mang
    // cả đường dẫn ("Data › Object › Metadata › Booking code"), dài hơn hẳn
    // nhãn một từ của field vùng.
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-2">
      {/* `wrap-anywhere` ở CẢ cột nhãn: đường dẫn sâu tràn ra ngoài cũng là tràn. */}
      <dt className="wrap-anywhere text-muted-foreground">{field.label}</dt>
      <dd className={field.muted ? 'wrap-anywhere text-muted-foreground' : 'wrap-anywhere'}>
        {field.value}
        {/* Số THÔ đi kèm khi giá trị đã được diễn giải (user chốt 03/09): đây
            là bề mặt đối soát, người đọc phải kiểm được con số gốc provider
            gửi — `$117.00` mà không có `11700` bên cạnh là bắt người ta tin
            phép đổi của ta. */}
        {field.raw === undefined ? null : (
          <span data-testid="payload-raw" className="ml-2 font-mono text-xs text-muted-foreground">
            {field.raw}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Danh sách field nhãn · giá trị của vùng (`<dl>` hai cột).
 *
 * Đệm ngang bỏ đi 03/09: vùng cuộn của drawer mới tự `p-5`, giữ `px-4` ở đây
 * nữa là đệm chồng đệm.
 */
export function JsonDrawerFields({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-2 text-sm">{children}</dl>;
}

/** Một dòng nhãn · giá trị. `value` là node để vùng đặt badge/link khi cần. */
export function JsonDrawerField({ label, value }: { label: string; value: React.ReactNode }) {
  // `minmax(0,1fr)` + `wrap-anywhere` (vá 03/09, cùng lỗi user báo ở dialog
  // Retry): `1fr` trần là `minmax(auto,1fr)` và `auto` lấy min-content, nên
  // một token không dấu cách (JSON lỗi provider, email dài) làm phình cột rồi
  // đẩy chữ ra ngoài mép panel. `break-words` cũ KHÔNG đủ —
  // `overflow-wrap: break-word` không tính vào min-content.
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-anywhere">{value}</dd>
    </div>
  );
}

/**
 * Khối chữ nguyên văn (lỗi, ghi chú dài) — bảng đã cắt bằng CSS, đây là chỗ
 * đọc đủ. Mono + `whitespace-pre-wrap` để stack trace giữ xuống dòng, và
 * `wrap-anywhere` để một dòng JSON không dấu cách vẫn ngắt được (vá 03/09 —
 * `break-words` cũ không đổi min-content nên khối này phình ngang).
 */
export function JsonDrawerText({ label, text }: { label: string; text: string }) {
  return (
    <section aria-label={label} className="grid gap-1.5">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="wrap-anywhere whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {text}
      </p>
    </section>
  );
}
