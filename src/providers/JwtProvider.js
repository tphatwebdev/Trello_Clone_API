import JWt from 'jsonwebtoken'

/**
 * function tạo mới token cần 3 tham số đầu vào
 * userInfo: những thông tin muốn đính kèm vào token
 * secretSignature
 * tokenLife
 */
const generateToken = async (userInfo, secretSignature, tokenLife) => {
  try {
    return JWt.sign(userInfo, secretSignature, { algorithm: 'HS256', expiresIn: tokenLife })
  } catch (error) {
    throw new Error(error)
  }
}
/**Function kiểm tra 1 token có hợp lệ hay không
 * token === secretSignature
 */
const verifyToken = async (token, secretSignature) => {
  try {
    return JWt.verify(token, secretSignature)
  } catch (error) {
    throw new Error(error)
  }
}

export const JwtProvider = {
  generateToken,
  verifyToken
}