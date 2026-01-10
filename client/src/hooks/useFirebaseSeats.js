import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../firebase/config'; // Adjust path as needed

/**
 * ============================================
 * FIREBASE REALTIME SEAT LISTENER HOOK
 * ============================================
 * 
 * Purpose: Listen to Firebase RTDB for real-time seat updates
 * 
 * Architecture:
 * - Firebase RTDB = Read-Only (backend writes, frontend reads)
 * - Real-time updates across all users
 * - NO writes from frontend
 * 
 * Usage:
 * const { seats, loading, error } = useFirebaseSeats();
 */

/**
 * Hook to listen to all seats in Firebase RTDB
 * @returns {Object} { seats, loading, error }
 */
export const useFirebaseSeats = () => {
  const [seats, setSeats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!database) {
      setError('Firebase not configured');
      setLoading(false);
      return;
    }

    const seatsRef = ref(database, 'seats');

    const unsubscribe = onValue(
      seatsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          setSeats(data || {});
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error processing Firebase data:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      off(seatsRef);
    };
  }, []);

  return { seats, loading, error };
};

/**
 * Hook to listen to a single seat in Firebase RTDB
 * @param {number} seatNumber - Seat number to listen to
 * @returns {Object} { seat, loading, error }
 */
export const useFirebaseSeat = (seatNumber) => {
  const [seat, setSeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!database || !seatNumber) {
      setLoading(false);
      return;
    }

    const seatRef = ref(database, `seats/${seatNumber}`);

    const unsubscribe = onValue(
      seatRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          setSeat(data);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error(`Error processing seat ${seatNumber}:`, err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error(`Firebase listener error for seat ${seatNumber}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      off(seatRef);
    };
  }, [seatNumber]);

  return { seat, loading, error };
};

/**
 * Example usage in a component:
 * 
 * import { useFirebaseSeats } from './hooks/useFirebaseSeats';
 * 
 * function SeatsGrid() {
 *   const { seats, loading, error } = useFirebaseSeats();
 *   
 *   if (loading) return <div>Loading seats...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   
 *   return (
 *     <div className="seats-grid">
 *       {Object.values(seats).map(seat => (
 *         <SeatCard 
 *           key={seat.seatNumber} 
 *           seat={seat}
 *           // Real-time updates will trigger re-render automatically
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 */
