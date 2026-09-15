const admin = require('firebase-admin');

/**
 * ============================================
 * FIREBASE REALTIME DATABASE SYNC SERVICE
 * ============================================
 * 
 * Purpose: Sync MongoDB seat data to Firebase RTDB for real-time updates
 * 
 * Architecture:
 * - MongoDB = Source of Truth (all writes)
 * - Firebase RTDB = Read-Only Mirror (real-time sync)
 * - Backend ONLY writes to Firebase
 * - Frontend ONLY reads from Firebase
 * 
 * Data Flow:
 * User Action → Backend → MongoDB (WRITE) → Firebase (SYNC) → All Clients (READ)
 * 
 * Reliability:
 * - Retry with exponential backoff (up to 3 attempts)
 * - Idempotent sync (uses set() — safe to re-run)
 * - Firebase failure never blocks MongoDB operations
 * - Structured logging for debugging sync issues
 */

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500; // 500ms, 1000ms, 2000ms

/**
 * Get Firebase Realtime Database reference
 * @returns {admin.database.Database | null}
 */
const getFirebaseDB = () => {
  try {
    if (!admin.apps.length) {
      return null;
    }
    return admin.database();
  } catch (error) {
    console.error('❌ Firebase DB not initialized:', error.message);
    return null;
  }
};

/**
 * Sleep helper for retry backoff
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Structured sync log
 * @param {'SUCCESS'|'FAILED'|'RETRY'|'SKIP'} status
 * @param {string} operation - e.g. 'syncSeat', 'removeSeat'
 * @param {Object} details - Additional context
 */
const logSync = (status, operation, details = {}) => {
  const timestamp = new Date().toISOString();
  const seatInfo = details.seatNumber ? `Seat: ${details.seatNumber}` : '';
  const statusInfo = details.mongoStatus ? `MongoDB: ${details.mongoStatus}` : '';
  const firebaseInfo = details.firebaseStatus ? `Firebase: ${details.firebaseStatus}` : '';
  const errorInfo = details.error ? `Error: ${details.error}` : '';
  const retryInfo = details.attempt ? `Attempt: ${details.attempt}/${MAX_RETRIES}` : '';

  const parts = [
    `SYNC ${status}`,
    operation,
    seatInfo,
    statusInfo,
    firebaseInfo,
    retryInfo,
    errorInfo
  ].filter(Boolean).join(' | ');

  if (status === 'SUCCESS') {
    console.log(`✅ ${parts}`);
  } else if (status === 'FAILED') {
    console.error(`❌ ${parts}`);
  } else if (status === 'RETRY') {
    console.warn(`🔄 ${parts}`);
  } else if (status === 'SKIP') {
    console.warn(`⚠️ ${parts}`);
  }
};

/**
 * Build the Firebase seat data object from a MongoDB seat document
 * @param {Object} seat - Mongoose Seat document (or lean object)
 * @returns {Object} Firebase-safe seat data
 */
const buildSeatData = (seat) => {
  return {
    seatNumber: seat.seatNumber,
    status: seat.status || 'available',
    isBooked: seat.isBooked || false,
    bookedBy: seat.bookedByFirebaseUid || null,
    bookedByName: seat.bookedBy?.fullName || null,
    expiryDate: seat.expiryDate ? (seat.expiryDate instanceof Date ? seat.expiryDate.toISOString() : seat.expiryDate) : null,
    bookingDate: seat.bookingDate ? (seat.bookingDate instanceof Date ? seat.bookingDate.toISOString() : seat.bookingDate) : null,
    shift: seat.shift || null,
    zone: seat.zone || 'A',
    displayStatus: seat.displayStatus || 'green',
    updatedAt: new Date().toISOString()
  };
};

/**
 * Sync a single seat to Firebase RTDB with retry
 * @param {Object} seat - Mongoose Seat document
 * @returns {Promise<boolean>} Success status
 */
const syncSeatToFirebase = async (seat) => {
  const db = getFirebaseDB();
  if (!db) {
    logSync('SKIP', 'syncSeat', { seatNumber: seat.seatNumber, error: 'Firebase not available' });
    return false;
  }

  const seatData = buildSeatData(seat);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const seatRef = db.ref(`seats/${seat.seatNumber}`);
      await seatRef.set(seatData);

      logSync('SUCCESS', 'syncSeat', {
        seatNumber: seat.seatNumber,
        mongoStatus: seatData.status,
        firebaseStatus: seatData.status
      });
      return true;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logSync('RETRY', 'syncSeat', {
          seatNumber: seat.seatNumber,
          attempt,
          error: error.message
        });
        await sleep(delay);
      } else {
        logSync('FAILED', 'syncSeat', {
          seatNumber: seat.seatNumber,
          attempt,
          mongoStatus: seatData.status,
          error: error.message
        });
      }
    }
  }

  // Don't throw - Firebase failure should not break MongoDB operations
  return false;
};

