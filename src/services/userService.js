import { StatusCodes } from 'http-status-codes'
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { BrevoProvider } from '~/providers/BrevoProvider'

const createNew = async (reqBody) => {
  try {
    //kiểm tra xem email đã tồn tại hay chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already exists!')
    }

    // tạo data để lưu vào db
    // nameFromEmail: nếu email là nangcomangemve@gmail.com thì sẽ lấy được 'nangcomangemve'
    const nameFromEmail = reqBody.email.split('@')[0]
    const newUser = {
      email: reqBody.email,
      password: bcryptjs.hashSync(reqBody.password, 8),
      username: nameFromEmail,
      verifyToken: uuidv4()
    }
    // thực hiện lưu thông tin user vào db
    const createdUser = await userModel.createNew(newUser)

    const getNewUser = await userModel.findOneById(createdUser.insertedId)
    // gửi email cho người dùng xác thực tài khoản
    const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`
    const customSubject = '[Taskly] Verify your email address'
    const htmlContent = `
      <h2>Verify your email address</h2>
      <p>Hi there,</p>
      <p>Thanks for signing up for <strong>Taskly</strong>.</p>
      <p>Please verify your email address to complete your registration.</p>
      <p><a href="${verificationLink}">Verify Email Address</a></p>
      <p>If you didn't create a Taskly account, you can safely ignore this email.</p>
      <p>
        Best regards,<br />
        <strong>Taskly - Tran Tien Phat</strong>
      </p>
    `
    // gọi tới provider gửi mail
    await BrevoProvider.sendEmail(getNewUser.email, customSubject, htmlContent)
    // return trả dữ liệu về phía Controller
    return pickUser(getNewUser)
  } catch (error) {
    throw error
  }
}

export const userService = {
  createNew
}