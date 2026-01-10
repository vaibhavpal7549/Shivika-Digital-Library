const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shivika_library')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Define Seat schema (simplified)
const seatSchema = new mongoose.Schema({
  seatNumber: Number,
  isBooked: Boolean,
  status: String,
  bookedBy: String,
  bookedByFirebaseUid: String,
  expiryDate: Date,
  shift: String,
  zone: String
}, { timestamps: true });

const Seat = mongoose.model('Seat', seatSchema);

async function checkAndResetSeat1() {
  try {
    console.log('\n🔍 Checking Seat 1 status...\n');
    
    const seat = await Seat.findOne({ seatNumber: 1 });
    
    if (!seat) {
      console.log('❌ Seat 1 not found in database');
      process.exit(0);
    }
    
    console.log('Current Seat 1 status:');
    console.log('  - seatNumber:', seat.seatNumber);
    console.log('  - isBooked:', seat.isBooked);
    console.log('  - status:', seat.status);
    console.log('  - bookedBy:', seat.bookedBy);
    console.log('  - bookedByFirebaseUid:', seat.bookedByFirebaseUid);
    console.log('  - expiryDate:', seat.expiryDate);
    console.log('  - shift:', seat.shift);
    console.log('  - zone:', seat.zone);
    
    // Check if seat should be available
    if (seat.isBooked) {
      console.log('\n⚠️  Seat 1 is marked as booked. Resetting to available...\n');
      
      // Reset seat to available
      seat.isBooked = false;
      seat.status = 'available';
      seat.bookedBy = null;
      seat.bookedByFirebaseUid = null;
      seat.expiryDate = null;
      seat.shift = null;
      
      await seat.save();
      
      console.log('✅ Seat 1 has been reset to available');
    } else {
      console.log('\n✅ Seat 1 is already available');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the check
checkAndResetSeat1();
