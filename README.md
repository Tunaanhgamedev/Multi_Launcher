# 🚀 Multi Launcher Pro — Windows Desktop Multi-App Automation

Ứng dụng desktop Windows chuyên nghiệp xây dựng trên nền tảng **Electron + React 19 + Vite**, hỗ trợ tự động hóa khởi chạy hàng loạt ứng dụng, tự động chia lưới cửa sổ phủ kín màn hình, đồng bộ thao tác chuột đa tab (Mouse Synchronizer) và quản lý đa tài khoản độc lập (Profile Isolation).

---

## 🌟 Tính Năng Nổi Bật

### 1. 🎯 Khởi Chạy Linh Hoạt (Dual Workflow)
- **Tổ hợp nhiều ứng dụng (Workspace Suite)**: Tích chọn nhiều phần mềm khác nhau (Chrome, Edge, VS Code, Notepad, Zalo, Discord, Office...) và khởi chạy tất cả chỉ với 1 click.
- **Nhân bản hàng loạt 1 ứng dụng (Batch Mode)**: Mở từ 2 đến hàng chục cửa sổ của cùng một ứng dụng với độ trễ tùy chỉnh (tránh quá tải CPU/RAM).

### 2. 🖱️ Đồng Bộ Thao Tác Chuột Đa Cửa Sổ (Mouse Sync Pro)
- Thao tác trên một cửa sổ gốc, tất cả các cửa sổ nhân bản còn lại sẽ **tự động click và cuộn trang đồng thời** theo đúng tọa độ tỷ lệ màn hình.
- Hỗ trợ đầy đủ: **Chuột trái, Chuột phải, Chuột giữa (Middle Click) và Cuộn trang (Mouse Wheel)**.
- **Bảo vệ ứng dụng chủ**: Khi nhấp chuột vào giao diện Multi Launcher, cơ chế hook sẽ tự động bỏ qua để bạn thao tác bình thường mà không làm ảnh hưởng các cửa sổ mục tiêu.
- **Nhận diện thời gian thực**: Tự động phát hiện số lượng cửa sổ đang mở và hiển thị trực tiếp số lượng đang đồng bộ trên thanh trạng thái.
- Phím tắt toàn cục: **F8** (Bật / Tắt tức thì bất cứ lúc nào).

### 3. 📐 Tự Động Chia Lưới Cửa Sổ (Smart Window Grid)
- Tự động tính toán ma trận lưới hàng x cột (rows x columns) phù hợp nhất với số lượng cửa sổ.
- Căn chỉnh vừa khít 100% không gian làm việc (`WorkingArea`) của màn hình, loại bỏ tình trạng cửa sổ bị che khuất hoặc đè lên nhau.
- Hỗ trợ nút **"Căn chỉnh ngay"**: Sắp xếp lại lưới bất cứ khi nào bạn mở thêm cửa sổ mới.

### 4. 🛡️ Cách Ly Profile Đa Tài Khoản (MMO / Multi-Account Isolation)
- **Bình thường**: Sử dụng profile mặc định của hệ thống.
- **Ẩn danh (Incognito / InPrivate)**: Không lưu lịch sử, cookie hay cache.
- **Cách ly tài khoản độc lập (Isolated Data-dir)**: Tự động cấp thư mục dữ liệu người dùng (`--user-data-dir`) riêng biệt cho từng cửa sổ. Cho phép đăng nhập đồng thời hàng loạt tài khoản Google, Facebook, sàn thương mại điện tử, game web/MMO mà không bị trùng lặp phiên hoặc xung đột cookie.

### 5. ⚡ Thanh Tác Vụ Kết Hợp Nhanh (Quick Combos Ribbon)
- **🚀 Chạy & Chia Lưới**: Tự động mở toàn bộ ứng dụng rồi tự căn chỉnh lưới vừa khít màn hình ngay khi mở xong, không cần bấm thêm nút nào.
- **🎯 Chạy & Bật Sync F8**: Quy trình tự động trọn gói: Mở ứng dụng ➔ Căn chỉnh lưới ➔ BẬT ngay tính năng đồng bộ chuột F8.
- **🛑 Đóng sạch cửa sổ mục tiêu**: Đóng toàn bộ các tab hoặc cửa sổ ứng dụng mục tiêu đang mở chỉ với 1 click bằng tín hiệu Win32 `WM_CLOSE` an toàn, dọn sạch không gian làm việc tức thì.
- **📋 Dán URL từ Clipboard**: Đọc danh sách liên kết đang copy trong bộ nhớ tạm và điền tự động vào ô danh sách URL.

