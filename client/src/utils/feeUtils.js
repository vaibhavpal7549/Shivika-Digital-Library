// Fee utility functions

export const MONTHLY_FEE = 1000; // ₹1000 per month
export const HOURLY_RATE = 75; // ₹75 per hour
export const FEE_VALIDITY_DAYS = 30;

/**
 * Check if fee is still valid (within 30 days of payment)
 */
export function isFeeValid(paymentDate) {
  if (!paymentDate) return false;
  
  const payment = new Date(paymentDate);
  const now = new Date();
  const diffTime = now - payment;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays < FEE_VALIDITY_DAYS;
}

/**
 * Get fee status (PAID or PENDING)
 */
export function getFeeStatus(feePaymentDate) {
  if (!feePaymentDate) return 'PENDING';
  return isFeeValid(feePaymentDate) ? 'PAID' : 'PENDING';
}

/**
 * Calculate total fee for selected months (fixed monthly fee)
 */
export function calculateMonthlyFee(months) {
  return months * MONTHLY_FEE;
}

/**
 * Calculate fee based on daily study hours
 * Formula: Monthly Fee = Hourly Rate × Daily Hours
 * Total Fee = Monthly Fee × Months
 * Example: Monthly Fee = ₹75 × 8 hours = ₹600/month
 * Total = ₹600 × 2 months = ₹1200
 */
export function calculateHourlyBasedFee(dailyHours, months) {
  const monthlyFee = HOURLY_RATE * dailyHours;
  return monthlyFee * months;
}

/**
 * Calculate monthly fee based on daily hours
 * Formula: Monthly Fee = Hourly Rate × Daily Hours
 */
export function calculateMonthlyFeeFromHours(dailyHours) {
  return HOURLY_RATE * dailyHours;
}

/**
 * Get days remaining for fee validity
 */
export function getDaysRemaining(paymentDate) {
  if (!paymentDate) return 0;
  
  const payment = new Date(paymentDate);
  const now = new Date();
  const diffTime = payment.getTime() + (FEE_VALIDITY_DAYS * 24 * 60 * 60 * 1000) - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

