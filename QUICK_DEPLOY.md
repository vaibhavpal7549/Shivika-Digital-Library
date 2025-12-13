# ⚡ Quick Deploy Guide (5 Minutes)

## 🚀 Fastest Way to Deploy

### Step 1: Push to GitHub (2 min)

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - Ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 2: Deploy Backend (2 min)

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub → Select your repo
4. Configure:
   - **Name**: `library-backend`
   - **Build**: `cd server && npm install`
   - **Start**: `cd server && node index.js`
5. Add Environment Variables:
   ```
   PORT=10000
   RAZORPAY_KEY_ID=rzp_test_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```
6. Click **"Create Web Service"**
7. **Copy the URL** (e.g., `https://library-backend-xxxx.onrender.com`)

### Step 3: Deploy Frontend (1 min)

1. Click **"New +"** → **"Static Site"**
2. Connect GitHub → Select your repo
3. Configure:
   - **Name**: `library-frontend`
   - **Build**: `cd client && npm install && npm run build`
   - **Publish**: `client/build`
4. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://library-backend-xxxx.onrender.com
   REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxx
   ```
   (Use the backend URL from Step 2)
5. Click **"Create Static Site"**

### Step 4: Update Firebase (1 min)

1. Go to Firebase Console
2. Authentication → Settings → Authorized domains
3. Add your frontend Render URL

### ✅ Done!

Your app is live! Visit your frontend URL.

## 🔑 Get Razorpay Keys

1. https://dashboard.razorpay.com/
2. Settings → API Keys
3. Generate Test Keys
4. Copy Key ID and Secret

## 🧪 Test Payment

Use test card: `4111 1111 1111 1111`

---

**Need help?** Check `RENDER_DEPLOYMENT.md` for detailed guide.

