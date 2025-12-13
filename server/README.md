# Backend Server

Express.js server for Library Seat Booking System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
PORT=5000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

3. Run server:
```bash
npm run dev
```

## API Endpoints

### POST `/api/create-order`
Creates a Razorpay order for payment.

**Request Body:**
```json
{
  "amount": 100,
  "currency": "INR",
  "seatNumber": 1,
  "hours": 2,
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order_xxx",
    "amount": 10000,
    "currency": "INR",
    ...
  }
}
```

### POST `/api/verify-payment`
Verifies Razorpay payment signature.

**Request Body:**
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx",
  "seatNumber": 1,
  "hours": 2,
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified",
  "paymentId": "pay_xxx",
  "orderId": "order_xxx"
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## Notes

- Payment amounts are in paise (₹1 = 100 paise)
- Webhook verification uses HMAC SHA256
- CORS is enabled for all origins (update for production)

