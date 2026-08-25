import { StatusCodes } from 'http-status-codes'
import { JwtProvider } from '~/providers/JwtProvider'
import { env } from '~/config/environment'
import ApiError from '~/utils/ApiError'

// Xác thực JWT accessToken nhận từ FE có hợp lệ hay không?
const isAuthorized = async (req, res, next) => {
  // lấy accessToken nằm trong request cookies phía client = withCredentials trong file authorizeAxios
  const clientAccessToken = req.cookies?.accessToken

  if (!clientAccessToken) {
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized! (token not found)'))
    return
  }

  try {
    // B1: giải mã token xem nó có hợp lệ không?
    const accessTokenDecoded = await JwtProvider.verifyToken(clientAccessToken, env.ACCESS_TOKEN_SECRET_SIGNATURE)
    // B2: nếu token hợp lệ -> lưu thông tin giải mã được vào req.jwtdecoded để sử dụng cho các tầng tiếp theo
    req.jwtDecode = accessTokenDecoded
    next()
    // B3: cho request đi tiếp
  } catch (error) {
    // nếu accessToken expired -> trả mã lỗi 410 - GONE cho FE để gọi api refreshToken
    if (error?.message?.includes('jwt expired')) {
      next(new ApiError(StatusCodes.GONE, 'Need to refresh token'))
      return
    }
    // nếu accessToken không hợp lệ do bất cứ điều gì khác mà không phải do expired -> trả mã 401 cho FE và gọi api sign out
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized!'))
  }
}

export const authMiddleware = { isAuthorized }