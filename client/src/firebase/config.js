import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD_DcpIB6TeVbtN0mhDEpZcvL6w3YKQKXY",
  authDomain: "library-985fe.firebaseapp.com",
  databaseURL: "https://library-985fe-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "library-985fe",
  storageBucket: "library-985fe.firebasestorage.app",
  messagingSenderId: "898972164516",
  appId: "1:898972164516:web:2c811b13f5c3eff6446131",
  measurementId: "G-5DE5Y6H52L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;

