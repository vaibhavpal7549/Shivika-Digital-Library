import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, RotateCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useUser } from "../contexts/UserContext";
import { useSocket } from "../contexts/SocketContext";
import apiClient from "../utils/apiClient";
import DashboardStats from "../components/admin/DashboardStats";
import StudentTable from "../components/admin/StudentTable";
import Pagination from "../components/admin/Pagination";
import StudentDetailModal from "../components/admin/StudentDetailModal";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { userData, loading: userLoading } = useUser();
  const { socket, connected, joinAdminRoom, leaveAdminRoom } = useSocket();

  // Active tab: "current" or "past"
  const [activeTab, setActiveTab] = useState("current");

  // Data states
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Search & Filter & Sort states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("seatNumber");
  const [sortOrder, setSortOrder] = useState("asc");

  // Current Students Filters
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [seatStatus, setSeatStatus] = useState("All");
  const [monthsPaidFilter, setMonthsPaidFilter] = useState("All");
  const [paymentDeadlineFilter, setPaymentDeadlineFilter] = useState("All");

  // Past Students Filters
  const [exitStatusFilter, setExitStatusFilter] = useState("All");
  const [membershipDurationFilter, setMembershipDurationFilter] = useState("All");

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deactivateStudentTarget, setDeactivateStudentTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  // Verify admin access
  useEffect(() => {
    if (!userLoading && userData) {
      if (userData.role !== "admin") {
        navigate("/dashboard");
      }
    }
  }, [userData, userLoading, navigate]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Enhanced Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiClient.get("/api/admin/enhanced-stats");
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("❌ Error fetching admin stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Students (Current or Past)
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint =
        activeTab === "current"
          ? "/api/admin/current-students"
          : "/api/admin/past-students";

      const params = {
        page,
        limit,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      };

      if (activeTab === "current") {
        params.paymentStatus = paymentStatus;
        params.seatStatus = seatStatus;
        params.monthsPaid = monthsPaidFilter;
        params.paymentDeadline = paymentDeadlineFilter;
      } else {
        params.exitStatus = exitStatusFilter;
        params.membershipDuration = membershipDurationFilter;
      }

      const res = await apiClient.get(endpoint, { params });

      if (res.data.success) {
        setStudents(res.data.students || []);
        setTotalRecords(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error("❌ Error fetching students list:", err);
      setError("Failed to load students data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    page,
    limit,
    debouncedSearch,
    sortBy,
    sortOrder,
    paymentStatus,
    seatStatus,
    monthsPaidFilter,
    paymentDeadlineFilter,
    exitStatusFilter,
    membershipDurationFilter,
  ]);

  // Reload stats and student table
  useEffect(() => {
    if (currentUser && userData?.role === "admin") {
      fetchStats();
      fetchStudents();
    }
  }, [currentUser, userData, activeTab, fetchStats, fetchStudents]);

  // Subscribe to Socket.IO real-time updates
  useEffect(() => {
    if (socket && joinAdminRoom) {
      joinAdminRoom();

      const refreshAll = () => {
        fetchStats();
        fetchStudents();
      };

      socket.on("seat:booked", refreshAll);
      socket.on("seat:released", refreshAll);
      socket.on("seat:changed", refreshAll);
      socket.on("payment:completed", refreshAll);
      socket.on("payment:status-update", refreshAll);
      socket.on("user:registered", refreshAll);

      return () => {
        leaveAdminRoom?.();
        socket.off("seat:booked", refreshAll);
        socket.off("seat:released", refreshAll);
        socket.off("seat:changed", refreshAll);
        socket.off("payment:completed", refreshAll);
        socket.off("payment:status-update", refreshAll);
        socket.off("user:registered", refreshAll);
      };
    }
  }, [socket, joinAdminRoom, leaveAdminRoom, fetchStats, fetchStudents]);

  // Sort handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // View Details handler
  const handleViewDetails = async (student) => {
    try {
      // Fetch fresh complete details
      const res = await apiClient.get(`/api/admin/user/${student.id || student._id}`);
      if (res.data.success) {
        setSelectedStudent(res.data.user);
      } else {
        setSelectedStudent(student);
      }
    } catch (err) {
      setSelectedStudent(student);
    }
    setShowDetailModal(true);
  };

  // Deactivate handler
  const handleDeactivateClick = (student) => {
    setDeactivateStudentTarget(student);
    setDeactivateReason("Student requested exit");
  };

  const confirmDeactivate = async () => {
    if (!deactivateStudentTarget) return;

    try {
      setDeactivating(true);
      const res = await apiClient.put(
        `/api/admin/student/${deactivateStudentTarget.id || deactivateStudentTarget._id}/deactivate`,
        { reason: deactivateReason }
      );

      if (res.data.success) {
        setSuccessMessage(
          `Deactivated ${deactivateStudentTarget.fullName}. Seat released and moved to Past Students.`
        );
        setTimeout(() => setSuccessMessage(""), 4000);
        setDeactivateStudentTarget(null);
        fetchStats();
        fetchStudents();
      }
    } catch (err) {
      console.error("❌ Deactivation error:", err);
      alert(err.response?.data?.error || "Failed to deactivate student");
    } finally {
      setDeactivating(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 pb-12">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">
              Shivika Library Admin Dashboard
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded-full text-xs font-bold border border-purple-200">
              👑 Admin Administrator
            </span>
            {connected && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full text-xs font-bold">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live Sync
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => {
                fetchStats();
                fetchStudents();
              }}
              className="px-3.5 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition duration-200 flex items-center space-x-2 shadow-sm border border-gray-200 dark:border-gray-600 active:scale-95 group"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 transition-transform duration-500 group-hover:rotate-180" />
              <span>Refresh</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 transition-all duration-200 flex items-center space-x-2 active:scale-95 border border-rose-400/30"
            >
              <LogOut className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Success Banner */}
        {successMessage && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center space-x-2">
              <span className="text-xl">✅</span>
              <span className="font-semibold text-sm">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-emerald-800 font-bold text-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* 8 Summary Cards */}
        <DashboardStats stats={stats} loading={statsLoading} />

        {/* Navigation Tabs & Search Controls Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-4">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex space-x-2 sm:space-x-4">
              <button
                onClick={() => {
                  setActiveTab("current");
                  setPage(1);
                  setSortBy("seatNumber");
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center space-x-2 ${
                  activeTab === "current"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <span>🎓 Current Students</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {stats?.activeStudents || 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("past");
                  setPage(1);
                  setSortBy("fullName");
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center space-x-2 ${
                  activeTab === "past"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <span>📜 Past Students</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {stats?.pastStudents || 0}
                </span>
              </button>
            </div>
          </div>

          {/* Search Box & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Search Students
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, email, phone, seat #, student ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">
                  🔍
                </span>
              </div>
            </div>

            {/* Current Student Filters */}
            {activeTab === "current" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => {
                      setPaymentStatus(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Payment Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Seat Status
                  </label>
                  <select
                    value={seatStatus}
                    onChange={(e) => {
                      setSeatStatus(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Seat Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Months Paid
                  </label>
                  <select
                    value={monthsPaidFilter}
                    onChange={(e) => {
                      setMonthsPaidFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Months Paid</option>
                    <option value="0">0 Months</option>
                    <option value="1+">1+ Month</option>
                    <option value="3+">3+ Months</option>
                    <option value="6+">6+ Months</option>
                    <option value="12+">12+ Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Payment Deadline
                  </label>
                  <select
                    value={paymentDeadlineFilter}
                    onChange={(e) => {
                      setPaymentDeadlineFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Deadlines</option>
                    <option value="Due Soon">Due Soon (&le; 2 days)</option>
                    <option value="Expired/Pending">Expired / Pending</option>
                  </select>
                </div>
              </>
            )}

            {/* Past Student Filters */}
            {activeTab === "past" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Exit Status
                  </label>
                  <select
                    value={exitStatusFilter}
                    onChange={(e) => {
                      setExitStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Exit Reasons</option>
                    <option value="Expired">Expired Booking</option>
                    <option value="Left">Seat Released</option>
                    <option value="Deactivated">Deactivated by Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    Membership Duration
                  </label>
                  <select
                    value={membershipDurationFilter}
                    onChange={(e) => {
                      setMembershipDurationFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Durations</option>
                    <option value="< 1 month">&lt; 1 month</option>
                    <option value="1-3 months">1–3 months</option>
                    <option value="3-6 months">3–6 months</option>
                    <option value="6+ months">6+ months</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Excel-like Data Table */}
          {error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded-xl text-center text-sm font-semibold">
              {error}
            </div>
          ) : (
            <StudentTable
              type={activeTab}
              students={students}
              loading={loading}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onViewDetails={handleViewDetails}
              onDeactivate={activeTab === "current" ? handleDeactivateClick : null}
            />
          )}

          {/* Pagination Controls */}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRecords={totalRecords}
            limit={limit}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      </main>

      {/* Student Details Popup Modal */}
      {showDetailModal && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Deactivation Confirmation Modal */}
      {deactivateStudentTarget && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              ⚠️ Deactivate Student & Release Seat
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to deactivate{" "}
              <strong className="text-gray-900 dark:text-white">
                {deactivateStudentTarget.fullName}
              </strong>
              ?
            </p>
            <p className="text-xs text-gray-500 mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border">
              • Seat {deactivateStudentTarget.seat?.seatNumber} will be freed and made available for other users.<br />
              • The student's account status will be set to Inactive.<br />
              • <strong>No historical records or fee history will be deleted.</strong> They will appear under Past Students.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Deactivation Reason:
              </label>
              <input
                type="text"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none"
                placeholder="Reason for deactivation..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeactivateStudentTarget(null)}
                disabled={deactivating}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 rounded-xl text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={deactivating}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow transition disabled:opacity-50"
              >
                {deactivating ? "Deactivating..." : "Deactivate Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
