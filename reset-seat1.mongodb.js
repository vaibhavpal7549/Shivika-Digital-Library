// MongoDB Playground Script to Reset Seat 1
// Run this in MongoDB Compass or VS Code MongoDB extension

// Use your database
use('library-management');

// 1. Check current status of Seat 1
print('=== SEAT 1 BEFORE RESET ===');
db.seats.findOne({ seatNumber: 1 });

// 2. Reset Seat 1 to available
print('\n=== RESETTING SEAT 1 ===');
db.seats.updateOne(
  { seatNumber: 1 },
  {
    $set: {
      isBooked: false,
      status: 'available',
      displayStatus: 'green',
      bookedBy: null,
      bookedByFirebaseUid: null,
      bookingDate: null,
      expiryDate: null,
      shift: null,
      lastPaymentId: null
    }
  }
);

// 3. Verify the update
print('\n=== SEAT 1 AFTER RESET ===');
db.seats.findOne({ seatNumber: 1 });

// 4. Also check if any user has Seat 1 assigned
print('\n=== CHECKING USERS WITH SEAT 1 ===');
db.users.find({ 'seat.seatNumber': 1 });

// 5. If any user has Seat 1, clear it
print('\n=== CLEARING SEAT 1 FROM USERS ===');
db.users.updateMany(
  { 'seat.seatNumber': 1 },
  {
    $set: {
      'seat.seatNumber': null,
      'seat.seatStatus': 'released',
      'seat.bookingDate': null,
      'seat.expiryDate': null
    }
  }
);

print('\n✅ Seat 1 has been reset!');
print('Refresh your browser to see the updated seat status.');
