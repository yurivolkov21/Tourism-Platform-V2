# Thuật ngữ

Trang này giải nghĩa các từ chuyên môn và các mã viết tắt hay gặp trong mã nguồn
và tài liệu của dự án. Mỗi mục một hai câu, chỗ nào cần sâu thì có link. Muốn
biết sản phẩm làm gì trước thì đọc [tổng quan](overview.md).

## Nghiệp vụ

| Từ | Nghĩa trong dự án này |
| --- | --- |
| **Tour** | Sản phẩm bày bán, ví dụ "Hạ Long 3 ngày 2 đêm". Bản thân tour không có ngày cụ thể. |
| **Chuyến** (*departure*) | Một lần chạy cụ thể của tour, có ngày đi, ngày về và số chỗ riêng. Khách đặt chỗ trên một chuyến chứ không đặt cả tour. |
| **Đơn** (*booking*) | Một lần đặt chỗ của một khách cho một chuyến. Mỗi đơn có mã riêng để tra cứu. |
| **Điểm đến** (*destination*) | Địa danh, ví dụ Hội An. Một tour đi qua nhiều điểm đến, một trong số đó là điểm chính. |
| **Vùng** (*region*) | Một trong ba miền cố định (Northern, Central, Southern Vietnam), mỗi miền có một trang riêng trên web. Mỗi điểm đến thuộc một vùng; danh sách ba vùng khai một chỗ trong `@tourism/contract` ([ADR-0045](adr/0045-region-vocabulary-in-contract.md)). |
| **Chỗ** (*seat*) | Suất cho một người trên một chuyến. Đặt thì trừ, huỷ thì trả lại. |
| **Hạn chót** (*cancellation deadline*) | Mốc duy nhất của mỗi chuyến: qua mốc này thì chuyến ngừng nhận đặt và khách cũng hết quyền huỷ miễn phí. Mốc tự tính theo độ dài chuyến ([ADR-0041](adr/0041-single-cancellation-deadline.md)). |
| **Hoàn tiền thiện chí** (*goodwill refund*) | Khoản hoàn do nhân viên quyết cho trường hợp ngoại lệ, bắt buộc ghi số tiền và lý do. |
| **Sổ hoàn tiền** (*refund ledger*) | Bảng chỉ ghi thêm, mỗi dòng là một lần hoàn tiền thật. Dòng cũ không bao giờ bị sửa hay xoá. |
| **Đánh giá đã xác thực** (*verified review*) | Đánh giá gắn với một đơn đã thanh toán, làm bằng chứng người viết đã thực sự đi tour. |
| **Câu hỏi khách** (*enquiry*) | Tin nhắn khách gửi qua form liên hệ. Có vòng trạng thái để nhân viên theo dõi. |
| **Bản tin** (*newsletter*) | Danh sách email đăng ký nhận tin. Người nhận bỏ đăng ký bằng link trong mail. |

## Trạng thái

| Trạng thái | Của cái gì | Nghĩa |
| --- | --- | --- |
| `PENDING` | Đơn | Đã tạo, chưa trả tiền. Chỗ được giữ tạm, hết hạn thì đơn tự huỷ. |
| `PAID` | Đơn | Đã trả đủ tiền. |
| `PARTIALLY_REFUNDED` | Đơn | Đã hoàn một phần, đơn vẫn còn hiệu lực. |
| `REFUNDED` | Đơn | Đã hoàn hết tiền. |
| `CANCELLED` | Đơn | Đã huỷ, có thể kèm hoàn tiền hoặc không. |
| `OPEN` / `CLOSED` / `CANCELLED` | Chuyến | Công tắc bán hàng của quản trị viên: cho bán, tạm ngừng bán, hoặc công ty huỷ chuyến. Công tắc này không cho biết chuyến đã đi hay đã về: một chuyến đã về vẫn có thể ghi `OPEN` mãi, và đó là thiết kế có chủ đích ([ADR-0046](adr/0046-departure-phase-derived.md)). Muốn biết chuyến đang ở đâu thì xem giai đoạn ở dòng dưới. |
| Giai đoạn chuyến (*phase*) | Chuyến | Suy ra từ công tắc cùng ngày đi, ngày về theo lịch Việt Nam, không lưu vào cơ sở dữ liệu: Bookable, Deadline passed, Closed, Departed, Completed, Cancelled. Màn Departures của trang quản trị hiện giai đoạn này chứ không hiện công tắc. |
| `NEW → CONTACTED → QUOTED → WON` / `LOST` | Câu hỏi khách | Vòng đời của một khách tiềm năng (*lead*): mới, đã liên hệ, đã báo giá, rồi chốt được hoặc mất. |
| `DRAFT` / `PUBLISHED` | Bài blog | Nháp hoặc đã đăng. |
| Visible / Hidden (`is_active`) | Danh mục, điểm đến | Ẩn nghĩa là rời khỏi các trang công khai (chip lọc, trang vùng…) nhưng không xoá: tour thuộc nó vẫn bán và link cũ vẫn lọc được. Chỉ xoá hẳn được khi chưa tour nào dùng ([ADR-0053](adr/0053-delete-unused-categories-destinations.md)). |

