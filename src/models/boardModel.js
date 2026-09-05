import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { BOARD_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { columnModel } from './columnModel'
import { cardModel } from './cardModel'
import { pagingSkipValue } from '~/utils/algorithsm'

// Define Collection
const BOARD_COLLECTION_NAME = 'boards'
const BOARD_COLLECTION_SCHEMA = Joi.object({
  title: Joi.string().required().min(3).max(50).trim().strict(),
  slug: Joi.string().required().min(3).trim().strict(),
  description: Joi.string().required().min(3).max(256).trim().strict(),
  type: Joi.string().valid(...Object.values(BOARD_TYPES)).required(),
  columnOrderIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  // những Admin của cái board
  ownerIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  // những thành viên của board
  memberIds: Joi.array().items(
    Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE)
  ).default([]),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// chỉ định ra field không muốn cập nhật trong hàm update
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await await BOARD_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (data) => {
  try {
    const validData = await validateBeforeCreate(data)
    const createdBoard = await GET_DB().collection(BOARD_COLLECTION_NAME).insertOne(validData)
    return createdBoard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (boardId) => {
  try {
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOne({
      _id: typeof boardId === 'string' ? ObjectId.createFromHexString(boardId) : boardId
    })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

// query tổng hợp (aggregate) để lấy toàn bộ Columnns và Cards thuộc về board
const getDetails = async (id) => {
  try {
    // const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOne({
    //   _id: typeof id === 'string' ? ObjectId.createFromHexString(id) : id
    // })
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate([
      { $match: {
        _id: typeof id === 'string' ? ObjectId.createFromHexString(id) : id,
        _destroy: false
      } },
      { $lookup: {
        from: columnModel.COLUMN_COLLECTION_NAME,
        localField: '_id',
        foreignField: 'boardId',
        as: 'columns'
      } },
      { $lookup: {
        from: cardModel.CARD_COLLECTION_NAME,
        localField: '_id',
        foreignField: 'boardId',
        as: 'cards'
      } }
    ]).toArray()
    return result[0] || null
  } catch (error) {
    throw new Error(error)
  }
}

// push 1 giá trị columnId vào cuối mảng columnOrderIds
const pushColumnOrderIds = async(column) => {
  try {
    const result = GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: typeof column.boardId === 'string' ? ObjectId.createFromHexString(column.boardId) : column.boardId },
      { $push: { columnOrderIds: typeof column._id === 'string' ? ObjectId.createFromHexString(column._id) : column._id } },
      { returnDocument: 'after' } // Trả về kết quả mới sau khi cập nhật
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

// lấy 1 phần tử columnId ra khỏi mảng columnOrderIds
const pullColumnOrderIds = async(column) => {
  try {
    const result = GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: typeof column.boardId === 'string' ? ObjectId.createFromHexString(column.boardId) : column.boardId },
      { $pull: { columnOrderIds: typeof column._id === 'string' ? ObjectId.createFromHexString(column._id) : column._id } },
      { returnDocument: 'after' } // Trả về kết quả mới sau khi cập nhật
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

const update = async(boardId, updateData) => {
  try {
    // lọc field mà ta không muốn cập nhật
    Object.keys(updateData).forEach(fieldName => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })
    if (updateData.columnOrderIds) {
      updateData.columnOrderIds = updateData.columnOrderIds.map(_id => typeof _id === 'string' ? ObjectId.createFromHexString(_id) : _id )
    }
    const result = GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: typeof boardId === 'string' ? ObjectId.createFromHexString(boardId) : boardId },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

const getBoards = async(userId, page, itemsPerPage) => {
  try {
    const queryConditions = [
      // diều kiện 1: board chưa bị xoá
      { _destroy: false },
      // điều kiện 2: cái thằng userId đang thực hiện request này phải thuộc vào mọt trong 2 cái mảng ownerIds hoặc memberIds, sử dụng toán tử $all của mongo
      { $or: [
        { ownerIds: { $all: [ObjectId.createFromHexString(userId)] } },
        { memberIds: { $all: [ObjectId.createFromHexString(userId)] } }
      ] }
    ]

    const query = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate(
      [
        { $match: { $and: queryConditions } },
        // sort title của board theo a-z (mặc định sẽ bị chữ B đứng trước a thường theo chuẩn bảng mã ASCII)
        { $sort: { title: 1 } },
        // $facet để xử lý nhiều luồng trong 1 query
        { $facet: {
        // luồng 1: query boards
          'queyBoards': [
            { $skip: pagingSkipValue(page, itemsPerPage) }, // bỏ qua số lượng bản ghi của những page trước đó
            { $limit: itemsPerPage } // giới hạn tối đa số lượng bản ghi trả về trên 1 page
          ],
          // luồng 2: query đến tổng tất cả số lượng bảng ghi boards trong db trả về biến countedAllBoards
          'queryTotalBoards': [{ $count: 'countedAllBoards' }]
        } }
      ],
      // Khai báo thuộc tính collation locale 'en' để fix vụ chữ B hoa và a thường ở trên
      { collation: { locale: 'en' } }
    ).toArray()
    console.log('query:', query)
    const res = query[0]
    return {
      boards: res.queyBoards || [],
      totalBoards: res.queryTotalBoards[0]?.countedAllBoards || 0
    }
  } catch (error) {
    throw new Error(error)
  }
}

export const boardModel = {
  BOARD_COLLECTION_NAME,
  BOARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  getDetails,
  pushColumnOrderIds,
  update,
  pullColumnOrderIds,
  getBoards
}