/**
 * Sync multiple seats to Firebase RTDB
 * @param {Array} seats - Array of Mongoose Seat documents
 * @returns {Promise<Object>} Sync results
 */
const syncSeatsToFirebase = async (seats) => {
  const db = getFirebaseDB();
  if (!db) {
    logSync('SKIP', 'syncSeats', { error: 'Firebase not available' });
    return { success: false, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const seat of seats) {
    const result = await syncSeatToFirebase(seat);
    if (result) synced++;
    else failed++;
  }

  console.log(`📊 Firebase sync complete: ${synced} synced, ${failed} failed out of ${seats.length}`);
  return { success: true, synced, failed };
};

/**
 * Sync all seats from MongoDB to Firebase RTDB (initial sync)
 * @param {Model} SeatModel - Mongoose Seat model
 * @returns {Promise<Object>} Sync results
 */
const syncAllSeatsToFirebase = async (SeatModel) => {
  const db = getFirebaseDB();
  if (!db) {
    logSync('SKIP', 'syncAllSeats', { error: 'Firebase not available' });
    return { success: false, synced: 0, failed: 0 };
  }

  try {
    console.log('🔄 Starting full seat sync to Firebase...');
    const seats = await SeatModel.find({}).lean();
    
    if (!seats || seats.length === 0) {
      console.log('⚠️ No seats found in MongoDB');
      return { success: true, synced: 0, failed: 0 };
    }

    const result = await syncSeatsToFirebase(seats);
    console.log(`✅ Full sync complete: ${result.synced}/${seats.length} seats synced`);
    return result;
  } catch (error) {
    console.error('❌ Full Firebase sync failed:', error.message);
    return { success: false, synced: 0, failed: 0, error: error.message };
  }
};

/**
 * Remove seat data from Firebase RTDB (when seat is released)
 * Sets seat to available state instead of deleting.
 * @param {number} seatNumber - Seat number to release
 * @returns {Promise<boolean>} Success status
 */
const removeSeatFromFirebase = async (seatNumber) => {
  const db = getFirebaseDB();
  if (!db) {
    logSync('SKIP', 'removeSeat', { seatNumber, error: 'Firebase not available' });
    return false;
  }

  const availableData = {
    seatNumber,
    status: 'available',
    isBooked: false,
    bookedBy: null,
    bookedByName: null,
    expiryDate: null,
    bookingDate: null,
    shift: null,
    displayStatus: 'green',
    updatedAt: new Date().toISOString()
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const seatRef = db.ref(`seats/${seatNumber}`);
      await seatRef.set(availableData);

      logSync('SUCCESS', 'removeSeat', {
        seatNumber,
        mongoStatus: 'available',
        firebaseStatus: 'available'
      });
      return true;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logSync('RETRY', 'removeSeat', {
          seatNumber,
          attempt,
          error: error.message
        });
        await sleep(delay);
      } else {
        logSync('FAILED', 'removeSeat', {
          seatNumber,
          attempt,
          error: error.message
        });
      }
    }
  }

  return false;
};

/**
 * Sync booking data to Firebase RTDB (optional)
 * @param {Object} booking - Booking data
 * @returns {Promise<boolean>} Success status
 */
const syncBookingToFirebase = async (booking) => {
  const db = getFirebaseDB();
  if (!db) {
    logSync('SKIP', 'syncBooking', { error: 'Firebase not available' });
    return false;
  }

  try {
    const bookingRef = db.ref(`bookings/${booking._id}`);
    
    const bookingData = {
      bookingId: booking._id.toString(),
      seatNumber: booking.seatNumber,
      userId: booking.userId || booking.firebaseUid,
      status: booking.status || 'active',
      createdAt: booking.createdAt ? booking.createdAt.toISOString() : new Date().toISOString(),
      expiryDate: booking.expiryDate ? booking.expiryDate.toISOString() : null,
      updatedAt: new Date().toISOString()
    };

    await bookingRef.set(bookingData);
    logSync('SUCCESS', 'syncBooking', { seatNumber: booking.seatNumber });
    return true;
  } catch (error) {
    logSync('FAILED', 'syncBooking', { seatNumber: booking.seatNumber, error: error.message });
    return false;
  }
};