Vì sao một đơn đã huỷ có thể mang nhiều trạng thái khác nhau: xem
[booking-states](conventions/booking-states.md).

## Dựng web

| Từ | Nghĩa |
| --- | --- |
| **SSG** | *Static Site Generation*: trang được dựng sẵn thành HTML lúc build, ai vào cũng nhận cùng một bản. Nhanh nhất. |
| **ISR** | *Incremental Static Regeneration*: như SSG nhưng tự dựng lại sau một khoảng thời gian (ở đây 300 giây) để nội dung không quá cũ. |
| **On-demand revalidation** | Yêu cầu dựng lại trang ngay khi dữ liệu đổi, thay vì đợi hết 300 giây. |
| **Server Component / Client Component** | Phần giao diện chạy ở máy chủ (không gửi JavaScript xuống trình duyệt) và phần chạy trong trình duyệt (bấm được, gõ được). |
| **Prerender** | Bước dựng sẵn từng trang lúc build. Nếu lúc đó máy chủ API không trả lời thì build hỏng, xem [ADR-0044](adr/0044-prerender-retry-transient-api.md). |
| **Token thiết kế** | Giá trị màu, phông chữ, khoảng cách được đặt tên sẵn, khai một chỗ ở `@tourism/tokens` rồi cả bốn app dùng chung. Luật của repo là không viết mã màu trực tiếp trong code giao diện. |
| **Mockup** | Bản vẽ HTML của một vòng thiết kế đã được duyệt. Đây là bản ghi lịch sử nên không sửa. |

## Máy chủ và dữ liệu

| Từ | Nghĩa |
| --- | --- |
| **Endpoint** | Một "cửa" của máy chủ, ví dụ *lấy danh sách tour* hay *tạo đơn*. |
| **Contract** | Bản mô tả mọi endpoint: gửi gì lên, nhận gì về. Máy chủ và các app đọc chung bản này nên sai kiểu dữ liệu là báo lỗi ngay lúc viết code. |
| **oRPC** | Thư viện dùng để viết và gọi contract đó. |
| **Prisma** | Công cụ làm việc với cơ sở dữ liệu bằng TypeScript thay vì viết SQL tay. |
| **Migration** | Một bước thay đổi cấu trúc cơ sở dữ liệu. Migration đã chạy thì không sửa nữa; muốn đổi thì viết migration mới. |
| **Seed** | Dữ liệu mẫu nạp vào để site trông như đang hoạt động thật (tour, chuyến, đơn, đánh giá). |
| **Advisory lock** | Khoá tạm ở cơ sở dữ liệu, bảo đảm hai việc đụng cùng một đơn không chạy chen nhau. |
| **Idempotency key** | Mã chống làm hai lần. Gửi lại cùng lệnh với cùng mã thì cổng thanh toán chỉ thực hiện một lần. |
| **Webhook** | Cổng thanh toán tự gọi ngược về máy chủ để báo "đã thu tiền", thay vì máy chủ phải hỏi liên tục. |
| **Outbox** | Hàng đợi email: việc gửi mail được ghi vào bảng trước, phần chạy nền (*worker*) gửi sau, để mail không mất khi có sự cố. Trên production, worker chạy chung tiến trình với máy chủ API (`WORKER_INLINE=true`) vì gói miễn phí của Render không có tiến trình nền riêng. |
| **Cron / sweep** | Việc chạy định kỳ, ví dụ dọn các đơn chưa trả tiền đã quá hạn. |
| **Rate limit / throttle** | Chặn một người gọi quá nhiều lần trong thời gian ngắn. |
| **Soft delete** | Xoá mềm: đánh dấu đã xoá thay vì xoá hẳn, để dữ liệu liên quan không bị đứt. |

## Hạ tầng

