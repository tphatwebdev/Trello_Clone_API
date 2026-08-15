import { MongoClient, ServerApiVersion } from 'mongodb'
import { env } from '~/config/environment'

let trelloDatabaseInstance = null

// khởi tạo 1 đối tượng mongoClientInstance để connect tới mongoDB
const mongoClientInstance = new MongoClient(env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

// kết nối tới Database
export const CONNECT_DB = async () => {
  await mongoClientInstance.connect()
  trelloDatabaseInstance = mongoClientInstance.db(env.DATABASE_NAME)
}
export const CLOSE_DB = async () => {
  await mongoClientInstance.close()
}
// func GET_DB (khong async) export ra trello db instance sau khi connect thành công
// để sử dụng ở nhiều nơi trong code
// chỉ luôn gọi GET_DB khi connect thành công
export const GET_DB = () => {
  if (!trelloDatabaseInstance) throw new Error('Mus connect to db first!')
  return trelloDatabaseInstance
}
