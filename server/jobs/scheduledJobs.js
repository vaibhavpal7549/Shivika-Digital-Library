const cron = require('node-cron');
const { User, Seat, Payment } = require('../models');
const googleSheetsService = require('../services/googleSheetsService');

/**
 * ============================================
 * SCHEDULED JOBS
 * ============================================
 * 
 * Automated tasks for:
 * 1. Auto-release expired seats
 * 2. Mark overdue payments
 * 3. Sync pending users to Google Sheets
 * 4. Send expiry notifications (future)
 */

let io = null;

/**
 * Initialize scheduled jobs
 * @param {Object} socketIO - Socket.IO instance for real-time updates
 */
const initializeJobs = (socketIO) => {
  io = socketIO;
  
  console.log('⏰ Initializing scheduled jobs...');

  // Job 1: Auto-release expired seats (runs every hour)
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running: Auto-release expired seats');
    await autoReleaseExpiredSeats();
  });

  // Job 2: Mark overdue payments (runs daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running: Mark overdue payments');
    await markOverduePayments();
  });

  // Job 3: Sync pending users to Google Sheets (runs every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Running: Sync pending users to Google Sheets');
    await syncPendingToSheets();
  });

  // Job 4: Highlight expired seats in Google Sheets (runs daily at 6 AM)
  cron.schedule('0 6 * * *', async () => {
    console.log('🔄 Running: Highlight expired seats in Google Sheets');
    await highlightExpiredInSheets();
  });

  // Job 5: Clean up stale data (runs weekly on Sunday at 3 AM)
  cron.schedule('0 3 * * 0', async () => {
    console.log('🔄 Running: Weekly cleanup');
    await weeklyCleanup();
  });

  console.log('✅ Scheduled jobs initialized');
};

/**
 * Auto-release expired seats
 * Runs hourly to find and release seats past their expiry date
 */
const autoReleaseExpiredSeats = async () => {
  try {
    // Find all expired seats
    const expiredSeats = await Seat.find({
      isBooked: true,
      expiryDate: { $lt: new Date() }
    });

    console.log(`📋 Found ${expiredSeats.length} expired seats`);

    for (const seat of expiredSeats) {
      try {
        // Find the user
        const user = await User.findOne({ firebaseUid: seat.bookedByFirebaseUid });

        // Release the seat
        await seat.release('expired');

        // Update user if found
        if (user) {
          await user.releaseSeat();
          user.sheetsSync.syncStatus = 'pending';
          await user.save();

          // Sync to Google Sheets
          googleSheetsService.syncUser(user).catch(err => {
            console.error('⚠️  Sheets sync error:', err.message);
          });
        }

        console.log(`✅ Auto-released seat ${seat.seatNumber} (expired)`);

        // Emit socket event
        if (io) {
          io.emit('seat:released', {
            seatNumber: seat.seatNumber,
            reason: 'expired',
            auto: true
          });
        }

      } catch (error) {
        console.error(`❌ Failed to release seat ${seat.seatNumber}:`, error.message);
      }
    }

    return expiredSeats.length;

  } catch (error) {
    console.error('❌ Auto-release job failed:', error);
    return 0;
  }
};

/**
 * Mark overdue payments
 * Runs daily to update payment status for users past due date
 */
const markOverduePayments = async () => {
  try {
    const now = new Date();

    // Find users with past due dates who are not already marked overdue
    const overdueUsers = await User.find({
      'payment.nextDueDate': { $lt: now },
      'payment.paymentStatus': { $ne: 'overdue' },
      'seat.seatStatus': 'active'
    });

    console.log(`📋 Found ${overdueUsers.length} users with overdue payments`);

    for (const user of overdueUsers) {
      try {
        user.payment.paymentStatus = 'overdue';
        user.sheetsSync.syncStatus = 'pending';
        await user.save();

        // Sync to Google Sheets
        googleSheetsService.syncUser(user).catch(err => {
          console.error('⚠️  Sheets sync error:', err.message);
        });

        console.log(`⚠️  Marked ${user.fullName} as overdue`);

        // Emit socket event
        if (io) {
          io.emit('payment:overdue', {
            userId: user.firebaseUid,
            userName: user.fullName,
            dueDate: user.payment.nextDueDate
          });
        }

      } catch (error) {
        console.error(`❌ Failed to mark user ${user._id} as overdue:`, error.message);
      }
    }

    return overdueUsers.length;

  } catch (error) {
    console.error('❌ Mark overdue job failed:', error);
    return 0;
  }
};