| Từ | Là gì trong dự án |
| --- | --- |
| **Vercel** | Nơi chạy web khách và web quản trị. |
| **Render** | Nơi chạy máy chủ API; phần gửi mail và các việc định kỳ chạy chung trong cùng tiến trình. Gói miễn phí nên máy chủ ngủ sau 15 phút không có ai gọi. Vì vậy các việc dọn dẹp hằng ngày không trông vào giờ cố định mà chạy bù ở lần máy thức đầu tiên trong ngày ([ADR-0024](adr/0024-deploy-targets.md), AMEND 5). |
| **Supabase** | Nơi chứa cơ sở dữ liệu Postgres thật. |
| **Cloudinary** | Nơi chứa ảnh. |
| **Resend** | Dịch vụ gửi email. |
| **Session pooler** | Kiểu kết nối tới cơ sở dữ liệu Supabase mà dự án bắt buộc dùng (cổng 5432). Cổng 6543 là *transaction pooler*; dự án cấm dùng vì ở dự án tiền nhiệm nó buộc phần đăng nhập, thanh toán và việc nền phải làm đường vòng ([ADR-0001](adr/0001-tech-stack.md)). |

## Quy trình làm việc trong kho mã

| Từ | Nghĩa |
| --- | --- |
| **ADR** | *Architecture Decision Record*: ghi một quyết định kiến trúc cùng lý do, các phương án đã loại và cái giá phải trả. Dự án viết ADR trước khi code. Mục lục ở [adr/](adr/README.md). |
| **AMEND** | Phần bổ sung gắn vào cuối một ADR đã chốt khi quyết định thay đổi, thay vì viết ADR mới. Mỗi AMEND ghi ngày và lý do; "ADR-0001 AMEND 3" là lần bổ sung thứ ba của ADR-0001. |
| **Spec** | Bản mô tả sẽ xây gì trong một đợt, viết để chủ dự án duyệt trước khi bắt tay. Mục lục ở [specs/](specs/README.md). |
| **Plan** | Bản chia một spec đã duyệt thành từng bước thi công. |
| **Gate** | Bộ kiểm tra bắt buộc gồm build, kiểm kiểu, test và lint. `pnpm gate:int` là bản đầy đủ, chạy thêm integration test. |
| **Integration test** | Test chạy với cơ sở dữ liệu thật (Postgres trong Docker), chậm hơn nhiều nhưng bắt được lỗi mà test thường bỏ sót. |
| **TDD** | *Test-driven development*: viết test trước, viết code sau. |
| **Nexora** | Có hai nghĩa. Trong ADR và các bản đối chiếu, Nexora là dự án tiền nhiệm mà repo này viết lại từ đầu. Từ 19/08/2026, Nexora cũng là tên thương hiệu của chính sản phẩm này (tên miền `nexora-travel.agency`). |
| **Parity / thụt lùi** | So với dự án tiền nhiệm: thứ gì bản cũ có mà bản này thiếu thì gọi là thụt lùi, phải vá hoặc ghi rõ lý do bỏ. Các bản đối chiếu nằm trong [analysis/](analysis/README.md). |
| **ff-only** | Kiểu gộp nhánh *fast-forward only*: giữ lịch sử thẳng, không sinh commit gộp. |
| **Còn treo** | Việc đã biết là phải làm nhưng chưa làm. Danh sách hiện hành ở [open-items.md](open-items.md); các entry cũ trong CHANGELOG cũng có mục "CÒN TREO" ghi việc chờ làm lúc ấy. |

## Mã nội bộ trong tài liệu

ADR, spec và CHANGELOG được viết trong lúc làm nên dùng nhiều mã ngắn để gọi tên
đợt việc, phát hiện review và màn hình. Bảng dưới giải nghĩa từng họ mã. Một chữ
cái có thể mang nhiều nghĩa tuỳ tài liệu, nên hãy đọc theo ngữ cảnh. Tài liệu
viết mới thì ghi tên đầy đủ trước, mã để trong ngoặc.

