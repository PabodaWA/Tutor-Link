const requestStatuses = new Set(['pending', 'reschedule_requested']);

function isBookingRequest(status) {
  return requestStatuses.has(status);
}

function shouldChargeCancellationFee({ status, isStudent }) {
  return Boolean(isStudent) && !isBookingRequest(status);
}

module.exports = { isBookingRequest, shouldChargeCancellationFee };
