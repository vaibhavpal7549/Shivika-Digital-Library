import React, { useState } from "react";
import { getImageUrl } from "../../utils/imageUtils";

const StudentDetailModal = ({ student, onClose, onPaymentUpdate }) => {
  const [showPhotoPopup, setShowPhotoPopup] = useState(false);

  if (!student) return null;

  const profile = student.profile || {};
  const seat = student.seat || {};
  const payment = student.payment || {};
  const paymentHistory = student.paymentHistory || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatMonth = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  };

  const getPlanTypeLabel = () => {
    const mode =
      student?.planType ||
      student?.feeCalculationMode ||
      seat?.feeCalculationMode ||
      payment?.feeCalculationMode ||
      payment?.currentPlan;

    const shift = seat?.shift || student?.shift;
    const dailyHours = seat?.dailyHours || student?.dailyHours || payment?.hoursPerDay;

    if (mode === "hourly" || shift === "custom" || dailyHours) {
      return dailyHours ? `Hourly Plan (${dailyHours} hrs/day)` : "Hourly Plan";
    }

    if (
      mode === "fixed" ||
      mode === "monthly" ||
      shift === "fullday" ||
      shift === "full_day" ||
      shift === "Full Day"
    ) {
      return "Fixed Monthly Plan";
    }

    if (shift) {
      const lowerShift = String(shift).toLowerCase();
      if (lowerShift.includes("hour") || lowerShift === "custom") {
        return "Hourly Plan";
      }
      return "Fixed Monthly Plan";
    }

    if (seat?.seatNumber || student?.seatNumber) {
      return "Fixed Monthly Plan";
    }

    return "N/A";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
          <div className="flex items-center space-x-3">
            <div
              onClick={() => setShowPhotoPopup(true)}
              className="relative group cursor-pointer"
              title="Click to view full student profile photo"
            >
              {student.photoURL ? (
                <img
                  src={getImageUrl(student.photoURL)}
                  alt={student.fullName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white group-hover:scale-105 transition shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center font-bold text-xl text-white border-2 border-white group-hover:scale-105 transition shadow">
                  {student.fullName?.charAt(0) || "S"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                🔍
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">{student.fullName}</h2>
              <p className="text-xs text-purple-200">
                ID: {profile.studentId || student._id} | {student.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-gray-800 dark:text-gray-200">
          {/* Section 1: Profile Details */}
          <div>
            <h3 className="text-md font-bold text-purple-700 dark:text-purple-400 border-b pb-2 mb-3 flex items-center">
              <span className="mr-2">👤</span> Personal & Profile Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Full Name</span>
                <span className="font-semibold">{student.fullName || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Email Address</span>
                <span className="font-semibold">{student.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Mobile Number</span>
                <span className="font-semibold">{student.phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Date of Birth</span>
                <span className="font-semibold">{formatDate(profile.dateOfBirth)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Gender</span>
                <span className="font-semibold capitalize">{profile.gender || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Father's Name</span>
                <span className="font-semibold">{profile.fatherName || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">College / University</span>
                <span className="font-semibold">{profile.collegeName || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Student ID</span>
                <span className="font-semibold">{profile.studentId || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Emergency Contact</span>
                <span className="font-semibold">
                  {profile.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.phone || ''})` : "N/A"}
                </span>
              </div>
              <div className="sm:col-span-2 md:col-span-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Address</span>
                <span className="font-semibold">
                  {profile.address?.full || profile.address?.street || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Seat & Membership Status */}
          {(() => {
            const isPastStudent = 
              student.membershipStatus === "inactive" || 
              student.membershipStatus === "Inactive" || 
              seat.seatStatus === "released" || 
              seat.seatStatus === "expired" ||
              Boolean(student.deactivatedAt);

            const displayBookingStatus = isPastStudent
              ? "Not Confirmed"
              : (seat.bookingStatus === "pending_payment" ? "Pending Payment" : "Confirmed");

            const displayMembershipStatus = isPastStudent
              ? "Inactive"
              : "Active";

            return (
              <div>
                <h3 className="text-md font-bold text-purple-700 dark:text-purple-400 border-b pb-2 mb-3 flex items-center">
                  <span className="mr-2">🪑</span> Seat & Booking Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-purple-50 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-100 dark:border-purple-900">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Seat Number</span>
                    <span className="font-bold text-lg text-purple-700 dark:text-purple-300">
                      {seat.seatNumber ? `Seat ${seat.seatNumber}` : (isPastStudent ? "No Seat Assigned" : "Assigned")}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Shift / Plan</span>
                    <span className="font-semibold capitalize">{getPlanTypeLabel()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Booking Date</span>
                    <span className="font-semibold">{formatDate(seat.bookingDate)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Payment Deadline</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatDate(seat.paymentDeadline)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Booking Status</span>
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${
                      displayBookingStatus === "Confirmed" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" :
                      displayBookingStatus === "Pending Payment" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" :
                      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    }`}>
                      {displayBookingStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Seat Expiry Date</span>
                    <span className="font-semibold">{formatDate(seat.expiryDate)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Membership Status</span>
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${
                      displayMembershipStatus === "Active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {displayMembershipStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Deactivated Date</span>
                    <span className="font-semibold">{formatDate(student.deactivatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section 3: Fee Summary */}
          <div>
            <h3 className="text-md font-bold text-purple-700 dark:text-purple-400 border-b pb-2 mb-3 flex items-center">
              <span className="mr-2">💳</span> Fee Summary & Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Current Status</span>
                <span className={`font-bold capitalize ${
                  payment.paymentStatus === "paid" ? "text-green-600" : "text-amber-600"
                }`}>
                  {payment.paymentStatus || "Pending"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Months Paid</span>
                <span className="font-bold text-purple-700 dark:text-purple-300">
                  {student.monthsPaid || 0} Month(s)
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Plan Type</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {getPlanTypeLabel()}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Paid-Through Month</span>
                <span className="font-semibold">{formatMonth(student.paidThroughDate || payment.nextDueDate)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Total Amount Paid</span>
                <span className="font-bold text-emerald-600">₹{(payment.totalPaid || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Complete Fee History Table */}
          <div>
            <h3 className="text-md font-bold text-purple-700 dark:text-purple-400 border-b pb-2 mb-3 flex items-center">
              <span className="mr-2">📊</span> Complete Month-by-Month Fee History
            </h3>
            {paymentHistory.length === 0 ? (
              <p className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                No fee payment records found for this student.
              </p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 font-semibold text-gray-600 dark:text-gray-300 uppercase">
                    <tr>
                      <th className="p-3 border-b">Month / Date</th>
                      <th className="p-3 border-b">Amount</th>
                      <th className="p-3 border-b">Payment Mode</th>
                      <th className="p-3 border-b">Status</th>
                      <th className="p-3 border-b">Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {paymentHistory.map((ph, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-3 font-semibold">
                          {formatMonth(ph.paymentDate)} ({formatDate(ph.paymentDate)})
                        </td>
                        <td className="p-3 font-bold text-emerald-600">₹{ph.amount}</td>
                        <td className="p-3 uppercase">{ph.paymentMode || "Online"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ph.status === "success" || ph.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {ph.status || "success"}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-500">{ph.transactionId || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-semibold shadow transition"
          >
            Close Details
          </button>
        </div>
      </div>

      {/* High-Resolution Photo Popup Lightbox */}
      {showPhotoPopup && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowPhotoPopup(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative flex flex-col items-center border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPhotoPopup(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg transition"
              title="Close photo viewer"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300 mb-4 text-center">
              Student Profile Photo
            </h3>

            {student.photoURL ? (
              <div className="w-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden p-2 border border-gray-200 dark:border-gray-700">
                <img
                  src={getImageUrl(student.photoURL)}
                  alt={student.fullName}
                  className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-lg"
                />
              </div>
            ) : (
              <div className="w-full py-12 bg-purple-50 dark:bg-purple-950/40 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-purple-200 dark:border-purple-800">
                <div className="w-24 h-24 rounded-full bg-purple-600 text-white font-bold text-4xl flex items-center justify-center shadow-lg mb-3">
                  {student.fullName?.charAt(0) || "S"}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  No Profile Photo Uploaded
                </p>
              </div>
            )}

            <div className="mt-4 text-center">
              <h4 className="font-bold text-gray-800 dark:text-white text-base">
                {student.fullName}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ID: {profile.studentId || student._id || "N/A"} • Phone: {student.phone || "N/A"}
              </p>
              {seat.seatNumber && (
                <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 text-xs font-semibold rounded-full">
                  Assigned Seat: {seat.seatNumber}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowPhotoPopup(false)}
              className="mt-5 w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow transition"
            >
              Close Photo Viewer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetailModal;
