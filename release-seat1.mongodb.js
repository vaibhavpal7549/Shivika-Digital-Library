// MongoDB Playground Script to Release Seat 1
// Run this in MongoDB Compass or VS Code MongoDB extension

// Select the database
use('shivika_library');

// 1. Check current status of Seat 1
console.log('Current Seat 1 status:');
const currentSeat = db.seats.findOne({ seatNumber: 1 });
printjson(currentSeat);

// 2. Release Seat 1 - Update to available
const releaseResult = db.seats.updateOne(
  { seatNumber: 1 },
  {
    $set: {
      isBooked: false,
      status: 'available',
      displayStatus: 'green',
      bookedBy: null,
      bookedByFirebaseUid: null,
      bookedByUserId: null,
      expiryDate: null,
      shift: null,
      lastPaymentId: null,
      bookingDate: null
    }
  }
);

console.log('\nRelease result:');
printjson(releaseResult);

// 3. Also update any user who has this seat
const userUpdate = db.users.updateMany(
  { 'seat.seatNumber': 1 },
  {
    $set: {
      'seat.seatNumber': null,
      'seat.seatStatus': 'inactive',
      'seat.libraryName': null,
      'seat.shift': null,
      'seat.bookingDate': null,
      'seat.expiryDate': null
    }
  }
);

console.log('\nUser update result:');
printjson(userUpdate);

// 4. Verify the update
console.log('\nUpdated Seat 1 status:');
const updatedSeat = db.seats.findOne({ seatNumber: 1 });
printjson(updatedSeat);

console.log('\n✅ Seat 1 has been released!');
