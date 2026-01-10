const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const connectDB = require('./server/config/database');
const Seat = require('./server/models/Seat');

async function resetSeat1() {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    const seat = await Seat.findOne({ seatNumber: 1 });
    
    if (!seat) {
      console.log('❌ Seat 1 not found');
      process.exit(1);
    }

    console.log('📊 Seat 1 BEFORE reset:');
    console.log({
      isBooked: seat.isBooked,
      status: seat.status,
      displayStatus: seat.displayStatus,
      bookedBy: seat.bookedBy,
      bookedByFirebaseUid: seat.bookedByFirebaseUid
    });

    // Reset all booking fields
    seat.isBooked = false;
    seat.status = 'available';
    seat.displayStatus = 'green';
    seat.bookedBy = null;
    seat.bookedByFirebaseUid = null;
    seat.bookingDate = null;
    seat.expiryDate = null;
    seat.shift = null;
    seat.lastPaymentId = null;

    await seat.save();

    console.log('\n✅ Seat 1 AFTER reset:');
    console.log({
      isBooked: seat.isBooked,
      status: seat.status,
      displayStatus: seat.displayStatus
    });

    console.log('\n✅ Seat 1 has been reset successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetSeat1();
