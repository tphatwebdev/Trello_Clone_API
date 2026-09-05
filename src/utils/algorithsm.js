// tính toán giá trị skip phục vụ phân trang
export const pagingSkipValue = (page, itemsPerPage) => {
  // luôn đảm bảo giá trị không hợp lệ thì return về 0
  if (!page || !itemsPerPage) return 0
  if (page <= 0 || itemsPerPage <= 0) return 0
  /**logic:
   * ví dụ mỗi page hiển thị 12 sản phẩm (itemsPerPage = 12)
   * case 01: user đứng ở page = 1 thì lấy 1 - 1 = 0 sau đó nhân với 12 bằng 0
   * => giá trị skip = 0, không skip bản ghi
   * case 02: user đứng ở page = 2 thì sẽ lấy 2 - 1 = 1 sau đó 1 nhân với 12 = 12
   * => giá trị skip = 12, skip 12 bản ghi của page trước đó
   */
  return (page - 1) * itemsPerPage
}