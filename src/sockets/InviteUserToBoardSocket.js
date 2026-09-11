// Param socket sẽ được lây từ thư viện socket.io
export const InviteUserToBoardSocket = (socket) => {
  // Lắng nghe sự kiện mà Client emit lên có tên là: FE_USER_INVITED_TO_BOARD
  socket.on('FE_USER_INVITED_TO_BOARD', (invitation) => {
    // cách làm đơn giản: Emit ngược lại 1 sự kiện về cho client (ngoài trừ người gửi request), rồi để phía FE check
    socket.broadcast.emit('BE_USER_INVITED_TO_BOARD', invitation)
  })
}