/**
 * Reconcile all seats between MongoDB and Firebase.
 * Uses MongoDB as authoritative source.
 * Idempotent: safe to run multiple times.
 * 
 * @param {Model} SeatModel - Mongoose Seat model
 * @returns {Promise<Object>} Reconciliation report
 */
const reconcileAllSeats = async (SeatModel) => {
  const db = getFirebaseDB();
  if (!db) {
    console.warn('⚠️ Firebase not available for reconciliation');
    return { success: false, reason: 'Firebase not available' };
  }

  try {
    console.log('🔄 Starting MongoDB → Firebase reconciliation...');

    // Get all seats from MongoDB
    const mongoSeats = await SeatModel.find({}).lean();
    
    // Get all seats from Firebase
    const firebaseSnapshot = await db.ref('seats').once('value');
    const firebaseSeats = firebaseSnapshot.val() || {};

    let matched = 0;
    let mismatched = 0;
    let fixed = 0;
    let missingInFirebase = 0;
    const mismatches = [];

    for (const mongoSeat of mongoSeats) {
      const fbSeat = firebaseSeats[mongoSeat.seatNumber];

      if (!fbSeat) {
        // Seat missing in Firebase
        missingInFirebase++;
        mismatches.push({
          seatNumber: mongoSeat.seatNumber,
          type: 'MISSING_IN_FIREBASE',
          mongo: mongoSeat.status,
          firebase: 'MISSING'
        });

        // Sync to Firebase
        const synced = await syncSeatToFirebase(mongoSeat);
        if (synced) fixed++;
        continue;
      }

      // Compare status
      const mongoStatus = mongoSeat.status || 'available';
      const fbStatus = fbSeat.status || 'available';
      const mongoBooked = mongoSeat.isBooked || false;
      const fbBooked = fbSeat.isBooked || false;

      if (mongoStatus !== fbStatus || mongoBooked !== fbBooked) {
        mismatched++;
        mismatches.push({
          seatNumber: mongoSeat.seatNumber,
          type: 'STATUS_MISMATCH',
          mongo: `${mongoStatus} (booked=${mongoBooked})`,
          firebase: `${fbStatus} (booked=${fbBooked})`
        });

        // Fix: sync MongoDB → Firebase
        const synced = await syncSeatToFirebase(mongoSeat);
        if (synced) fixed++;
      } else {
        matched++;
      }
    }

    // Check for seats in Firebase that don't exist in MongoDB
    const mongoSeatNumbers = new Set(mongoSeats.map(s => s.seatNumber));
    let extraInFirebase = 0;
    for (const fbSeatNum of Object.keys(firebaseSeats)) {
      const num = parseInt(fbSeatNum);
      if (!mongoSeatNumbers.has(num)) {
        extraInFirebase++;
        mismatches.push({
          seatNumber: num,
          type: 'EXTRA_IN_FIREBASE',
          mongo: 'MISSING',
          firebase: firebaseSeats[fbSeatNum].status
        });
        // Don't delete from Firebase — just log it
      }
    }

    const report = {
      success: true,
      timestamp: new Date().toISOString(),
      totalMongoSeats: mongoSeats.length,
      totalFirebaseSeats: Object.keys(firebaseSeats).length,
      matched,
      mismatched,
      fixed,
      missingInFirebase,
      extraInFirebase,
      mismatches: mismatches.length > 0 ? mismatches : 'NONE'
    };

    console.log('📊 Reconciliation Report:');
    console.log(`   Total MongoDB seats: ${report.totalMongoSeats}`);
    console.log(`   Total Firebase seats: ${report.totalFirebaseSeats}`);
    console.log(`   Matched: ${report.matched}`);
    console.log(`   Mismatched: ${report.mismatched}`);
    console.log(`   Fixed: ${report.fixed}`);
    console.log(`   Missing in Firebase: ${report.missingInFirebase}`);
    console.log(`   Extra in Firebase: ${report.extraInFirebase}`);

    if (mismatches.length > 0) {
      console.log('   Mismatches:');
      mismatches.forEach(m => {
        console.log(`     Seat ${m.seatNumber}: ${m.type} — MongoDB: ${m.mongo}, Firebase: ${m.firebase}`);
      });
    }

    return report;
  } catch (error) {
    console.error('❌ Reconciliation failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  syncSeatToFirebase,
  syncSeatsToFirebase,
  syncAllSeatsToFirebase,
  removeSeatFromFirebase,
  syncBookingToFirebase,
  reconcileAllSeats,
  getFirebaseDB
};
