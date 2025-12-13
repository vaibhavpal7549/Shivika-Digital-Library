# 🚀 Quick Setup Guide

## Step-by-Step Installation

### 1. Install Dependencies

```bash
# Install all dependencies (root, server, and client)
npm run install-all
```

### 2. Firebase Configuration

#### A. Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Follow the setup wizard

#### B. Enable Authentication
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable:
   - ✅ Email/Password
   - ✅ Google (add OAuth consent screen)
   - ✅ Phone (requires verification)

#### C. Create Realtime Database
1. Go to **Realtime Database** → **Create Database**
2. Choose location (closest to your users)
3. Start in **test mode** (we'll update rules)
4. Copy the database URL

#### D. Set Database Rules
Go to **Realtime Database** → **Rules** and paste:

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

#### E. Get Firebase Config
1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web** icon (`</>`)
4. Copy the config object

#### F. Update Firebase Config
Edit `client/src/firebase/config.js` with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 3. Razorpay Setup

#### A. Create Razorpay Account
1. Go to https://razorpay.com/
2. Sign up for an account
3. Complete KYC verification

#### B. Get API Keys
1. Go to **Settings** → **API Keys**
2. Generate **Test Keys** (for development)
3. Copy **Key ID** and **Key Secret**

#### C. Configure Backend
Create `server/.env` file:

```env
PORT=5000
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
```

#### D. Configure Frontend
Create `client/.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### 4. Initialize Database Structure

The seats will be created automatically when first booking happens. However, you can manually initialize:

1. Go to Firebase Realtime Database
2. Create a `seats` node
3. The structure will be:
   ```
   seats/
     ├── 1/
     ├── 2/
     ├── ...
     └── 60/
   ```

Each seat will have:
- `status`: "vacant" or "booked"
- `userId`: User ID when booked
- `bookedAt`: Timestamp
- `hours`: Booking duration
- `amount`: Payment amount

### 5. Run the Application

```bash
# Run both frontend and backend
npm run dev
```

Or separately:

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm start
```

### 6. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Troubleshooting

### Firebase Auth Issues
- **Phone Auth not working**: Enable Phone authentication in Firebase Console
- **Google Auth not working**: Configure OAuth consent screen in Google Cloud Console
- **Database permission denied**: Check Firebase database rules

### Payment Issues
- **Razorpay not loading**: Check if script is loaded (browser console)
- **Payment verification fails**: Verify webhook secret matches
- **CORS errors**: Ensure backend CORS is enabled

### Real-time Updates Not Working
- Check Firebase database rules allow read access
- Verify Firebase config is correct
- Check browser console for errors

## 📝 Environment Variables Checklist

### Server (`server/.env`)
- [ ] PORT
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET

### Client (`client/.env`)
- [ ] REACT_APP_API_URL
- [ ] REACT_APP_RAZORPAY_KEY_ID

### Firebase (`client/src/firebase/config.js`)
- [ ] apiKey
- [ ] authDomain
- [ ] databaseURL
- [ ] projectId
- [ ] storageBucket
- [ ] messagingSenderId
- [ ] appId

## ✅ Verification Checklist

Before going live, verify:

- [ ] Firebase Authentication working (all 3 methods)
- [ ] Firebase Realtime Database accessible
- [ ] Razorpay test payments working
- [ ] Real-time seat updates working
- [ ] Payment webhook verification working
- [ ] All 60 seats visible
- [ ] Seat status colors correct (green/red)
- [ ] Google Maps embed showing
- [ ] Fee calculator working
- [ ] Responsive design on mobile

## 🎉 You're Ready!

Once all steps are complete, your Library Seat Booking System is ready to use!

