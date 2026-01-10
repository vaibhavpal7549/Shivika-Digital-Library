const express = require('express');
const router = express.Router();
const admin = require('../config/firebase-admin');

/**
 * DELETE /api/debug/clear-seat/:seatNumber
 * Clear a seat from Firebase Realtime Database
 * This is a debug endpoint to fix sync issues
 */
router.delete('/clear-seat/:seatNumber', async (req, res) => {
  try {
    const { seatNumber } = req.params;
    const seatNum = parseInt(seatNumber);

    if (isNaN(seatNum) || seatNum < 1 || seatNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number'
      });
    }

    const db = admin.database();
    const seatRef = db.ref(`seats/${seatNum}`);
    
    // Get current data
    const snapshot = await seatRef.once('value');
    const currentData = snapshot.val();
    
    console.log(`🔵 Clearing Seat ${seatNum} from Firebase`);
    console.log('Current data:', currentData);
    
    // Remove from Firebase
    await seatRef.remove();
    
    console.log(`✅ Seat ${seatNum} cleared from Firebase`);
    
    res.json({
      success: true,
      message: `Seat ${seatNum} cleared from Firebase`,
      previousData: currentData
    });

  } catch (error) {
    console.error('❌ Error clearing seat from Firebase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/firebase-seats
 * Get all seats from Firebase Realtime Database
 */
router.get('/firebase-seats', async (req, res) => {
  try {
    const db = admin.database();
    const seatsRef = db.ref('seats');
    const snapshot = await seatsRef.once('value');
    const seats = snapshot.val() || {};

    res.json({
      success: true,
      seats,
      count: Object.keys(seats).length
    });

  } catch (error) {
    console.error('❌ Error fetching Firebase seats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
