/**
 * Controllers Index
 * Export all controllers from single point
 */

module.exports = {
  authController: require('./authController'),
  seatController: require('./seatController'),
  paymentController: require('./paymentController'),
  adminController: require('./adminController')
};
