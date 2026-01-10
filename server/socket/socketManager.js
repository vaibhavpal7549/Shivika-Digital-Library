/**
 * Socket.IO Manager
 * 
 * Handles real-time event broadcasting for:
 * - Seat updates (book, release, change)
 * - Payment updates
 * - Profile updates
 * - Admin panel updates
 */

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 */
function initializeSocket(server) {
  const { Server } = require('socket.io');
  
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join user-specific room for targeted updates
    socket.on('join:user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId.substring(0, 8)}... joined their room`);
      }
    });

    // Join admin room for admin-specific updates
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`🛡️ Admin joined admin room: ${socket.id}`);
    });

    // Join seats room for real-time seat updates
    socket.on('join:seats', () => {
      socket.join('seats');
      console.log(`🪑 Client joined seats room: ${socket.id}`);
    });

    // Leave rooms
    socket.on('leave:user', (userId) => {
      if (userId) {
        socket.leave(`user:${userId}`);
      }
    });

    socket.on('leave:admin', () => {
      socket.leave('admin');
    });

    socket.on('leave:seats', () => {
      socket.leave('seats');
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} - ${reason}`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized');
  }
  return io;
}

// ============================================
// SEAT EVENTS
// ============================================

/**
 * Emit seat booked event
 * @param {Object} data - { seatNumber, userId, userEmail, userName, bookedAt, validUntil }
 */
function emitSeatBooked(data) {
  if (!io) return;
  
  const eventData = {
    type: 'SEAT_BOOKED',
    seatNumber: data.seatNumber,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    bookedAt: data.bookedAt,
    validUntil: data.validUntil,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all clients watching seats
  io.to('seats').emit('seat:update', eventData);
  
  // Notify admin panel
  io.to('admin').emit('admin:seat:update', eventData);
  
  // Notify the specific user
  if (data.userId) {
    io.to(`user:${data.userId}`).emit('user:seat:update', eventData);
  }

  console.log(`📢 Emitted seat:booked for seat ${data.seatNumber}`);
}

/**
 * Emit seat released event
 * @param {Object} data - { seatNumber, userId }
 */
function emitSeatReleased(data) {
  if (!io) return;
  
  const eventData = {
    type: 'SEAT_RELEASED',
    seatNumber: data.seatNumber,
    userId: data.userId,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all clients watching seats
  io.to('seats').emit('seat:update', eventData);
  
  // Notify admin panel
  io.to('admin').emit('admin:seat:update', eventData);
  
  // Notify the specific user
  if (data.userId) {
    io.to(`user:${data.userId}`).emit('user:seat:update', eventData);
  }

  console.log(`📢 Emitted seat:released for seat ${data.seatNumber}`);
}

/**
 * Emit seat changed event (user switched seats)
 * @param {Object} data - { oldSeatNumber, newSeatNumber, userId, userEmail }
 */
function emitSeatChanged(data) {
  if (!io) return;
  
  const eventData = {
    type: 'SEAT_CHANGED',
    oldSeatNumber: data.oldSeatNumber,
    newSeatNumber: data.newSeatNumber,
    userId: data.userId,
    userEmail: data.userEmail,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all clients watching seats
  io.to('seats').emit('seat:update', eventData);
  
  // Notify admin panel
  io.to('admin').emit('admin:seat:update', eventData);
  
  // Notify the specific user
  if (data.userId) {
    io.to(`user:${data.userId}`).emit('user:seat:update', eventData);
  }

  console.log(`📢 Emitted seat:changed from ${data.oldSeatNumber} to ${data.newSeatNumber}`);
}

// ============================================
// PAYMENT EVENTS
// ============================================

/**
 * Emit payment completed event
 * @param {Object} data - { userId, amount, paymentId, seatNumber, type }
 */
function emitPaymentCompleted(data) {
  if (!io) return;
  
  const eventData = {
    type: 'PAYMENT_COMPLETED',
    userId: data.userId,
    amount: data.amount,
    paymentId: data.paymentId,
    seatNumber: data.seatNumber,
    paymentType: data.type,
    timestamp: new Date().toISOString()
  };

  // Notify the specific user
  if (data.userId) {
    io.to(`user:${data.userId}`).emit('user:payment:update', eventData);
  }
  
  // Notify admin panel
  io.to('admin').emit('admin:payment:update', eventData);

  console.log(`📢 Emitted payment:completed for user ${data.userId?.substring(0, 8)}...`);
}

/**
 * Emit payment status update
 * @param {Object} data - { userId, paymentStatus }
 */
function emitPaymentStatusUpdate(data) {
  if (!io) return;
  
  const eventData = {
    type: 'PAYMENT_STATUS_UPDATE',
    userId: data.userId,
    paymentStatus: data.paymentStatus,
    timestamp: new Date().toISOString()
  };

  // Notify the specific user
  if (data.userId) {
    io.to(`user:${data.userId}`).emit('user:payment:update', eventData);
  }
  
  // Notify admin panel
  io.to('admin').emit('admin:payment:update', eventData);

  console.log(`📢 Emitted payment:status for user ${data.userId?.substring(0, 8)}...`);
}

// ============================================
// PROFILE EVENTS
// ============================================

/**
 * Emit profile updated event
 * @param {Object} data - { userId, name, email, phone, ... }
 */
function emitProfileUpdated(data) {
  if (!io) return;
  
  const eventData = {
    type: 'PROFILE_UPDATED',
    userId: data.userId || data.firebaseUid,
    name: data.name,
    email: data.email,
    phone: data.phone,
    timestamp: new Date().toISOString()
  };

  // Notify the specific user
  if (eventData.userId) {
    io.to(`user:${eventData.userId}`).emit('user:profile:update', eventData);
  }
  
  // Notify admin panel
  io.to('admin').emit('admin:profile:update', eventData);

  console.log(`📢 Emitted profile:updated for user ${eventData.userId?.substring(0, 8)}...`);
}

/**
 * Emit user registered event
 * @param {Object} data - { userId, name, email }
 */
function emitUserRegistered(data) {
  if (!io) return;
  
  const eventData = {
    type: 'USER_REGISTERED',
    userId: data.userId || data.firebaseUid,
    name: data.name,
    email: data.email,
    timestamp: new Date().toISOString()
  };

  // Notify admin panel of new user
  io.to('admin').emit('admin:user:new', eventData);

  console.log(`📢 Emitted user:registered for ${data.email}`);
}

// ============================================
// ADMIN EVENTS
// ============================================

/**
 * Emit stats update for admin dashboard
 * @param {Object} stats - { totalUsers, totalSeats, bookedSeats, revenue, ... }
 */
function emitAdminStats(stats) {
  if (!io) return;
  
  const eventData = {
    type: 'ADMIN_STATS_UPDATE',
    stats,
    timestamp: new Date().toISOString()
  };

  io.to('admin').emit('admin:stats:update', eventData);
  console.log(`📢 Emitted admin:stats update`);
}

/**
 * Broadcast a general notification
 * @param {Object} notification - { title, message, type }
 */
function broadcastNotification(notification) {
  if (!io) return;
  
  const eventData = {
    ...notification,
    timestamp: new Date().toISOString()
  };

  io.emit('notification', eventData);
  console.log(`📢 Broadcast notification: ${notification.title}`);
}

module.exports = {
  initializeSocket,
  getIO,
  // Seat events
  emitSeatBooked,
  emitSeatReleased,
  emitSeatChanged,
  // Payment events
  emitPaymentCompleted,
  emitPaymentStatusUpdate,
  // Profile events
  emitProfileUpdated,
  emitUserRegistered,
  // Admin events
  emitAdminStats,
  broadcastNotification
};
