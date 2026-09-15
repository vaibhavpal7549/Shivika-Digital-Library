# 📚 Shivika Digital Library

A complete full-stack real-time library seat booking system with payment integration, multi-authentication, and live seat status updates. Your gateway to knowledge and learning.

---

## Live Demo

Check out the live version of the project:

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Here-blue)](https://shivika-digital-library-frontend.onrender.com/)

---

## ✨ Features

- 🪑 **60 Seats Layout** - Visual library-style seat arrangement
- 🟢 **Real-Time Status** - Live seat updates (Green = Booked, Red blinking = Vacant)
- 🔐 **Authentication** - Email/Password, Phone
- 💳 **Payment Integration** - Razorpay payment gateway
- ⚡ **Live Synchronization** - Firebase Realtime Database
- 📍 **Google Maps** - Library location embed
- 💰 **Fee Calculator** - Dynamic hourly rate calculation
- 📱 **Responsive Design** - Works on all devices

## 🚀 Tech Stack

### Frontend
- React 18
- TailwindCSS
- React Router
- Firebase SDK
- Axios
- React Hot Toast

### Backend
- Node.js
- Express.js
- Razorpay SDK
- Firebase Admin SDK

### Database & Real-time
- Firebase Realtime Database

## 📦 Installation

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install all dependencies (root, server, client)
npm run install-all
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication:
   - Email/Password
   - Phone
4. Create Realtime Database
5. Copy your Firebase config

### 3. Update Firebase Config

Edit `client/src/firebase/config.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 4. Razorpay Setup

1. Create account at [Razorpay](https://razorpay.com/)
2. Get your Key ID and Key Secret from Dashboard
3. Create `.env` file in `server/` directory:

```env
PORT=5000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 5. Frontend Environment Variables

Create `.env` file in `client/` directory:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### 6. Firebase Database Rules

Set these rules in Firebase Realtime Database:

```json
{
  "rules": {
    "seats": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## 🏃 Running the Application

### Development Mode (Both Frontend & Backend)

```bash
npm run dev
```

### Run Separately

**Backend:**
```bash
cd server
npm run dev
```

**Frontend:**
```bash
cd client
npm start
```

## 📁 Project Structure

```
library-seat-booking/
├── client/                 # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # Auth context
│   │   ├── firebase/       # Firebase config
│   │   ├── pages/          # Page components
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/                 # Express Backend
│   ├── index.js           # Main server file
│   └── package.json
└── package.json
```

## 🎯 Pages & Routes

- `/` - Home page
- `/login` - Authentication (Email/Password)
- `/dashboard` - Student dashboard with seat status & fee calculator
- `/seats` - Real-time seat layout viewer
- `/booking/:seatNumber` - Booking & payment page

## 💳 Payment Flow

1. User selects seat and hours
2. System calculates total fee
3. Razorpay payment gateway opens
4. User completes payment
5. Payment verified via webhook
6. Seat status updated in Firebase (real-time)
7. All users see the update instantly

## 🔒 Security Features

- Firebase Authentication
- Payment verification via webhook
- Protected routes
- Secure API endpoints

## 🎨 UI Features

- Modern, minimal design
- Smooth animations
- Blinking vacant seats
- Hover effects
- Responsive layout
- Toast notifications

## 📝 Notes

- Default hourly rate: ₹50/hour
- Total seats: 60 (6 rows × 10 columns)
- Payment gateway: Razorpay (India)
- Real-time updates: Firebase Realtime Database

## 🐛 Troubleshooting

1. **Firebase Auth not working**: Check Firebase config and enable auth methods
2. **Payment not working**: Verify Razorpay keys and webhook URL
3. **Real-time updates not showing**: Check Firebase database rules
4. **CORS errors**: Ensure backend CORS is configured correctly

## 📄 License

ISC

## 👨‍💻 Development

For development, use:
- `npm run dev` - Runs both frontend and backend
- `npm run server` - Backend only
- `npm run client` - Frontend only

---

Made with ❤️ for efficient library seat management

# Shivika-Digital-Library


