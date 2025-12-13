# Payment Setup Guide

## Issue: "Something went wrong - Payment failed due to merchant issue"

This error occurs when Razorpay is not properly configured. Follow these steps to fix it:

### Step 1: Get Razorpay API Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Sign up or log in
3. Go to **Settings** → **API Keys**
4. Generate **Test Keys** (for development) or **Live Keys** (for production)
5. Copy your **Key ID** and **Key Secret**

### Step 2: Configure Backend (Server)

1. Create or edit `server/.env` file:
```env
PORT=5000
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
```

2. Replace `rzp_test_xxxxxxxxxxxxx` with your actual Key ID
3. Replace `your_key_secret_here` with your actual Key Secret

### Step 3: Configure Frontend (Client)

1. Create or edit `client/.env` file:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

2. Replace `rzp_test_xxxxxxxxxxxxx` with your actual Key ID (same as backend)

### Step 4: Restart Servers

After updating the `.env` files:

1. **Stop** both frontend and backend servers (Ctrl+C)
2. **Restart** the backend:
   ```bash
   cd server
   npm run dev
   ```
3. **Restart** the frontend:
   ```bash
   cd client
   npm start
   ```

Or use the root command:
```bash
npm run dev
```

### Step 5: Verify Configuration

1. Check backend console - should show "Server running on port 5000"
2. Check browser console - should not show Razorpay key errors
3. Try making a payment with Razorpay test card:
   - Card Number: `4111 1111 1111 1111`
   - CVV: Any 3 digits (e.g., `123`)
   - Expiry: Any future date (e.g., `12/25`)

### Common Issues

#### Issue: "Cannot connect to server"
- **Solution**: Make sure backend server is running on port 5000
- Check: Visit `http://localhost:5000/api/health` in browser

#### Issue: "Payment gateway not configured"
- **Solution**: Check that `.env` files exist and have correct values
- Make sure to restart servers after updating `.env` files

#### Issue: "Invalid key_id"
- **Solution**: Verify your Razorpay Key ID is correct
- Make sure you're using Test Keys for development

#### Issue: "Network error"
- **Solution**: Check `REACT_APP_API_URL` in `client/.env` matches your backend URL
- Default should be `http://localhost:5000`

### Testing Payment

For testing, use Razorpay test credentials:
- **Test Card**: 4111 1111 1111 1111
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **Name**: Any name

### Production Setup

For production:
1. Use **Live Keys** instead of Test Keys
2. Update `REACT_APP_API_URL` to your production backend URL
3. Ensure HTTPS is enabled
4. Configure webhook URL in Razorpay dashboard

### Need Help?

If issues persist:
1. Check browser console for errors
2. Check backend console for errors
3. Verify all environment variables are set correctly
4. Ensure both servers are running

