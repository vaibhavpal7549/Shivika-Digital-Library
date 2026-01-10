const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, 'server', 'config', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://shivika-digital-library-default-rtdb.firebaseio.com'
});

const db = admin.database();

async function clearSeat1FromFirebase() {
  try {
    console.log('🔵 Checking Seat 1 in Firebase...');
    
    const seatRef = db.ref('seats/1');
    const snapshot = await seatRef.once('value');
    const seatData = snapshot.val();
    
    console.log('📊 Seat 1 in Firebase BEFORE:', JSON.stringify(seatData, null, 2));
    
    if (seatData) {
      // Delete Seat 1 from Firebase
      await seatRef.remove();
      console.log('✅ Seat 1 removed from Firebase');
    } else {
      console.log('ℹ️ Seat 1 not found in Firebase');
    }
    
    // Verify deletion
    const verifySnapshot = await seatRef.once('value');
    console.log('📊 Seat 1 in Firebase AFTER:', verifySnapshot.val());
    
    console.log('\n✅ Done! Refresh your browser to see Seat 1 as available.');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearSeat1FromFirebase();
