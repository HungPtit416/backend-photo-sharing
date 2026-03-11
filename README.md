# Photo Sharing Backend

Backend API cho ứng dụng chia sẻ ảnh với chức năng real-time.

## Công Nghệ

- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- WebSocket (real-time online users)
- Server-Sent Events (real-time notifications)
- Multer (upload ảnh)

## Tính Năng

- Xác thực người dùng (đăng ký, đăng nhập, đăng xuất)
- Quản lý hồ sơ người dùng
- Upload và quản lý ảnh
- Bình luận trên ảnh
- Theo dõi người dùng khác (followers/following)
- Hiển thị số người dùng online real-time
- Token blacklist để đăng xuất an toàn

## Cài Đặt

```bash
npm install
```


## Chạy Ứng Dụng

```bash
npm start
```

Server sẽ chạy tại `http://localhost:3001`

## API Endpoints

### Authentication
- POST `/admin/register` - Đăng ký tài khoản
- POST `/admin/login` - Đăng nhập
- POST `/admin/logout` - Đăng xuất

### User (Protected)
- GET `/api/user/list` - Danh sách người dùng
- GET `/api/user/:id` - Thông tin người dùng cụ thể

### Photo (Protected)
- POST `/api/photo/new` - Upload ảnh mới
- GET `/api/photo/photosOfUser/:id` - Ảnh của người dùng
- POST `/api/photo/:photo_id/comments` - Thêm bình luận
- DELETE `/api/photo/:photo_id` - Xóa ảnh

### Real-time
- WebSocket `/` - Kết nối theo dõi online users
- SSE `/api/stream` - Server-Sent Events cho notifications

## Cấu Trúc Thư Mục

```
├── db/                 # Database models và kết nối
├── routes/             # API routes
├── middleware/         # Authentication middleware
├── realtime/           # WebSocket và SSE
├── images/             # Lưu trữ ảnh upload
└── index.js           # Entry point
```
