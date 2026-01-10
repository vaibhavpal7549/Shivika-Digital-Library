import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userData, loading: userLoading } = useUser();
  const { socket, connected, joinAdminRoom, leaveAdminRoom } = useSocket();

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [newSeat, setNewSeat] = useState('');
  const [newShift, setNewShift] = useState('fullday');
  const [extensionMonths, setExtensionMonths] = useState(1);
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [customValidUntil, setCustomValidUntil] = useState('');

  // Verify admin access
  useEffect(() => {
    if (!userLoading && userData) {
      if (userData.role !== 'admin') {
        navigate('/dashboard');
      }
    }
  }, [userData, userLoading, navigate]);

  // Fetch stats and users
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`),
        fetch(`${API_URL}/api/admin/users?adminUid=${currentUser?.uid}`)
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success) setUsers(usersData.users);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // Subscribe to Socket.IO updates
  useEffect(() => {
    if (socket && joinAdminRoom) {
      // Join admin room for admin-specific updates
      joinAdminRoom();
      
      // Listen for updates
      socket.on('seat:booked', () => fetchData());
      socket.on('seat:released', () => fetchData());
      socket.on('seat:changed', () => fetchData());
      socket.on('payment:completed', () => fetchData());
      socket.on('payment:status-update', () => fetchData());
      socket.on('user:registered', () => fetchData());
      socket.on('admin:stats', () => fetchData());

      return () => {
        leaveAdminRoom?.();
        socket.off('seat:booked');
        socket.off('seat:released');
        socket.off('seat:changed');
        socket.off('payment:completed');
        socket.off('payment:status-update');
        socket.off('user:registered');
        socket.off('admin:stats');
      };
    }
  }, [socket, joinAdminRoom, leaveAdminRoom, fetchData]);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'withSeat') return matchesSearch && user.seat?.seatNumber;
    if (filterStatus === 'withoutSeat') return matchesSearch && !user.seat?.seatNumber;
    if (filterStatus === 'paid') return matchesSearch && user.paymentStatus === 'PAID';
    if (filterStatus === 'pending') return matchesSearch && user.paymentStatus === 'PENDING';
    if (filterStatus === 'overdue') return matchesSearch && user.paymentStatus === 'OVERDUE';
    return matchesSearch;
  });

  // Open modal for specific action
  const openModal = (type, user) => {
    setSelectedUser(user);
    setModalType(type);
    setShowModal(true);
    setNewSeat(user.seat?.seatNumber?.toString() || '');
    setNewShift(user.seat?.shift || 'fullday');
    setNewPaymentStatus(user.paymentStatus || 'PENDING');
    setExtensionMonths(1);
    setCustomValidUntil(user.seat?.validUntil 
      ? new Date(user.seat.validUntil).toISOString().split('T')[0] 
      : '');
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setModalType('');
    setError(null);
  };

  // Show success message
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Change user's seat
  const handleChangeSeat = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/api/admin/users/${selectedUser.firebaseUid}/seat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatNumber: newSeat ? parseInt(newSeat) : null,
          shift: newShift,
          validUntil: customValidUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          adminUid: currentUser?.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        fetchData();
        closeModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to change seat');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove user's seat
  const handleRemoveSeat = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(
        `${API_URL}/api/admin/users/${selectedUser.firebaseUid}/seat?adminUid=${currentUser?.uid}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        showSuccess('Seat removed successfully');
        fetchData();
        closeModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to remove seat');
    } finally {
      setActionLoading(false);
    }
  };

  // Extend validity
  const handleExtendValidity = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/api/admin/users/${selectedUser.firebaseUid}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months: extensionMonths,
          adminUid: currentUser?.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        fetchData();
        closeModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to extend validity');
    } finally {
      setActionLoading(false);
    }
  };

  // Update payment status
  const handleUpdatePayment = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/api/admin/users/${selectedUser.firebaseUid}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newPaymentStatus,
          validUntil: customValidUntil || null,
          adminUid: currentUser?.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Payment status updated');
        fetchData();
        closeModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get payment status badge
  const getPaymentBadge = (status) => {
    const badges = {
      PAID: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      OVERDUE: 'bg-red-100 text-red-800',
      EXEMPT: 'bg-blue-100 text-blue-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!currentUser || userData?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-purple-700">Admin Panel</h1>
            {connected && (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 text-green-800 rounded-lg flex items-center gap-2">
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-purple-700">{stats.users.total}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Booked Seats</p>
              <p className="text-2xl font-bold text-blue-600">{stats.seats.booked}/{stats.seats.total}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Paid Users</p>
              <p className="text-2xl font-bold text-green-600">{stats.payments.paid}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Pending/Overdue</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats.payments.pending + stats.payments.overdue}
              </p>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
            >
              <option value="all">All Users</option>
              <option value="withSeat">With Seat</option>
              <option value="withoutSeat">Without Seat</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Seat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Valid Until</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400">{user.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.seat?.seatNumber ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                            Seat {user.seat.seatNumber}
                          </span>
                          <p className="text-xs text-gray-500 mt-1 capitalize">{user.seat.shift}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">No seat</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.seat?.validUntil ? (
                        <div>
                          <p className="text-sm">{formatDate(user.seat.validUntil)}</p>
                          {new Date(user.seat.validUntil) < new Date() && (
                            <span className="text-xs text-red-500">Expired</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentBadge(user.paymentStatus)}`}>
                        {user.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal('seat', user)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Change Seat"
                        >
                          🪑
                        </button>
                        <button
                          onClick={() => openModal('extend', user)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="Extend Validity"
                          disabled={!user.seat?.seatNumber}
                        >
                          📅
                        </button>
                        <button
                          onClick={() => openModal('payment', user)}
                          className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          title="Update Payment"
                        >
                          💰
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found matching your criteria
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </main>

      {/* Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {modalType === 'seat' && '🪑 Change Seat'}
                {modalType === 'extend' && '📅 Extend Validity'}
                {modalType === 'payment' && '💰 Update Payment'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">{selectedUser.name}</p>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
              {selectedUser.seat?.seatNumber && (
                <p className="text-sm text-purple-600 mt-1">
                  Current: Seat {selectedUser.seat.seatNumber} ({selectedUser.seat.shift})
                </p>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* Seat Change Form */}
            {modalType === 'seat' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seat Number (1-60)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newSeat}
                    onChange={(e) => setNewSeat(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                    placeholder="Enter seat number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift
                  </label>
                  <select
                    value={newShift}
                    onChange={(e) => setNewShift(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                  >
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="fullday">Full Day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={customValidUntil}
                    onChange={(e) => setCustomValidUntil(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleChangeSeat}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : 'Update Seat'}
                  </button>
                  {selectedUser.seat?.seatNumber && (
                    <button
                      onClick={handleRemoveSeat}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Extend Validity Form */}
            {modalType === 'extend' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extend By (months)
                  </label>
                  <select
                    value={extensionMonths}
                    onChange={(e) => setExtensionMonths(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                  >
                    {[1, 2, 3, 6, 12].map(m => (
                      <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <p><strong>Current validity:</strong> {formatDate(selectedUser.seat?.validUntil)}</p>
                  <p className="text-purple-600">
                    <strong>New validity:</strong> {formatDate(
                      new Date(new Date(selectedUser.seat?.validUntil || Date.now())
                        .setMonth(new Date(selectedUser.seat?.validUntil || Date.now()).getMonth() + extensionMonths))
                    )}
                  </p>
                </div>
                <button
                  onClick={handleExtendValidity}
                  disabled={actionLoading || !selectedUser.seat?.seatNumber}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Extending...' : `Extend by ${extensionMonths} month(s)`}
                </button>
              </div>
            )}

            {/* Payment Status Form */}
            {modalType === 'payment' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="EXEMPT">Exempt</option>
                  </select>
                </div>
                {selectedUser.seat?.seatNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seat Valid Until (optional)
                    </label>
                    <input
                      type="date"
                      value={customValidUntil}
                      onChange={(e) => setCustomValidUntil(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:shadow-lg focus:shadow-purple-500/20 focus:outline-none transition-all duration-300"
                    />
                  </div>
                )}
                <button
                  onClick={handleUpdatePayment}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Update Payment Status'}
                </button>
              </div>
            )}

            <button
              onClick={closeModal}
              className="w-full mt-4 px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
