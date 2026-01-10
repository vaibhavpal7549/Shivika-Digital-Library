/**
 * Routes Index
 * Export all routes from single point
 */

module.exports = {
  authRoutes: require('./authRoutes'),
  seatRoutes: require('./seatRoutes'),
  paymentRoutes: require('./paymentRoutes'),
  adminRoutes: require('./adminRoutes'),
  userRoutes: require('./userRoutes')
};