### 6. 📐 Thanh Công Cụ Bố Cục Màn Hình Đa Năng (Window Layout Toolbar)
Bên cạnh chế độ tự động tính toán lưới, ứng dụng cung cấp thanh công cụ bố cục trực quan:
- **🔲 Tự động (Auto Grid)**: Tự chia ma trận hàng x cột tối ưu nhất theo số lượng cửa sổ.
- **◫ 2 Cột (50/50)**: Chia đôi màn hình nửa trái - nửa phải.
- **▥ 3 Cột (33.3% mỗi cột)**: Chia 3 dải dọc màn hình.
- **⊞ 4 Ô Góc (2x2)**: Chia 4 cửa sổ vào 4 góc màn hình.
- **▦ 6 Ô (3x2)**: Chia 6 cửa sổ thành 2 hàng, 3 cột.
- **🗕 Thu nhỏ tất cả / 🗖 Khôi phục**: Thu nhỏ hoặc đưa toàn bộ cửa sổ trở lại màn hình.

### 7. 💾 Quản Lý Kịch Bản Tùy Chỉnh (Custom Presets System)
- Nút **"💾 + Lưu kịch bản hiện tại"**: Cho phép người dùng đặt tên, chọn biểu tượng (icon) và lưu toàn bộ thiết lập hiện tại (chế độ, ứng dụng đã chọn, số lượng, URL, cookie mode) thành một kịch bản riêng.
- Quản lý và xóa nhanh kịch bản bất cứ lúc nào qua nút `✕`.
- Kèm sẵn 3 kịch bản mẫu: *💼 Không gian làm việc*, *🌐 4 Cửa sổ chia góc*, *🎮 Đa tài khoản độc lập MMO*.

### 8. 🔍 Thanh Công Cụ Tìm Kiếm & Chọn Ứng Dụng Nâng Cấp
- Quét tự động và nhận diện các ứng dụng phổ biến: Chrome, Edge, Cốc Cốc, Brave, Firefox, Opera, VS Code, Notepad, Calculator, Zalo, Telegram, Discord, Word, Excel, PowerPoint, Paint, File Explorer, Windows Terminal, CMD...
- Nút **"+ Chọn file .exe từ máy"**: Cho phép nạp bất kỳ file thực thi `.exe`, `.bat`, `.cmd`, `.lnk` nào trên máy tính và lưu lại vào danh sách yêu thích.
- Thanh công cụ chọn nhanh: **Tất cả**, **Bỏ chọn**, **🔄 Đảo vùng chọn**, **🌐 Chỉ chọn trình duyệt**.

### 9. ⚡ Tối Ưu Hóa Tải Trang & Khởi Chạy Siêu Nhẹ (Extreme Performance)
- **Tăng tốc phần cứng GPU & Zero-Copy**: Tích hợp các cờ nhân Chromium (`enable-gpu-rasterization`, `enable-zero-copy`, `disable-site-isolation-trials`) giúp giao diện Multi Launcher tải mượt mà 60fps, loại bỏ hoàn toàn hiện tượng nhấp nháy trắng khi khởi động.
- **Khởi chạy Chromium siêu nhẹ (Lightweight Flags)**: Tự động truyền các cờ tối ưu hóa chuyên sâu khi mở trình duyệt (`--disable-background-networking`, `--disable-sync`, `--disable-breakpad`, `--disk-cache-size=32MB`, v.v.), giúp **tiết kiệm 40–50% RAM và CPU**, không làm nghẽn ổ đĩa SSD/HDD ngay cả khi mở 10–20 tab cùng lúc.
- **Giãn cách thông minh (Micro-Stagger)**: Ngăn ngừa tình trạng nghẽn CPU và RAM bằng cơ chế phân bổ tiến trình thông minh, giữ hệ thống Windows luôn mượt mà.
- **Win32 Window Manager chuyên biệt (`window-manager.ps1`)**: Tách biệt logic quản lý cửa sổ thành script chuyên dụng, loại bỏ độ trễ biên dịch C# lúc runtime, giúp chia lưới và đóng cửa sổ tức thì.
- **Tối ưu hóa Mouse Sync Hook**: Thay thế cơ chế tra cứu tiến trình nặng bằng kiểm tra PID trực tiếp và buffer tĩnh, giảm 99% tải CPU khi rê chuột và đồng bộ thao tác.
- **Memoized React Architecture**: Sử dụng `React.memo` cho từng thẻ ứng dụng, đảm bảo khi cập nhật tiến trình mở app, toàn bộ giao diện vẫn phản hồi mượt mà không bị giật lag.

