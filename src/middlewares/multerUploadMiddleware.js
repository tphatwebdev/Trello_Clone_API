import multer from 'multer'
import { ALLOW_COMMON_FILE_TYPES, LIMIT_COMMON_FILE_SIZE } from '~/utils/validators'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'

// fuction kiểm tra file nào được chấp nhận
const customFileFilter = (req, file, callback) => {
  // đối với thằng multer, kiểm tra kiểu file thì sử dụng mimetype
  if (!ALLOW_COMMON_FILE_TYPES.includes(file.mimetype)) {
    const errMessage = 'File type is invalid. Only accept jpg, jpeg and png'
    return callback(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, errMessage), null)
  }
  // nếu kiểu file hợp lệ
  return callback(null, true)
}

// khởi tạo function upload bằng multer
const upload = multer({
  limits: { fieldSize: LIMIT_COMMON_FILE_SIZE },
  fileFilter: customFileFilter
})

export const multerUploadMiddleware = { upload }