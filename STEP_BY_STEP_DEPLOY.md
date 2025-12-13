# 📸 Step-by-Step Render Deployment Guide

## Part 1: Prepare Your Code

### Step 1.1: Push Code to GitHub

1. **Open terminal** in your project folder
2. **Initialize git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Ready for deployment"
   ```

3. **Create GitHub repository**:
   - Go to https://github.com/new
   - Name it: `library-seat-booking`
   - Make it **Public** (free tier requirement)
   - Click **"Create repository"**

4. **Push your code**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/library-seat-booking.git
   git push -u origin main
   ```

---

## Part 2: Deploy Backend

### Step 2.1: Create Backend Service

1. Go to https://dashboard.render.com/
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

### Step 2.2: Connect GitHub

1. Click **"Connect account"** if not connected
2. Authorize Render to access GitHub
3. Select your repository: `library-seat-booking`
4. Click **"Connect"**

### Step 2.3: Configure Backend

Fill in these fields:

- **Name**: `library-seat-booking-backend`
- **Environment**: Select **"Node"**
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: Leave **empty**
- **Build Command**: 
  ```
  cd server && npm install
  ```
- **Start Command**: 
  ```
  cd server && node index.js
  ```

### Step 2.4: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these one by one:

1. **PORT**
   - Key: `PORT`
   - Value: `10000`

2. **NODE_ENV**
   - Key: `NODE_ENV`
   - Value: `production`

3. **RAZORPAY_KEY_ID**
   - Key: `RAZORPAY_KEY_ID`
   - Value: `rzp_test_xxxxxxxxxxxxx` (your actual key)

4. **RAZORPAY_KEY_SECRET**
   - Key: `RAZORPAY_KEY_SECRET`
   - Value: `your_secret_key_here` (your actual secret)

### Step 2.5: Deploy Backend

1. Scroll down and click **"Create Web Service"**
2. Wait for deployment (takes 2-5 minutes)
3. Watch the build logs
4. When you see **"Your service is live"**, copy the URL
   - Example: `https://library-seat-booking-backend-xxxx.onrender.com`
5. **Save this URL** - you'll need it for frontend!

### Step 2.6: Test Backend

1. Open the backend URL in browser
2. Add `/api/health` to the end
3. You should see: `{"status":"OK","message":"Server is running"}`

---

## Part 3: Deploy Frontend

### Step 3.1: Create Frontend Service

1. In Render dashboard, click **"New +"**
2. Select **"Static Site"**

### Step 3.2: Connect GitHub

1. Select the same repository: `library-seat-booking`
2. Click **"Connect"**

### Step 3.3: Configure Frontend

Fill in these fields:

- **Name**: `library-seat-booking-frontend`
- **Branch**: `main`
- **Root Directory**: Leave **empty**
- **Build Command**: 
  ```
  cd client && npm install && npm run build
  ```
- **Publish Directory**: 
  ```
  client/build
  ```

### Step 3.4: Add Environment Variables

Click **"Add Environment Variable"**

Add these:

1. **REACT_APP_API_URL**
   - Key: `REACT_APP_API_URL`
   - Value: `https://library-seat-booking-backend-xxxx.onrender.com`
   - ⚠️ **Use your actual backend URL from Step 2.5!**

2. **REACT_APP_RAZORPAY_KEY_ID**
   - Key: `REACT_APP_RAZORPAY_KEY_ID`
   - Value: `rzp_test_xxxxxxxxxxxxx` (same as backend)

### Step 3.5: Deploy Frontend

1. Click **"Create Static Site"**
2. Wait for build (takes 3-7 minutes)
3. When done, you'll get a URL like:
   - `https://library-seat-booking-frontend.onrender.com`

---

## Part 4: Configure Firebase

### Step 4.1: Add Authorized Domain

1. Go to https://console.firebase.google.com/
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Enter your frontend Render URL (without https://)
   - Example: `library-seat-booking-frontend.onrender.com`
6. Click **"Add"**

### Step 4.2: Verify Firebase Config

Make sure `client/src/firebase/config.js` has your production Firebase config.

---

## Part 5: Test Your Deployment

### Step 5.1: Test Frontend

1. Visit your frontend URL
2. You should see the home page
3. Try logging in/signing up

### Step 5.2: Test Booking Flow

1. Complete your profile
2. Go to seats page
3. Select a seat
4. Try booking (use test card: `4111 1111 1111 1111`)

### Step 5.3: Test Payment

Use Razorpay test card:
- **Card**: `4111 1111 1111 1111`
- **CVV**: `123`
- **Expiry**: `12/25`
- **Name**: Any name

---

## 🎉 Success!

Your app is now live! Share your frontend URL with users.

---

## 🔧 Troubleshooting

### Backend shows "Service Unavailable"
- **Wait 30-60 seconds** - Render free tier sleeps after 15 min inactivity
- First request after sleep is slow (cold start)

### Frontend can't connect to backend
- Check `REACT_APP_API_URL` is correct
- Verify backend URL works (add `/api/health`)
- Check browser console for errors

### Build fails
- Check build logs in Render dashboard
- Verify all dependencies in package.json
- Check for syntax errors

### Payment not working
- Verify Razorpay keys are correct
- Check browser console for errors
- Ensure backend is running

---

## 📝 Next Steps

1. **Custom Domain** (optional): Add your own domain in Render settings
2. **Upgrade Plan** (optional): For always-on service (no sleep)
3. **Monitor**: Check Render dashboard for logs and metrics
4. **Backup**: Keep your code in GitHub

---

## 💡 Pro Tips

- **Free tier limitation**: Backend sleeps after 15 min, first request is slow
- **Auto-deploy**: Every push to main branch auto-deploys
- **Environment variables**: Never commit `.env` files
- **Logs**: Check Render logs for debugging
- **Health check**: Use `/api/health` to test backend

---

**Need help?** Check the detailed guide in `RENDER_DEPLOYMENT.md`

