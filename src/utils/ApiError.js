/**
 * Định nghĩa riêng một Class ApiError kế thừa class Error sẵn
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    // Gọi tới hàm khởi tạo của class Error (class cha)
    // Thằng cha (Error) có property message rồi nên gọi nó luôn trong super cho gọn
    super(message)
    // Tên của cái custom Error này, nếu không set thì mặc định nó sẽ kế thừa là "Error"
    this.name = 'ApiError'
    this.statusCode = statusCode
    // Ghi lại Stack Trace (dấu vết ngăn xếp) để thuận tiện cho việc debug
    Error.captureStackTrace(this, this.constructor)
  }
}

export default ApiError