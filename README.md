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

### 5. ⚡ Kịch Bản Mẫu (Presets & Quick Scenarios)
- **💼 Không gian làm việc**: Mở cùng lúc Chrome, VS Code, Notepad & Zalo.
- **🌐 4 Cửa sổ chia góc**: 4 cửa sổ trình duyệt chia đều 4 góc màn hình với các website thiết lập sẵn.
- **🎮 Đa tài khoản độc lập**: 4 cửa sổ Chrome profile riêng biệt phục vụ nuôi acc / cày cuốc.

### 6. 🔍 Tìm Kiếm & Nhận Diện Ứng Dụng Tự Động
- Quét tự động và nhận diện các ứng dụng phổ biến: Chrome, Edge, Cốc Cốc, Brave, Firefox, Opera, VS Code, Notepad, Calculator, Zalo, Telegram, Discord, Word, Excel, PowerPoint, Paint, File Explorer, Windows Terminal, CMD...
- Nút **"+ Chọn file .exe từ máy"**: Cho phép nạp bất kỳ file thực thi `.exe`, `.bat`, `.cmd`, `.lnk` nào trên máy tính và lưu lại vào danh sách yêu thích.
- Thanh tìm kiếm tức thời và bộ lọc theo danh mục (Khả dụng, Trình duyệt, Hệ thống/Văn phòng, Ứng dụng tự thêm).

### 7. 📌 Ghim Trên Cùng (Always on Top) & Phím Tắt
- Nút **📌 Ghim trên cùng** giúp cửa sổ Multi Launcher luôn nổi trên các ứng dụng khác, tiện theo dõi tiến trình và bật tắt đồng bộ.
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
│   ├── main.cjs            # Tiến trình chính Electron (IPC, Quản lý tiến trình, Căn chỉnh lưới Win32)
│   ├── preload.cjs         # Context Bridge bảo mật giữa Electron và React
│   └── mouse-sync.ps1      # Win32 Low-Level Mouse Hook (SetWindowsHookEx, SendInput API)
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
