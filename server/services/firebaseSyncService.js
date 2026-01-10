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
 */

/**
 * Get Firebase Realtime Database reference
 * @returns {admin.database.Database | null}
 */
const getFirebaseDB = () => {
  try {
    return admin.database();
  } catch (error) {
    console.error('❌ Firebase DB not initialized:', error.message);
    return null;
  }
};

/**
 * Sync a single seat to Firebase RTDB
 * @param {Object} seat - Mongoose Seat document
 * @returns {Promise<boolean>} Success status
 */
const syncSeatToFirebase = async (seat) => {
  const db = getFirebaseDB();
  if (!db) {
    console.warn('⚠️ Firebase not available, skipping seat sync');
    return false;
  }

  try {
    const seatRef = db.ref(`seats/${seat.seatNumber}`);
    
    const seatData = {
      seatNumber: seat.seatNumber,
      status: seat.status || 'available',
      isBooked: seat.isBooked || false,
      bookedBy: seat.bookedByFirebaseUid || null,
      bookedByName: seat.bookedBy?.fullName || null,
      expiryDate: seat.expiryDate ? seat.expiryDate.toISOString() : null,
      bookingDate: seat.bookingDate ? seat.bookingDate.toISOString() : null,
      shift: seat.shift || null,
      zone: seat.zone || 'A',
      displayStatus: seat.displayStatus || 'green',
      updatedAt: new Date().toISOString()
    };

    await seatRef.set(seatData);
    console.log(`✅ Synced seat ${seat.seatNumber} to Firebase`);
    return true;
  } catch (error) {
    console.error(`❌ Firebase sync failed for seat ${seat.seatNumber}:`, error.message);
    // Don't throw - Firebase failure should not break MongoDB operations
    return false;
  }
};

/**
 * Sync multiple seats to Firebase RTDB
 * @param {Array} seats - Array of Mongoose Seat documents
 * @returns {Promise<Object>} Sync results
 */
const syncSeatsToFirebase = async (seats) => {
  const db = getFirebaseDB();
  if (!db) {
    console.warn('⚠️ Firebase not available, skipping seats sync');
    return { success: false, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const seat of seats) {
    const result = await syncSeatToFirebase(seat);
    if (result) synced++;
    else failed++;
  }

  console.log(`📊 Firebase sync complete: ${synced} synced, ${failed} failed`);
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
    console.warn('⚠️ Firebase not available, skipping full sync');
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
 * @param {number} seatNumber - Seat number to remove
 * @returns {Promise<boolean>} Success status
 */
const removeSeatFromFirebase = async (seatNumber) => {
  const db = getFirebaseDB();
  if (!db) {
    console.warn('⚠️ Firebase not available, skipping seat removal');
    return false;
  }

  try {
    const seatRef = db.ref(`seats/${seatNumber}`);
    await seatRef.set({
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
    });
    
    console.log(`✅ Cleared seat ${seatNumber} in Firebase`);
    return true;
  } catch (error) {
    console.error(`❌ Firebase removal failed for seat ${seatNumber}:`, error.message);
    return false;
  }
};

/**
 * Sync booking data to Firebase RTDB (optional)
 * @param {Object} booking - Booking data
 * @returns {Promise<boolean>} Success status
 */
const syncBookingToFirebase = async (booking) => {
  const db = getFirebaseDB();
  if (!db) {
    console.warn('⚠️ Firebase not available, skipping booking sync');
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
    console.log(`✅ Synced booking ${booking._id} to Firebase`);
    return true;
  } catch (error) {
    console.error(`❌ Firebase booking sync failed:`, error.message);
    return false;
  }
};

module.exports = {
  syncSeatToFirebase,
  syncSeatsToFirebase,
  syncAllSeatsToFirebase,
  removeSeatFromFirebase,
  syncBookingToFirebase,
  getFirebaseDB
};
