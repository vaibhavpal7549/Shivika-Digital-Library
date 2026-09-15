import React from "react";

const StudentTable = ({
  type = "current", // "current" or "past"
  students = [],
  loading = false,
  sortBy,
  sortOrder,
  onSort,
  onViewDetails,
  onDeactivate,
}) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const formatMonth = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        });
  };

  const getPlanTypeLabel = (student) => {
    const seat = student?.seat || {};
    const payment = student?.payment || {};

    const mode =
      student?.planType ||
      student?.feeCalculationMode ||
      seat?.feeCalculationMode ||
      payment?.feeCalculationMode ||
      payment?.currentPlan;

    const shift = seat?.shift || student?.shift;
    const dailyHours = seat?.dailyHours || student?.dailyHours || payment?.hoursPerDay;

    if (mode === "hourly" || shift === "custom" || dailyHours) {
      return dailyHours ? `Hourly (${dailyHours}h)` : "Hourly Plan";
    }

    if (
      mode === "fixed" ||
      mode === "monthly" ||
      shift === "fullday" ||
      shift === "full_day" ||
      shift === "Full Day"
    ) {
      return "Fixed Plan";
    }

    if (shift) {
      const lowerShift = String(shift).toLowerCase();
      if (lowerShift.includes("hour") || lowerShift === "custom") {
        return "Hourly Plan";
      }
      return "Fixed Plan";
    }

    if (seat?.seatNumber || student?.seatNumber) {
      return "Fixed Plan";
    }

    return "N/A";
  };

  const renderSortHeader = (title, fieldKey) => {
    const isSorted = sortBy === fieldKey;
    return (
      <th
        onClick={() => onSort && onSort(fieldKey)}
        className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 select-none transition border-r border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center space-x-1">
          <span>{title}</span>
          <span className="text-gray-400">
            {isSorted ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading student records...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
        <span className="text-4xl block mb-2">🔍</span>
        <p className="font-semibold text-base">No students found matching the selected criteria.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-gray-100 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
              #
            </th>
            {renderSortHeader("Student Name", "fullName")}
            {type === "current"
              ? renderSortHeader("Seat #", "seatNumber")
              : renderSortHeader("Prev Seat #", "seatNumber")}
            <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
              Email
            </th>
            <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
              Mobile
            </th>
            {renderSortHeader("Booking Date", "bookingDate")}
            {type === "current" ? (
              <>
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Payment Status
                </th>
                {renderSortHeader("Deadline", "paymentDeadline")}
                {renderSortHeader("Months Paid", "monthsPaid")}
                {renderSortHeader("Plan Type", "planType")}
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Paid Through
                </th>
                {renderSortHeader("Next Due", "nextDueDate")}
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Account Status
                </th>
              </>
            ) : (
              <>
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Exit / Release Date
                </th>
                {renderSortHeader("Total Months", "monthsPaid")}
                {renderSortHeader("Plan Type", "planType")}
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Last Paid Month
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Exit Reason
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase border-r border-gray-200 dark:border-gray-700">
                  Status
                </th>
              </>
            )}
            <th className="px-4 py-3 font-semibold text-xs text-gray-700 dark:text-gray-200 uppercase text-center">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {students.map((student, idx) => {
            const seat = student.seat || {};
            const payment = student.payment || {};
            const isPendingPayment =
              seat.bookingStatus === "pending_payment" ||
              payment.paymentStatus === "pending";

            return (
              <tr
                key={student.id || student._id || idx}
                className="hover:bg-purple-50/50 dark:hover:bg-gray-700/50 transition duration-150"
              >
                <td className="px-3 py-2.5 font-medium text-gray-500 border-r border-gray-200 dark:border-gray-700">
                  {idx + 1}
                </td>

                {/* Student Name */}
                <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
                  <div className="flex items-center space-x-2">
                    <span>{student.fullName}</span>
                  </div>
                </td>

                {/* Seat Number */}
                <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-bold text-purple-700 dark:text-purple-400">
                  {seat.seatNumber ? `Seat ${seat.seatNumber}` : "None"}
                </td>

                {/* Email */}
                <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                  {student.email}
                </td>

                {/* Mobile */}
                <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                  {student.phone}
                </td>

                {/* Booking Date */}
                <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {formatDate(seat.bookingDate)}
                </td>

                {type === "current" ? (
                  <>
                    {/* Payment Status */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          payment.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : isPendingPayment
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                        }`}
                      >
                        {payment.paymentStatus === "paid"
                          ? "✓ Paid"
                          : isPendingPayment
                          ? "⏳ Pending"
                          : "Expired"}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      {isPendingPayment && seat.paymentDeadline ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {formatDate(seat.paymentDeadline)}
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold w-fit mt-0.5">
                            {student.daysRemainingForPayment !== null
                              ? `${student.daysRemainingForPayment}d left`
                              : "5-day limit"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Months Paid */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-bold text-center text-purple-700 dark:text-purple-300">
                      {student.monthsPaid || 0}
                    </td>

                    {/* Plan Type */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                      {(() => {
                        const label = getPlanTypeLabel(student);
                        if (label === "N/A") {
                          return <span className="text-gray-400 font-medium">N/A</span>;
                        }
                        const isHourly = label.toLowerCase().includes("hourly");
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              isHourly
                                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}
                          >
                            {isHourly ? "⏱ " : "📚 "}
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Paid Through */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                      {formatMonth(student.paidThroughDate || payment.nextDueDate)}
                    </td>

                    {/* Next Due */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {formatDate(payment.nextDueDate)}
                    </td>

                    {/* Account Status */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        {student.membershipStatus || "active"}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    {/* Release/Deactivation Date */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      {formatDate(student.deactivatedAt || seat.expiryDate)}
                    </td>

                    {/* Total Months */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 font-bold text-center">
                      {student.monthsPaid || 0}
                    </td>

                    {/* Plan Type */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                      {(() => {
                        const label = getPlanTypeLabel(student);
                        if (label === "N/A") {
                          return <span className="text-gray-400 font-medium">N/A</span>;
                        }
                        const isHourly = label.toLowerCase().includes("hourly");
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              isHourly
                                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            }`}
                          >
                            {isHourly ? "⏱ " : "📚 "}
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Last Paid Month */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      {formatMonth(student.paidThroughDate)}
                    </td>

                    {/* Exit Reason */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 capitalize text-gray-600 dark:text-gray-400">
                      {student.deactivationReason ||
                        seat.bookingStatus ||
                        "Released / Expired"}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 border-r border-gray-200 dark:border-gray-700">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Past Student
                      </span>
                    </td>
                  </>
                )}

                {/* Actions */}
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onViewDetails(student)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-[11px] shadow-sm transition"
                    >
                      View Details
                    </button>
                    {type === "current" && onDeactivate && (
                      <button
                        onClick={() => onDeactivate(student)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg font-semibold text-[11px] transition"
                        title="Deactivate and release seat (moves to Past Students)"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTable;
