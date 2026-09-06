import pick from 'lodash/pick'
import { ObjectId } from 'mongodb'

export const slugify = (val) => {
  if (!val) return ''
  return String(val)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // remove consecutive hyphens
}

export const pickUser = (dataPick) => {
  if (!dataPick) return {}
  return pick(dataPick, ['_id', 'email', 'username', 'displayName', 'avatar', 'role', 'isActive', 'createdAt', 'updatedAt'])
}

/**
 * Chuyển đổi an toàn một giá trị sang BSON ObjectId:
 * - Nếu không có giá trị (null/undefined): Trả về null
 * - Nếu đã là ObjectId: Giữ nguyên
 * - Nếu là string hex 24 ký tự hợp lệ: Chuyển đổi sang ObjectId qua createFromHexString
 * - Các trường hợp còn lại: Fallback về new ObjectId(id)
 */
export const toObjectId = (id) => {
  if (!id) return null
  if (ObjectId.isValid(id)) {
    if (typeof id === 'string') return ObjectId.createFromHexString(id)
    return id
  }
  return new ObjectId(id)
}

/**
 * Chuyển đổi an toàn một mảng ID (dùng cho columnOrderIds, cardOrderIds...)
 */
export const toObjectIds = (ids = []) => {
  if (!Array.isArray(ids)) return []
  return ids.map(toObjectId).filter(Boolean)
}
