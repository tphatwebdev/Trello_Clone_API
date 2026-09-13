import Joi from 'joi'
import { EMAIL_RULE, EMAIL_RULE_MESSAGE, OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { GET_DB } from '~/config/mongodb'
import { toObjectId } from '~/utils/formatters'
import { CARD_MEMBER_ACTIONS } from '~/utils/constants'

const CARD_COLLECTION_NAME = 'cards'
const CARD_COLLECTION_SCHEMA = Joi.object({
  boardId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
  columnId: Joi.string().required().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),

  title: Joi.string().required().min(3).max(50).trim().strict(),
  description: Joi.string().optional(),

  cover: Joi.string().default(null),
  memberIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  // dữ liệu comments của card sẽ dùng cách nhúng - embedded vào bản ghi Card
  comments: Joi.array().items({
    userId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE),
    userEmail: Joi.string().pattern(EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
    userAvatar: Joi.string(),
    userDisplayName: Joi.string(),
    content: Joi.string(),
    // chỗ này vì dùng hàm $push để thêm comment nên không set default Date.now luôn giống hàm insertOne khi create được
    commentedAt: Joi.date().timestamp()
  }).default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

const INVALID_UPDATE_FIELDS = ['_id', 'boardId', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await CARD_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data) => {
  try {
    const validData = await validateBeforeCreate(data)
    // biến đổi id string sang objectId trước khi lưu
    const newCardToAdd = {
      ...validData,
      boardId: toObjectId(validData.boardId),
      columnId: toObjectId(validData.columnId)
    }
    const createdCard = await GET_DB().collection(CARD_COLLECTION_NAME).insertOne(newCardToAdd)
    return createdCard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (cardId) => {
  try {
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOne({
      _id: toObjectId(cardId)
    })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

const update = async(cardId, updateData) => {
  try {
    // lọc field mà ta không muốn cập nhật
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })
    // đối với những dữ liệu liên quan đến objectId thì biến đổi ở đây
    if (updateData.columnId) {
      updateData.columnId = toObjectId(updateData.columnId)
    }

    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: toObjectId(cardId) },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

const deleteManyByColumnId = async (columnId) => {
  try {
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).deleteMany({
      columnId: toObjectId(columnId)
    })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * đây 1 phần tử comment vào mảng comments
 * unshift là để đẩy phần tử vào đầu mảng
 * vẫn dùng $push (mặc định đẩy vào cuối mảng) nhưng bọc data vào Array để trong $each và chỉ định $position: 0
 */
const unshiftNewComment = async (cardId, commentData) => {
  try {
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: toObjectId(cardId) },
      { $push: { comments: { $each: [commentData], $position: 0 } } },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * hàm này xử lý cập nhật thêm hoặc xoá member khỏi card dựa theo Action
 * sẽ dùng $push để thêm hoặc $pull để loại bỏ ($pull: lấy 1 phần tử ra khỏi mảng và xoá đi)
 */
const updateMembers = async (cardId, incomingMemberInfo) => {
  try {
    // Tạo ra một biến updateCondition ban đầu là rỗng
    let updateCondition = {}
    if (incomingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD) {
      updateCondition = { $push: { memberIds: toObjectId(incomingMemberInfo.userId) } }
    }
    if (incomingMemberInfo.action === CARD_MEMBER_ACTIONS.REMOVE) {
      updateCondition = { $pull: { memberIds: toObjectId(incomingMemberInfo.userId) } }
    }
    const result = await GET_DB().collection(CARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: toObjectId(cardId) },
      updateCondition,
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

export const cardModel = {
  CARD_COLLECTION_NAME,
  CARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  update,
  deleteManyByColumnId,
  unshiftNewComment,
  updateMembers
}
