import Joi from 'joi'
import { GET_DB } from '~/config/mongodb'
import { BOARD_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { toObjectId, toObjectIds } from '~/utils/formatters'
import { columnModel } from './columnModel'
import { cardModel } from './cardModel'
import { userModel } from './userModel'
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
  return await BOARD_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })
}

const createNew = async (userId, data) => {
  try {
    const validData = await validateBeforeCreate(data)
    const newBoardToAdd = {
      ...validData,
      ownerIds: [toObjectId(userId)]
    }
    const createdBoard = await GET_DB().collection(BOARD_COLLECTION_NAME).insertOne(newBoardToAdd)
    return createdBoard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (boardId) => {
  try {
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).findOne({
      _id: toObjectId(boardId)
    })
    return result
  } catch (error) {
    throw new Error(error)
  }
}

// query tổng hợp (aggregate) để lấy toàn bộ Columnns và Cards thuộc về board
const getDetails = async (userId, boardId) => {
  try {
    const queryConditions = [
      { _id: toObjectId(boardId) },
      { _destroy: false },
      { $or: [
        { ownerIds: { $all: [toObjectId(userId)] } },
        { memberIds: { $all: [toObjectId(userId)] } }
      ] }
    ]
    const result = await GET_DB().collection(BOARD_COLLECTION_NAME).aggregate([
      { $match: { $and: queryConditions } },
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
      } },
      {
        $lookup: {
          from: userModel.USER_COLLECTION_NAME,
          localField: 'ownerIds',
          foreignField: '_id',
          as: 'owners',
          // pipeline trong lookup là để xử lý 1 hoặc nhiều luồng cần thiết
          // $project để chỉ định vài field không muốn lấy về bằng cách gán nó giá trị 0
          pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
        }
      },
      { $lookup: {
        from: userModel.USER_COLLECTION_NAME,
        localField: 'memberIds',
        foreignField: '_id',
        as: 'members',
        pipeline: [{ $project: { 'password': 0, 'verifyToken': 0 } }]
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
      { _id: toObjectId(column.boardId) },
      { $push: { columnOrderIds: toObjectId(column._id) } },
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
      { _id: toObjectId(column.boardId) },
      { $pull: { columnOrderIds: toObjectId(column._id) } },
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
      updateData.columnOrderIds = toObjectIds(updateData.columnOrderIds)
    }
    const result = GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: toObjectId(boardId) },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

const getBoards = async(userId, page, itemsPerPage, queryFilters) => {
  try {
    const queryConditions = [
      // diều kiện 1: board chưa bị xoá
      { _destroy: false },
      // điều kiện 2: cái thằng userId đang thực hiện request này phải thuộc vào mọt trong 2 cái mảng ownerIds hoặc memberIds, sử dụng toán tử $all của mongo
      { $or: [
        { ownerIds: { $all: [toObjectId(userId)] } },
        { memberIds: { $all: [toObjectId(userId)] } }
      ] }
    ]

    // xử lý query filter cho từng trường hợp search board, ví dụ search theo title
    if (queryFilters) {
      Object.keys(queryFilters).forEach(key => {
        // queryFilters[key] ví dụ queryFilters[title] nếu phía FE đẩy lên q[title]
        // có phân biệt chữ hoa chữ thường
        // queryConditions.push({ [key]: { $regex: queryFilters[key] } })
        // không phân biệt hoa thường
        queryConditions.push({ [key]: { $regex: new RegExp(queryFilters[key], 'i') } })
      })
    }
    console.log(queryConditions)
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
    const res = query[0]
    return {
      boards: res.queyBoards || [],
      totalBoards: res.queryTotalBoards[0]?.countedAllBoards || 0
    }
  } catch (error) {
    throw new Error(error)
  }
}

const pushMemberIds = async(boardId, userId) => {
  try {
    const result = GET_DB().collection(BOARD_COLLECTION_NAME).findOneAndUpdate(
      { _id: toObjectId(boardId) },
      { $push: { memberIds: toObjectId(userId) } },
      { returnDocument: 'after' } // Trả về kết quả mới sau khi cập nhật
    )
    return result
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
  getBoards,
  pushMemberIds
}
