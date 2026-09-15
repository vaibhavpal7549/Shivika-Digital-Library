import React from "react";

const DashboardStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Seats",
      value: stats?.totalSeats || 60,
      icon: "🪑",
      color: "from-blue-500 to-indigo-600",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Occupied Seats",
      value: stats?.occupiedSeats || 0,
      icon: "📌",
      color: "from-purple-500 to-indigo-600",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Available Seats",
      value: stats?.availableSeats || 0,
      icon: "✅",
      color: "from-green-500 to-emerald-600",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments || 0,
      icon: "⏳",
      color: "from-amber-500 to-orange-600",
      textColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Active Students",
      value: stats?.activeStudents || 0,
      icon: "🎓",
      color: "from-cyan-500 to-blue-600",
      textColor: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Past Students",
      value: stats?.pastStudents || 0,
      icon: "📜",
      color: "from-gray-500 to-slate-600",
      textColor: "text-gray-600 dark:text-gray-400",
    },
    {
      title: "Fees Due Soon",
      value: stats?.feesDueSoon || 0,
      icon: "⚠️",
      color: "from-rose-500 to-red-600",
      textColor: "text-rose-600 dark:text-rose-400",
    },
    {
      title: "Monthly Revenue",
      value: `₹${(stats?.monthlyRevenue || 0).toLocaleString("en-IN")}`,
      icon: "💰",
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {statCards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">{card.icon}</span>
            <span className={`text-2xl font-extrabold ${card.textColor}`}>
              {card.value}
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {card.title}
            </h4>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStats;
