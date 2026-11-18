PHYSASSESS – VIẾT LẠI PHẦN LUYỆN TẬP BẰNG GEMINI 2.5 FLASH

1. CÁCH HOẠT ĐỘNG
- Phần Luyện tập không dùng ngân hàng câu hỏi tĩnh nữa.
- Giáo viên chọn một bài trong Chương II – Động học và chọn học sinh.
- Khi nhấn “Tạo đề mới bằng AI”, website lấy nội dung đúng bài đó từ mục Sổ tay kiến thức và gửi tới Netlify Function.
- Netlify Function gọi Gemini API bằng model gemini-2.5-flash.
- Mỗi đề gồm chính xác 15 câu trắc nghiệm (4 lựa chọn, 1 đáp án đúng) và 5 câu trả lời ngắn (có lời giải tham khảo).
- Trắc nghiệm được chấm tự động: 0,4 điểm/câu, tối đa 6 điểm. 5 câu trả lời ngắn tối đa 4 điểm, giáo viên đối chiếu lời giải để chấm.
- Câu hỏi đã tạo được lưu trong localStorage của trình duyệt và gửi kèm trong yêu cầu sau để AI hạn chế lặp. Máy tính/trình duyệt khác không dùng chung danh sách này.

2. CẤU HÌNH NETLIFY
Trong Project configuration > Environment variables, đặt:
GEMINI_API_KEY = API key mới của bạn
GEMINI_MODEL = gemini-2.5-flash

GEMINI_API_KEY phải được đánh dấu Contains secret values. Không đưa API key vào index.html, GitHub hoặc gửi qua tin nhắn.

3. TRIỂN KHAI
- Giải nén ZIP.
- Đưa toàn bộ nội dung thư mục PhysAssess_AI_Quiz lên repository GitHub đã liên kết với Netlify, giữ nguyên cấu trúc:
  public/index.html
  netlify/functions/generate-quiz.mjs
  netlify.toml
- netlify.toml đã đặt publish = "public" và functions = "netlify/functions".
- Lưu biến môi trường rồi deploy lại từ Netlify khi nhóm đã có hạn mức triển khai.
- Sau khi deploy Published, mở website và nhấn Ctrl + F5.

4. KIỂM TRA VÀ LỖI THƯỜNG GẶP
- Không mở trực tiếp /.netlify/functions/generate-quiz bằng thanh địa chỉ. Endpoint chỉ nhận POST từ nút “Tạo đề mới bằng AI”; mở trực tiếp bằng trình duyệt sẽ báo phương thức không được hỗ trợ.
- Nếu gặp lỗi 404/model not found, kiểm tra GEMINI_MODEL có đúng là gemini-2.5-flash và project/API key có quyền gọi model đó hay không.
- Nếu gặp lỗi 429, dự án đã chạm giới hạn RPM/TPM hoặc hạn mức miễn phí; cần chờ hoặc kiểm tra quota trong Google AI Studio.
- Nếu Netlify đang tạm dừng Deploy do hết credits, cần chờ chu kỳ hạn mức mới hoặc nâng cấp gói. Chỉ thay đổi mã nguồn không tự cập nhật website đang xuất bản.

5. LƯU Ý
- Đây là bản mã nguồn đã kiểm tra cú pháp, chưa thể xác nhận gọi Gemini thực tế hoặc deploy thành công vì cần API key và quyền triển khai trong tài khoản của bạn.
- Nội dung tạo đề lấy từ phần Sổ tay kiến thức hiện có trong website. Nếu muốn AI sử dụng thêm tài liệu SGK/SBT chưa được đưa vào Sổ tay, cần tích hợp nội dung tài liệu đó riêng.
