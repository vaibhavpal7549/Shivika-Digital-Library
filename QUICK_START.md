# ⚡ Quick Start (5 Minutes)

## Prerequisites
- Node.js 16+ installed
- Firebase account
- Razorpay account (test mode is fine)

## Fast Setup

### 1. Install Everything
```bash
npm run install-all
```

### 2. Firebase Setup (2 minutes)
1. Create project at https://console.firebase.google.com/
2. Enable Authentication: Email, Google, Phone
3. Create Realtime Database
4. Copy config → paste in `client/src/firebase/config.js`

### 3. Razorpay Setup (1 minute)
1. Get test keys from https://razorpay.com/dashboard
2. Create `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=xxx
   ```
3. Create `client/.env`:
   ```
   REACT_APP_API_URL=http://localhost:5000
   REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxx
   ```

### 4. Run
```bash
npm run dev
```

### 5. Test
- Open http://localhost:3000
- Sign up with email
- Go to Seats page
- Click a red (vacant) seat
- Book and pay (use Razorpay test card: 4111 1111 1111 1111)

## 🎉 Done!

Your library seat booking system is running!

For detailed setup, see [SETUP.md](./SETUP.md)

