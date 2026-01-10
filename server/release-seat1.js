/**
 * Release Seat 1 using the Seat model's release method
 */

const { User, Seat } = require('./models');
const connectDB = require('./config/db');

async function releaseSeat1() {
  try {
    // Connect to database
    await connectDB();
    console.log('\n🔍 Checking Seat 1...\n');

    // Find Seat 1
    const seat = await Seat.findOne({ seatNumber: 1 });
    
    if (!seat) {
      console.log('❌ Seat 1 not found in database');
      process.exit(0);
    }

    console.log('Current status:');
    console.log('  isBooked:', seat.isBooked);
    console.log('  status:', seat.status);
    console.log('  bookedBy:', seat.bookedBy);
    console.log('  expiryDate:', seat.expiryDate);

    if (!seat.isBooked) {
      console.log('\n✅ Seat 1 is already available');
      process.exit(0);
    }

    console.log('\n🔄 Releasing Seat 1...');

    // Find and update user if exists
    if (seat.bookedByFirebaseUid) {
      const user = await User.findOne({ firebaseUid: seat.bookedByFirebaseUid });
      if (user && user.seat && user.seat.seatNumber === 1) {
        await user.releaseSeat();
        console.log('✅ Updated user record');
      }
    }

    // Use the Seat model's release method
    await seat.release('admin_manual');
    
    console.log('✅ Seat 1 released successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

releaseSeat1();
