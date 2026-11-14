# Bản cập nhật tiếng Việt – Hồ cá Koi Wallpaper Engine

Bản này là **bản vá bổ sung** cho repository `BaoHuy903/3810169247`, không thay thế toàn bộ asset/engine.

## Tính năng

- Ba khung ảnh gỗ có móc treo, bố trí sẵn trên màn hình, có thể di chuyển bằng cách kéo thả.
- Bấm **Chỉnh sửa khung ảnh** ở góc dưới phải để di chuyển, **Chọn ảnh** để thêm ảnh, **Xóa ảnh** để bỏ ảnh, rồi **Hoàn tất chỉnh sửa**.
- Ảnh và vị trí được lưu cục bộ bằng localStorage của Wallpaper Engine/trình duyệt. Ảnh riêng tư **không được commit lên GitHub**. Giới hạn 8 MB/ảnh; ảnh lớn có thể vượt dung lượng lưu của trình duyệt nên nên giảm kích thước ảnh.
- Việt hóa tên thuộc tính, mô tả, danh sách lựa chọn; ngày và thời tiết chuyển sang tiếng Việt.
- Thanh FPS từ **0 (Không giới hạn)** tới **240**, mặc định là 0. `fps=0` bỏ qua giới hạn trong JS; FPS thực tế vẫn bị giới hạn bởi refresh rate và Wallpaper Engine.

## Cài bản vá

1. Clone repository gốc và sao lưu (hoặc tạo nhánh mới).
2. Sao chép `photo-frames.css`, `photo-frames.js`, `index.html`, `project.json`, `src/core/settings.js`, `src/platform/properties.js` từ thư mục bản vá vào thư mục tương ứng trong repository.
3. Không xóa `assets/`, `app.bundle.js` hay các file gốc khác.
4. **Bắt buộc** chạy `node tools/build-bundle.mjs` để biên dịch lại `app.bundle.js` vì đã sửa phần `src/`.
5. Kiểm tra qua Wallpaper Engine > Tạo hình nền > Mở hình nền từ file `project.json`/`index.html`.
6. Dùng `git add . && git commit -m "Viet hoa, them 3 khung anh, bo gioi han FPS" && git push origin main` để đẩy lên repo (sau khi kiểm tra nhánh).

## Giới hạn

Trình duyệt/Wallpaper Engine có thể giới hạn việc chọn file và đọc ảnh tùy môi trường. Nếu bộ chọn ảnh không hoạt động trong Wallpaper Engine, kiểm tra bản vá qua trình duyệt trước, hoặc sử dụng các đường dẫn ảnh có sẵn trong asset của project. FPS không thể vượt giới hạn thực tế của máy/Wallpaper Engine chỉ bằng thay đổi mã nguồn.
