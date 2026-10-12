# Multi Launcher

Ứng dụng desktop Windows dùng Electron + React để khởi chạy nhiều ứng dụng, trình duyệt (Chrome, Edge, Cốc Cốc, Firefox, Brave...) và phần mềm tùy chọn trên máy tính.

## Yêu cầu
- Windows 10/11
- Node.js LTS (khuyến nghị Node 20 trở lên)

## Chạy ở chế độ phát triển

Mở PowerShell tại thư mục dự án:

```powershell
npm install
npm run dev
```

## Build giao diện

```powershell
npm run build
npm start
```

`npm start` sau khi build sẽ mở ứng dụng Electron từ thư mục `dist`.

## Tính năng nổi bật
- **Khởi chạy tổ hợp nhiều ứng dụng (Workspace Suite)**: Tích chọn nhiều phần mềm khác nhau (Chrome, Edge, VS Code, Notepad, Office...) và mở tất cả chỉ với 1 click.
- **Khởi chạy hàng loạt 1 ứng dụng (Batch Mode)**: Mở nhiều tab/cửa sổ của bất kỳ trình duyệt hoặc phần mềm nào với độ trễ tùy chỉnh và danh sách URL/tham số.
- **Tự động dò tìm ứng dụng trên Windows**: Nhận diện Chrome, Microsoft Edge, Cốc Cốc, Brave, Firefox, Opera, Visual Studio Code, Notepad, Calculator, Windows Terminal, Office, v.v.
- **Duyệt chọn ứng dụng tùy ý trên máy**: Nút "+ Chọn file .exe từ máy" cho phép chọn bất kỳ file thực thi `.exe`, `.bat`, `.cmd`, `.lnk` nào trên tất cả các ổ đĩa và lưu lại để sử dụng.
- **Sắp xếp cửa sổ dạng lưới (Grid View)**: Tự động dàn các cửa sổ vừa mở thành dạng lưới ngăn nắp trên màn hình.
- **Kiểm soát độ trễ & Dừng an toàn**: Cấu hình độ trễ giữa các lần khởi chạy để tránh nghẽn CPU/RAM và dừng bất kỳ lúc nào.

## Lưu ý
- Danh sách ứng dụng tự thêm được lưu cục bộ trên máy.
- Chế độ lưới tác động đến các cửa sổ đang hiển thị trên màn hình chính.
- Dừng chỉ ngăn các lần mở tiếp theo; không tự động đóng các cửa sổ đã mở.