| Mã | Nghĩa | Ví dụ |
| --- | --- | --- |
| **P0 – P7** | Các giai đoạn (*phase*) của lộ trình: P0 khung xương repo, P1 API lõi, P2 luồng tiền (thanh toán và hoàn tiền), P3 API cho khách và web khách (P3a, P3b), P4 trang quản trị, P5 app điện thoại, P6 trợ lý AI, P7 hoàn thiện giao diện. | P3b là đợt dựng web khách |
| **P4a – P4f** | Các đợt con của trang quản trị: a khung app, b bộ bảng dùng chung và ba vùng đầu tiên, c vận hành, d dashboard, e quản trị catalog tour, f người dùng và ảnh. Đợt e lại chia thành P4e-1 tới P4e-4. | P4e-3a là phần đầu của bước ba trong đợt catalog: tạo và sửa tour |
| **P5a, P5b-1 – P5b-5** | Các đợt của app điện thoại: P5a khung app, rồi năm cụm màn đăng nhập, xem tour, đặt tour, tài khoản, đánh giá. | P5b-3 là cụm màn đặt tour |
| **F1 – F20** (tính năng) | Số thứ tự các lát tính năng của trang quản trị, đếm nối từ đợt P4b (F1) tới P4e-4 (F20). | F17 là tạo và sửa tour (P4e-3a) |
| **F1 – F3** (luồng review) | Ba luồng phần nền trong đợt rà soát code cuối dự án, xem dòng L, A, F, M bên dưới. | F2 là dữ liệu mẫu và bước làm mới dữ liệu |
| **W + số** | Có hai nghĩa. Trong bảng chia việc của spec và tài liệu bàn giao, W1, W2… là các gói việc của chính tài liệu đó. Trong ADR và CHANGELOG từ tháng 9/2026, W1 – W4 là bốn đợt vá sau [bản audit bảo mật web ngày 05/09/2026](analysis/2026-09-05-web-security-audit.md): W1 tính đúng tiền của đơn và hoàn tiền, W2 phiên đăng nhập và hạ tầng, W3 header bảo mật của web, W4 các kênh khách gửi vào và email. | Mục "AMEND 06/09/2026 — W2" của ADR-0017 |
| **G + số** | Mã một việc còn nợ trong [open-items.md](open-items.md). Số đánh tăng dần và không dùng lại; việc đã đóng chuyển sang [open-items-closed.md](open-items-closed.md). | G41 là việc dọn dẹp hằng ngày không chạy khi Render ngủ, đã đóng |
| **L1 – L8, A1 – A5, F1 – F3, M1 – M3** | 19 luồng của đợt rà soát code cuối dự án (20–29/10/2026): L là luồng của khách trên web, A là trang quản trị, F là phần nền (hạ tầng API và CI, dữ liệu mẫu, khung web dùng chung), M là app điện thoại. Mã một phát hiện ghép thêm số thứ tự. | L4-08 là phát hiện thứ tám của luồng L4 (đơn của khách, huỷ, hoàn tiền) |
| **Mã màn hình mobile** | Mỗi tài liệu trong [handoff/](handoff/README.md) tự đặt mã cho các màn của nó: chữ cái chỉ cụm màn, số chỉ thứ tự màn. Bảng mã nằm ngay trong từng tài liệu, và cùng một chữ có thể khác nghĩa giữa hai tài liệu: E là màn Explore ở cụm xem tour nhưng là màn gửi câu hỏi ở cụm đặt tour; P1 – P6 ở cụm đặt tour là các màn theo dõi chuyến đã mua chứ không phải giai đoạn. | R1 là màn viết đánh giá; B8 là màn báo đơn đã thanh toán |
| **Nhóm A – F của sổ nợ** | Các nhóm trong [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md): A giao diện, B dữ liệu, C kiểm thử, D thư viện bên thứ ba, E nợ có từ trước, F nợ sau lần deploy đầu và email. Mã một mục ghép thêm số. | E6 là xác thực hai lớp, đã quyết định gác lại |

## Cách tài liệu cũ gọi người và công cụ

| Từ | Nghĩa |
| --- | --- |
| **user** | Trong ADR, spec và CHANGELOG, "user" thường là chủ dự án, người duyệt spec và quyết định gộp nhánh, chứ không phải người dùng của website. Tài liệu viết mới gọi là "chủ dự án". |
| **session, session thi công, session gốc** | Dự án dùng trợ lý lập trình AI (Claude Code). Một *session* là một phiên làm việc của trợ lý. *Session thi công* viết code trên một nhánh; *session gốc* review, gộp nhánh và làm các việc trên hạ tầng thật. |
| **agent, subagent** | Trợ lý AI và các trợ lý phụ do nó giao việc. |
| **Skill** | Bộ hướng dẫn đóng gói sẵn cho trợ lý AI, ví dụ cách viết spec hay cách review. Danh sách ở [skills.md](skills.md). |
