import Joi, { any } from 'joi'
import { StatusCodes } from 'http-status-codes'

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    title: Joi.string().required().min(3).max(50).trim().strict().messages({
      'any.required': 'Title is required (TienPhat)',
      'string.emty': 'Title is not allowed to be emty (TienPhat)',
      'string.min': 'Title length must be at least 3 characters long (TienPhat)',
      'string.max': 'Title length must be less than or equal to 50 characters long (TienPhat)',
      'string.string': 'Title must not have leading whitespace (TienPhat)'
    }),
    description: Joi.string().required().min(3).max(256).trim().strict()
  })
  try {
    console.log(req.body)
    // abortEarly: false -> trường hợp có nhiều lỗi thì trả về hết
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    // next()
    res.status(StatusCodes.CREATED).json({ message: 'POST: APIs created new board' })
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: new Error(error).message
    })
  }
}

export const boardValidation = {
  createNew
}
