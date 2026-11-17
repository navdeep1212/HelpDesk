import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { agentApi } from '../../api/agentApi';
import StatusBadge from '../../components/tickets/StatusBadge';
import PriorityBadge from '../../components/tickets/PriorityBadge';
import CategoryBadge from '../../components/tickets/CategoryBadge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const AgentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    assignedToMe: 0,
    unassignedRecentCount: 0,
    recentTickets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await agentApi.getAgentStats();
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load agent statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Agent Console — {user?.fullName || user?.username}
            </h1>
            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Support Agent
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Global ticket queue management, customer correspondence, assignment distribution, and internal engineering notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/agent/tickets?assignedToMe=true"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-xl shadow-sm shadow-purple-500/20 transition-all hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>My Assigned Tickets</span>
          </Link>

          <Link
            to="/agent/tickets"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <span>All Tickets Queue</span>
          </Link>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <LoadingSpinner size="lg" text="Loading agent console statistics..." />
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Assigned to Me */}
            <Link
              to="/agent/tickets?assignedToMe=true"
              className="bg-white p-5 rounded-2xl border border-purple-200/90 shadow-sm hover:border-purple-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Assigned to Me</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-purple-800">{stats.assignedToMe}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Direct responsibility</span>
            </Link>

            {/* Total Global */}
            <Link
              to="/agent/tickets"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.total}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">System-wide tickets</span>
            </Link>

            {/* Open */}
            <Link
              to="/agent/tickets?status=OPEN"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Open</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-blue-700">{stats.open}</div>
              <span className="text-xs text-slate-500 mt-1 inline-block">Awaiting triage</span>
            </Link>

            {/* In Progress */}
            <Link
              to="/agent/tickets?status=IN_PROGRESS"
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
              <span className="text-xs text-slate-500 mt-1 inline-block">Under investigation</span>
            </Link>

            {/* Resolved */}
            <Link
              to="/agent/tickets?status=RESOLVED"
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
              to="/agent/tickets?status=CLOSED"
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
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
              <span className="text-xs text-slate-500 mt-1 inline-block">Archived issues</span>
            </Link>
          </div>

          {/* Recent Global Ticket Queue */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Incoming Ticket Feed</h2>
                <p className="text-xs text-slate-500">Latest tickets submitted across all client accounts</p>
              </div>
              <Link
                to="/agent/tickets"
                className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1"
              >
                <span>View complete queue</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {stats.recentTickets.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-500 text-xs">
                No tickets in the system yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 sm:px-6">Ticket</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned Agent</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {stats.recentTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                          <Link
                            to={`/agent/tickets/${t.id}`}
                            className="hover:text-purple-700 transition-colors flex items-center gap-2 group"
                          >
                            <span className="text-xs font-mono text-slate-400 group-hover:text-purple-600">
                              #{t.id}
                            </span>
                            <span className="truncate max-w-xs font-semibold text-slate-900 group-hover:text-purple-700">
                              {t.title}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                          {t.createdBy?.fullName || t.createdBy?.username || 'Customer'}
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
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                          {t.assignedTo ? (
                            <span className="inline-flex items-center gap-1 font-medium text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              <span>{t.assignedTo.fullName}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                              <span>Unassigned</span>
                            </span>
                          )}
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
                            to={`/agent/tickets/${t.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md transition-colors"
                          >
                            <span>Manage</span>
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

export default AgentDashboard;
