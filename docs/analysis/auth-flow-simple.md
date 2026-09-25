# Luồng đăng nhập / tài khoản — bản đơn giản

Bản dành cho người không rành kỹ thuật, không có thuật ngữ code. Bản kỹ thuật chi tiết xem [auth-flow-sequence-diagrams.md](./auth-flow-sequence-diagrams.md).

App mobile hiện chưa kết nối hệ thống thật, đang dùng dữ liệu giả để demo giao diện.

## 1. Đăng ký tài khoản mới

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Khách hàng
    participant App as Website / App
    participant HT as Hệ thống
    participant Mail as Email

    rect rgb(245, 240, 230)
    U->>App: Điền thông tin đăng ký
    App->>HT: Gửi yêu cầu tạo tài khoản
    HT->>Mail: Gửi mã xác minh
    Mail-->>U: Nhận email chứa mã
    U->>App: Nhập mã xác minh
    App->>HT: Kiểm tra mã
    HT-->>App: Xác minh thành công
    App-->>U: Mời đăng nhập
    end
```

## 2. Đăng nhập & đăng xuất

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant App as Website / Trang quản trị
    participant HT as Hệ thống

    rect rgb(245, 240, 230)
    U->>App: Nhập email + mật khẩu (hoặc chọn Google)
    App->>HT: Kiểm tra thông tin
    alt Sai
        HT-->>App: Báo lỗi
    else Đúng
        HT-->>App: Cho phép đăng nhập
        App-->>U: Vào trang chính
    end
    U->>App: Chọn "Đăng xuất"
    App->>HT: Kết thúc phiên
    App-->>U: Về trang đăng nhập
    end
```

## 3. Vào trang quản trị (kiểm tra quyền Admin)

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng (đã đăng nhập)
    participant App as Trang quản trị
    participant HT as Hệ thống

    rect rgb(245, 240, 230)
    U->>App: Truy cập trang quản trị
    App->>HT: Kiểm tra quyền Admin
    alt Không phải Admin
        HT-->>App: Từ chối
        App-->>U: Không có quyền truy cập
    else Là Admin
        HT-->>App: Cho phép
        App-->>U: Vào trang quản trị
    end
    end
```

## 4. Quên mật khẩu

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant App as Website
    participant HT as Hệ thống
    participant Mail as Email

    rect rgb(245, 240, 230)
    U->>App: Nhập email, chọn "Quên mật khẩu"
    App->>HT: Gửi yêu cầu
    HT->>Mail: Gửi link đặt lại mật khẩu
    Mail-->>U: Nhận email
    U->>App: Mở link, nhập mật khẩu mới
    App->>HT: Cập nhật mật khẩu
    HT-->>App: Xác nhận thành công
    App-->>U: Mời đăng nhập lại
    end
```

## 5. Xoá tài khoản

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor': '#FFFFFF','primaryBorderColor': '#000000','primaryTextColor': '#000000',
  'actorBkg': '#FFFFFF','actorBorder': '#000000','actorTextColor': '#000000','actorLineColor': '#000000',
  'signalColor': '#000000','signalTextColor': '#000000',
  'labelBoxBkgColor': '#F5F0E6','labelBoxBorderColor': '#000000','labelTextColor': '#000000','loopTextColor': '#000000',
  'noteBkgColor': '#EDE3CC','noteBorderColor': '#000000','noteTextColor': '#000000',
  'activationBkgColor': '#F5F0E6','activationBorderColor': '#000000'
}}}%%
sequenceDiagram
    actor U as Người dùng
    participant App as Website
    participant HT as Hệ thống

    rect rgb(245, 240, 230)
    U->>App: Yêu cầu xoá tài khoản, nhập mật khẩu
    App->>HT: Gửi yêu cầu xoá
    alt Không hợp lệ (sai mật khẩu, còn đơn đặt chỗ...)
        HT-->>App: Từ chối, nêu lý do
        App-->>U: Hiện thông báo
    else Hợp lệ
        HT-->>App: Xác nhận đã xoá
        App-->>U: Đăng xuất, về trang chủ
    end
    end
```