/**
 * Sync pending users to Google Sheets
 * Runs every 15 minutes to catch any failed syncs
 */
const syncPendingToSheets = async () => {
  try {
    // Find users with pending sync
    const pendingUsers = await User.findPendingSync();

    console.log(`📋 Found ${pendingUsers.length} users pending sync`);

    if (pendingUsers.length === 0) return 0;

    // Batch sync
    await googleSheetsService.batchSyncUsers(pendingUsers);

    // Mark as synced
    await User.updateMany(
      { _id: { $in: pendingUsers.map(u => u._id) } },
      { 
        $set: { 
          'sheetsSync.syncStatus': 'synced',
          'sheetsSync.lastSyncAt': new Date()
        } 
      }
    );

    console.log(`✅ Synced ${pendingUsers.length} users to Google Sheets`);

    return pendingUsers.length;

  } catch (error) {
    console.error('❌ Sheets sync job failed:', error);
    return 0;
  }
};

/**
 * Highlight expired seats in Google Sheets
 * Runs daily to visually mark expired seats for admin
 */
const highlightExpiredInSheets = async () => {
  try {
    await googleSheetsService.highlightExpiredSeats();
    console.log('✅ Highlighted expired seats in Google Sheets');
    return true;
  } catch (error) {
    console.error('❌ Highlight expired job failed:', error);
    return false;
  }
};

/**
 * Weekly cleanup of stale data
 * Runs weekly to clean up old records and optimize database
 */
const weeklyCleanup = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // 1. Clean up old pending payments (never completed)
    const deletedPayments = await Payment.deleteMany({
      status: 'pending',
      createdAt: { $lt: thirtyDaysAgo }
    });

    // 2. Clean up old booking history in seats (keep last 90 days)
    await Seat.updateMany(
      {},
      {
        $pull: {
          bookingHistory: {
            bookedAt: { $lt: ninetyDaysAgo }
          }
        }
      }
    );

    console.log(`✅ Weekly cleanup: Removed ${deletedPayments.deletedCount} stale payments`);

    return {
      deletedPayments: deletedPayments.deletedCount
    };

  } catch (error) {
    console.error('❌ Weekly cleanup failed:', error);
    return null;
  }
};

/**
 * Run a specific job manually (for admin or testing)
 */
const runJobManually = async (jobName) => {
  switch (jobName) {
    case 'autoReleaseExpiredSeats':
      return await autoReleaseExpiredSeats();
    case 'markOverduePayments':
      return await markOverduePayments();
    case 'syncPendingToSheets':
      return await syncPendingToSheets();
    case 'highlightExpiredInSheets':
      return await highlightExpiredInSheets();
    case 'weeklyCleanup':
      return await weeklyCleanup();
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
};

/**
 * Get status of all jobs
 */
const getJobStatus = () => {
  return {
    jobs: [
      { name: 'autoReleaseExpiredSeats', schedule: 'Every hour', description: 'Release expired seats' },
      { name: 'markOverduePayments', schedule: 'Daily at midnight', description: 'Mark overdue payments' },
      { name: 'syncPendingToSheets', schedule: 'Every 15 minutes', description: 'Sync to Google Sheets' },
      { name: 'highlightExpiredInSheets', schedule: 'Daily at 6 AM', description: 'Highlight expired in sheets' },
      { name: 'weeklyCleanup', schedule: 'Weekly on Sunday 3 AM', description: 'Clean up stale data' }
    ],
    initialized: true
  };
};

module.exports = {
  initializeJobs,
  autoReleaseExpiredSeats,
  markOverduePayments,
  syncPendingToSheets,
  highlightExpiredInSheets,
  weeklyCleanup,
  runJobManually,
  getJobStatus
};
