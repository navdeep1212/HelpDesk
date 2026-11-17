import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ticketApi } from '../../api/ticketApi';
import StatusBadge from '../../components/tickets/StatusBadge';
import PriorityBadge from '../../components/tickets/PriorityBadge';
import CategoryBadge from '../../components/tickets/CategoryBadge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const CustomerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    recentTickets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ticketApi.getCustomerStats();
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {user?.fullName || user?.username}!
            </h1>
            <span className="bg-brand-50 text-brand-700 border border-brand-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Customer Portal
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Submit support requests, track ongoing resolutions, and collaborate directly with our engineering and support specialists.
          </p>
        </div>

        <Link
          to="/tickets/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl shadow-sm shadow-brand-500/20 transition-all hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New Ticket</span>
        </Link>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
        />
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <LoadingSpinner size="lg" text="Loading your dashboard..." />
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Tickets */}
            <Link
              to="/tickets"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.total}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">All your tickets</span>
            </Link>

            {/* Open */}
            <Link
              to="/tickets?status=OPEN"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Open</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-blue-700">{stats.open}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Awaiting response</span>
            </Link>

            {/* In Progress */}
            <Link
              to="/tickets?status=IN_PROGRESS"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Progress</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-amber-700">{stats.inProgress}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Being resolved</span>
            </Link>

            {/* Resolved */}
            <Link
              to="/tickets?status=RESOLVED"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-emerald-700">{stats.resolved}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Solution provided</span>
            </Link>

            {/* Closed */}
            <Link
              to="/tickets?status=CLOSED"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group col-span-2 lg:col-span-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closed</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-700">{stats.closed}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Completed &amp; archived</span>
            </Link>
          </div>

          {/* Recent Tickets Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Tickets</h2>
                <p className="text-xs text-slate-500">Your latest created support requests</p>
              </div>
              <Link
                to="/tickets"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>View all tickets</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {stats.recentTickets.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-800">No tickets found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  You haven&apos;t created any support tickets yet. Click below to submit your first issue.
                </p>
                <div className="mt-4">
                  <Link
                    to="/tickets/create"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
                  >
                    <span>Create Ticket</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 sm:px-6">Ticket</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {stats.recentTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                          <Link
                            to={`/tickets/${t.id}`}
                            className="hover:text-brand-600 transition-colors flex items-center gap-2 group"
                          >
                            <span className="text-xs font-mono text-slate-400 group-hover:text-brand-500">
                              #{t.id}
                            </span>
                            <span className="truncate max-w-xs sm:max-w-md font-semibold text-slate-900 group-hover:text-brand-600">
                              {t.title}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <CategoryBadge category={t.category} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(t.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <Link
                            to={`/tickets/${t.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md transition-colors"
                          >
                            <span>View</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerDashboard;
