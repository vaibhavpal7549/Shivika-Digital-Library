# ✅ Deployment Checklist

Use this checklist to ensure everything is ready for deployment.

## Pre-Deployment

### Code Preparation
- [ ] All code committed to GitHub
- [ ] No hardcoded localhost URLs
- [ ] Environment variables properly configured
- [ ] Firebase config updated with production credentials
- [ ] All dependencies listed in package.json

### Firebase Setup
- [ ] Firebase project created
- [ ] Authentication enabled (Email, Google)
- [ ] Realtime Database created
- [ ] Database rules configured
- [ ] Firebase config copied to `client/src/firebase/config.js`

### Razorpay Setup
- [ ] Razorpay account created
- [ ] Test/Live API keys obtained
- [ ] Keys ready to add to Render environment variables

### GitHub
- [ ] Repository created on GitHub
- [ ] Code pushed to GitHub
- [ ] Main/master branch is up to date

## Render Deployment

### Backend Deployment
- [ ] Render account created
- [ ] Backend web service created
- [ ] GitHub repository connected
- [ ] Build command: `cd server && npm install`
- [ ] Start command: `cd server && node index.js`
- [ ] Environment variables added:
  - [ ] `PORT=10000`
  - [ ] `RAZORPAY_KEY_ID`
  - [ ] `RAZORPAY_KEY_SECRET`
  - [ ] `NODE_ENV=production`
- [ ] Backend deployed successfully
- [ ] Backend URL copied

### Frontend Deployment
- [ ] Frontend static site created on Render
- [ ] GitHub repository connected
- [ ] Build command: `cd client && npm install && npm run build`
- [ ] Publish directory: `client/build`
- [ ] Environment variables added:
  - [ ] `REACT_APP_API_URL` (backend URL from above)
  - [ ] `REACT_APP_RAZORPAY_KEY_ID`
- [ ] Frontend deployed successfully
- [ ] Frontend URL copied

## Post-Deployment

### Firebase Configuration
- [ ] Frontend domain added to Firebase authorized domains
- [ ] Database rules allow access from production domain

### Testing
- [ ] Frontend loads correctly
- [ ] Login/Signup works
- [ ] Profile creation works
- [ ] Seat viewing works
- [ ] Seat booking works
- [ ] Payment flow works (test with test card)
- [ ] Real-time updates work
- [ ] Payment history displays correctly

### Security
- [ ] Environment variables not exposed in code
- [ ] CORS configured properly (if restricting)
- [ ] Firebase rules secure
- [ ] Razorpay keys are production keys (if using live)

### Documentation
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] Team members have access

## Troubleshooting

If something doesn't work:
- [ ] Check Render logs for errors
- [ ] Verify environment variables are set
- [ ] Check browser console for errors
- [ ] Verify backend URL is correct in frontend
- [ ] Test backend health endpoint
- [ ] Check Firebase console for errors
- [ ] Verify Razorpay keys are correct

