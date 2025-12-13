# 🚀 Deploy Library Seat Booking System on Render

Complete step-by-step guide to deploy your application on Render.

## 📋 Prerequisites

1. GitHub account
2. Render account (sign up at https://render.com)
3. Firebase project configured
4. Razorpay account with API keys

## 🔧 Step 1: Prepare Your Code

### 1.1 Update Environment Variables

Make sure your code uses environment variables properly (already done in the code).

### 1.2 Create Render Configuration Files

I'll create the necessary files for you.

## 🌐 Step 2: Deploy Backend (Node.js/Express)

### 2.1 Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository
5. Configure the service:
   - **Name**: `library-seat-booking-backend` (or any name you prefer)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node index.js`
   - **Root Directory**: Leave empty (or set to project root)

### 2.2 Add Environment Variables

In the Render dashboard, go to **Environment** tab and add:

```
PORT=10000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
NODE_ENV=production
```

### 2.3 Deploy Backend

1. Click **"Create Web Service"**
2. Wait for deployment to complete
3. Copy the service URL (e.g., `https://library-seat-booking-backend.onrender.com`)

## ⚛️ Step 3: Deploy Frontend (React)

### 3.1 Create Static Site on Render

1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `library-seat-booking-frontend`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/build`

### 3.2 Add Environment Variables

In the **Environment** tab, add:

```
REACT_APP_API_URL=https://your-backend-url.onrender.com
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id
```

**Important**: Replace `your-backend-url.onrender.com` with your actual backend URL from Step 2.3

### 3.3 Deploy Frontend

1. Click **"Create Static Site"**
2. Wait for build and deployment
3. Your frontend will be live at a URL like `https://library-seat-booking-frontend.onrender.com`

## 🔐 Step 4: Update Firebase Configuration

### 4.1 Add Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Add your Render frontend domain (e.g., `library-seat-booking-frontend.onrender.com`)

### 4.2 Update Database Rules (if needed)

Ensure your Firebase Realtime Database rules allow access from your domain.

## 💳 Step 5: Configure Razorpay

### 5.1 Update Webhook URL (Optional)

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Settings → Webhooks
3. Add webhook URL: `https://your-backend-url.onrender.com/api/webhook` (if you add webhook support)

## ✅ Step 6: Verify Deployment

1. Visit your frontend URL
2. Test login/signup
3. Test seat booking
4. Test payment (use test card: 4111 1111 1111 1111)

## 🔄 Step 7: Auto-Deploy Setup

Render automatically deploys when you push to your main branch. To enable:

1. Go to service settings
2. Ensure **"Auto-Deploy"** is enabled
3. Connect to your main branch

## 📝 Important Notes

### Backend URL
- Render provides a free tier with automatic sleep after 15 minutes of inactivity
- First request after sleep may take 30-60 seconds (cold start)
- Consider upgrading to paid plan for always-on service

### Environment Variables
- Never commit `.env` files to GitHub
- Always add environment variables in Render dashboard
- Update frontend `REACT_APP_API_URL` after backend deployment

### CORS
- Backend CORS is already configured to allow all origins
- For production, you may want to restrict to your frontend domain

### Firebase
- Ensure Firebase config in `client/src/firebase/config.js` is correct
- Add Render domain to Firebase authorized domains

## 🐛 Troubleshooting

### Backend not responding
- Check if backend is awake (first request after sleep is slow)
- Verify environment variables are set correctly
- Check Render logs for errors

### Frontend can't connect to backend
- Verify `REACT_APP_API_URL` is correct in frontend environment variables
- Check backend URL is accessible
- Ensure CORS is configured

### Payment not working
- Verify Razorpay keys are set in both frontend and backend
- Check browser console for errors
- Verify backend is running

### Build fails
- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [React Build Optimization](https://create-react-app.dev/docs/production-build/)
- [Firebase Hosting Alternative](https://firebase.google.com/docs/hosting)

