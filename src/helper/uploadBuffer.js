import cloudinary from '../config/cloudinary.js'
import streamifier from 'streamifier'

export const uploadBufferToCloudinary = (buffer, options = {}) => {
    // Vì hiện đang đang dùng multer.memoryStorage() ở uploadMiddleware nên dùng upload_stream nếu lưu ở Disk thì upload
    // Nên file up lên -> req.file.buffer
    //Nhận file dạng Buffer từ multer, biến nó thành stream, rồi upload lên Cloudinary để lấy URL ảnh.
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    //createReadStream(buffer) biến buffer thành stream đọc
    streamifier.createReadStream(buffer).pipe(stream)
  })
}