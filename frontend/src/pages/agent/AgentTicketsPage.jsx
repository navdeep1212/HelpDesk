import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ticketApi } from '../../api/ticketApi';
import { agentApi } from '../../api/agentApi';
import StatusBadge from '../../components/tickets/StatusBadge';
import PriorityBadge from '../../components/tickets/PriorityBadge';
import CategoryBadge from '../../components/tickets/CategoryBadge';
import Pagination from '../../components/tickets/Pagination';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'GENERAL', label: 'General' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'BUG_REPORT', label: 'Bug Report' },
];

export const AgentTicketsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters state
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [assignmentFilter, setAssignmentFilter] = useState(
    searchParams.get('assignedToMe') === 'true'
      ? 'ME'
      : searchParams.get('assignedToId') || ''
  );
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '0', 10));

  // Agents list for assignment filter dropdown
  const [agentsList, setAgentsList] = useState([]);

  // Data state
  const [pagedData, setPagedData] = useState({
    content: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch agents list once
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await agentApi.getAllAgents();
        setAgentsList(agents);
      } catch (err) {
        console.warn('Failed to load agents list:', err);
      }
    };
    loadAgents();
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');

    const assignedToMe = assignmentFilter === 'ME' ? true : undefined;
    const assignedToId =
      assignmentFilter && assignmentFilter !== 'ME' ? Number(assignmentFilter) : undefined;

    try {
      const response = await ticketApi.getTickets({
        keyword: keyword || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        assignedToMe,
        assignedToId,
        page,
        size: 10,
        sort: 'createdAt,desc',
      });

      setPagedData(
        response || {
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
          first: true,
          last: true,
        }
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tickets.');
    } finally {
      setLoading(false);
    }
  }, [keyword, status, priority, category, assignmentFilter, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Update query params
  const updateFilterParam = (key, value) => {
    setPage(0);
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '0');
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateFilterParam('keyword', keyword);
  };

  const handleAssignmentChange = (e) => {
    const val = e.target.value;
    setAssignmentFilter(val);
    setPage(0);
    const newParams = new URLSearchParams(searchParams);
    if (val === 'ME') {
      newParams.set('assignedToMe', 'true');
      newParams.delete('assignedToId');
    } else if (val) {
      newParams.set('assignedToId', val);
      newParams.delete('assignedToMe');
    } else {
      newParams.delete('assignedToMe');
      newParams.delete('assignedToId');
    }
    newParams.set('page', '0');
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setKeyword('');
    setStatus('');
    setPriority('');
    setCategory('');
    setAssignmentFilter('');
    setPage(0);
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = Boolean(
    keyword || status || priority || category || assignmentFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Global Support Queue</h1>
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200">
              Agent View
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Monitor, assign, update priority, triage and resolve client tickets across all customer organizations.
          </p>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2 lg:col-span-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search title..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
            <button
              type="submit"
              className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              title="Search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateFilterParam('status', e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                updateFilterParam('priority', e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                updateFilterParam('category', e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignment Filter */}
          <div>
            <select
              value={assignmentFilter}
              onChange={handleAssignmentChange}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">All Assignments</option>
              <option value="ME">Assigned to Me</option>
              <optgroup label="Specific Agent">
                {agentsList.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.fullName || ag.username}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active on agent queue</span>
            <button
              onClick={handleClearFilters}
              className="text-purple-700 hover:text-purple-800 font-medium underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Tickets List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <LoadingSpinner size="lg" text="Loading ticket queue..." />
          </div>
        ) : pagedData.content.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-800">No tickets found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No tickets match your filter criteria. Try adjusting or clearing your filters.
            </p>
            {hasActiveFilters && (
              <div className="mt-4">
                <button
                  onClick={handleClearFilters}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
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
                  {pagedData.content.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                        <Link
                          to={`/agent/tickets/${ticket.id}`}
                          className="hover:text-purple-700 transition-colors flex items-center gap-2 group"
                        >
                          <span className="text-xs font-mono text-slate-400 group-hover:text-purple-600">
                            #{ticket.id}
                          </span>
                          <span className="truncate max-w-xs font-semibold text-slate-900 group-hover:text-purple-700">
                            {ticket.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                        {ticket.createdBy?.fullName || ticket.createdBy?.username || 'Customer'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <CategoryBadge category={ticket.category} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {ticket.assignedTo ? (
                          <span className="inline-flex items-center gap-1 font-medium text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            <span>{ticket.assignedTo.fullName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Unassigned</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link
                          to={`/agent/tickets/${ticket.id}`}
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

            <div className="px-4 sm:px-6 border-t border-slate-100 bg-slate-50/40">
              <Pagination
                page={pagedData.page}
                totalPages={pagedData.totalPages}
                totalElements={pagedData.totalElements}
                pageSize={pagedData.size}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AgentTicketsPage;