### 10. 📌 Thanh Điều Khiển Tiện Ích Trên Cùng (Header Toolbar)
- **📌 Ghim trên cùng**: Luôn hiển thị Multi Launcher trên các cửa sổ khác.
- **🟢 Trạng thái đồng bộ chuột trực tiếp**: Báo số lượng tab đang đồng bộ, bấm để chuyển đổi.
- **🛑 Đóng nhanh tab**: Dọn dẹp nhanh các cửa sổ đang mở.
- **📁 Thư mục Profiles**: Mở nhanh thư mục lưu trữ profile độc lập (`%TEMP%\multi_launcher_profiles`).
- Phím tắt **Escape**: Hủy dừng ngay tiến trình đang mở hàng loạt.

---

## ⌨️ Bảng Phím Tắt Tiện Ích

| Phím tắt | Chức năng | Phạm vi |
| :--- | :--- | :--- |
| **`F8`** | Bật / Tắt tính năng Đồng bộ chuột đa tab | Toàn hệ thống Windows (Global Hotkey) |
| **`Escape`** | Dừng khẩn cấp tiến trình mở hàng loạt | Khi cửa sổ Multi Launcher đang active |

---

## 📦 Cách Chạy Ứng Dụng

### Cách 1: Chạy file .exe đã đóng gói sẵn (Khuyến nghị)
Bạn chỉ cần nhấp đúp vào:
- **`Chay_Multi_Launcher.bat`** (ngay tại thư mục gốc của dự án)
- Hoặc mở trực tiếp file: `release\Multi Launcher-win32-x64\Multi Launcher.exe`

### Cách 2: Chạy từ mã nguồn (Chế độ phát triển)
Yêu cầu: Đã cài đặt **Node.js 18+** trên Windows.

```powershell
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy ở chế độ Development (Hỗ trợ Hot-reload)
npm run dev
```

### Cách 3: Tự đóng gói bản phát hành mới (.exe)
```powershell
# Build giao diện Vite và đóng gói bằng electron-packager
npm run package
```
Thư mục xuất file sẽ nằm tại `release/Multi Launcher-win32-x64/`.

---

## 🛠️ Cấu Trúc Mã Nguồn

```
Multi_Launcher/
├── electron/
│   ├── main.cjs            # Tiến trình chính Electron (IPC, Quản lý tiến trình, Tăng tốc phần cứng)
│   ├── preload.cjs         # Context Bridge bảo mật giữa Electron và React
│   ├── mouse-sync.ps1      # Win32 Low-Level Mouse Hook tối ưu siêu nhẹ (SetWindowsHookEx, SendInput API)
│   └── window-manager.ps1  # Win32 Window Manager chuyên biệt (Chia lưới & Đóng nhanh đa cửa sổ)
├── src/
│   ├── App.jsx             # Giao diện chính React 19 (Presets, Bộ lọc, Cấu hình đa luồng)
│   ├── main.jsx            # Điểm gắn kết React DOM
│   └── styles.css          # Giao diện Dark Cyber Theme tối ưu, responsive
├── release/                # Bản đóng gói Multi Launcher.exe cho Windows
├── Chay_Multi_Launcher.bat # Shortcut chạy ứng dụng 1-click
├── package.json            # Cấu hình dự án và scripts đóng gói
└── vite.config.js          # Cấu hình Vite bundler (đường dẫn tương đối cho Electron)
```

---

## 💡 Lưu Ý Khi Sử Dụng
- **Đồng bộ chuột**: Cần tối thiểu từ 2 cửa sổ mục tiêu trở lên để thấy rõ tác dụng đồng bộ. Hãy nhấn `F8` hoặc nút trên app để kích hoạt.
- **Quyền hạn Windows**: Đối với một số ứng dụng chạy dưới quyền Administrator (như CMD Admin, Task Manager), bạn nên mở Multi Launcher dưới quyền Admin (`Run as administrator`) để hook chuột và sắp xếp cửa sổ hoạt động chính xác nhất.
- **Dữ liệu Profile**: Khi chọn chế độ **Đa tài khoản độc lập**, dữ liệu mỗi profile được lưu tạm thời trong thư mục `%TEMP%\multi_launcher_profiles\`.

---

## 📄 Bản Quyền & Giấy Phép
Dự án được phát triển phục vụ mục đích tự động hóa tác vụ trên Windows. Mã nguồn mở tự do theo giấy phép MIT.
