import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ticketApi } from '../../api/ticketApi';
import { agentApi } from '../../api/agentApi';
import StatusBadge from '../../components/tickets/StatusBadge';
import PriorityBadge from '../../components/tickets/PriorityBadge';
import CategoryBadge from '../../components/tickets/CategoryBadge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const AgentTicketDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Agent Actions State
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);

  // Comment State
  const [newCommentBody, setNewCommentBody] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const loadTicketAndMeta = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [ticketData, commentsData, activitiesData, agentsData] = await Promise.all([
        ticketApi.getTicketById(id),
        ticketApi.getTicketComments(id),
        ticketApi.getTicketActivities(id),
        agentApi.getAllAgents(),
      ]);

      setTicket(ticketData);
      setComments(commentsData);
      setActivities(activitiesData);
      setAgentsList(agentsData);

      setSelectedStatus(ticketData.status);
      setSelectedPriority(ticketData.priority);
      setSelectedAgentId(ticketData.assignedTo?.id ? String(ticketData.assignedTo.id) : '');
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Ticket not found or has been soft-deleted.');
      } else {
        setError(err.response?.data?.message || 'Failed to load ticket details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTicketAndMeta();
  }, [loadTicketAndMeta]);

  // Refresh activities
  const refreshActivities = async () => {
    try {
      const acts = await ticketApi.getTicketActivities(id);
      setActivities(acts);
    } catch (err) {
      console.warn('Failed to refresh activities:', err);
    }
  };

  // Status Update
  const handleStatusChange = async (newStatus) => {
    if (newStatus === ticket.status) return;
    setUpdatingStatus(true);
    setActionSuccess('');
    setError('');
    try {
      const updated = await agentApi.updateStatus(id, newStatus);
      setTicket((prev) => ({ ...prev, status: updated.status, resolvedAt: updated.resolvedAt, closedAt: updated.closedAt }));
      setSelectedStatus(updated.status);
      setActionSuccess(`Ticket status updated to ${updated.status}.`);
      await refreshActivities();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Priority Update
  const handlePriorityChange = async (newPriority) => {
    if (newPriority === ticket.priority) return;
    setUpdatingPriority(true);
    setActionSuccess('');
    setError('');
    try {
      const updated = await agentApi.updatePriority(id, newPriority);
      setTicket((prev) => ({ ...prev, priority: updated.priority }));
      setSelectedPriority(updated.priority);
      setActionSuccess(`Ticket priority updated to ${updated.priority}.`);
      await refreshActivities();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update priority.');
    } finally {
      setUpdatingPriority(false);
    }
  };

  // Assignment Update (select agent or unassign)
  const handleAssignmentChange = async (agentIdValue) => {
    setUpdatingAssignment(true);
    setActionSuccess('');
    setError('');
    const agentId = agentIdValue ? Number(agentIdValue) : null;
    try {
      const updated = await agentApi.assignTicket(id, agentId);
      setTicket((prev) => ({ ...prev, assignedTo: updated.assignedTo }));
      setSelectedAgentId(agentIdValue);
      setActionSuccess(
        updated.assignedTo
          ? `Ticket assigned to ${updated.assignedTo.fullName}.`
          : 'Ticket unassigned and returned to queue.'
      );
      await refreshActivities();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update assignment.');
    } finally {
      setUpdatingAssignment(false);
    }
  };

  // Quick Assign to Self
  const handleAssignToMe = async () => {
    if (user?.id) {
      await handleAssignmentChange(String(user.id));
    }
  };

  // Add Comment (Public or Internal)
  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!newCommentBody.trim()) {
      setCommentError('Comment body cannot be blank.');
      return;
    }

    setSubmittingComment(true);
    setCommentError('');
    setActionSuccess('');

    try {
      const createdComment = await ticketApi.addComment(id, {
        body: newCommentBody,
        internal: isInternalComment,
      });

      setComments((prev) => [...prev, createdComment]);
      setNewCommentBody('');
      setIsInternalComment(false);
      setActionSuccess(
        createdComment.internal
          ? 'Internal note added (visible only to agents).'
          : 'Public reply posted to customer.'
      );
      await refreshActivities();
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <LoadingSpinner size="lg" text="Loading ticket details..." />
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert type="error" message={error} />
        <div>
          <Link
            to="/agent/tickets"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Global Queue</span>
          </Link>
        </div>
      </div>
    );
  }

  const isAssignedToMe = ticket.assignedTo?.id === user?.id;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/agent/tickets" className="hover:text-purple-700">All Tickets</Link>
            <span>/</span>
            <span className="font-mono text-slate-800 font-semibold">#{ticket.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {ticket.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
      </div>

      {actionSuccess && (
        <Alert type="success" message={actionSuccess} onClose={() => setActionSuccess('')} />
      )}
      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}

      {/* Agent Action Bar */}
      <div className="bg-purple-50/70 border border-purple-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
              Agent Action Panel
            </span>
          </div>

          {!isAssignedToMe && (
            <button
              onClick={handleAssignToMe}
              disabled={updatingAssignment}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {updatingAssignment ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Assign to Me</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Status Select */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-purple-900 mb-1">
              Change Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:bg-purple-100"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {updatingStatus && <LoadingSpinner size="sm" />}
            </div>
          </div>

          {/* Priority Select */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-purple-900 mb-1">
              Change Priority
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedPriority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={updatingPriority}
                className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:bg-purple-100"
              >
                {PRIORITY_OPTIONS.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
              {updatingPriority && <LoadingSpinner size="sm" />}
            </div>
          </div>

          {/* Assignment Select */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-purple-900 mb-1">
              Assigned Agent
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedAgentId}
                onChange={(e) => handleAssignmentChange(e.target.value)}
                disabled={updatingAssignment}
                className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:bg-purple-100"
              >
                <option value="">-- Unassigned (In Queue) --</option>
                {agentsList.map((ag) => (
                  <option key={ag.id} value={String(ag.id)}>
                    {ag.fullName} {ag.id === user?.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
              {updatingAssignment && <LoadingSpinner size="sm" />}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details + Discussion & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Description & Comments Thread */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Description Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Customer Problem Statement
            </h2>
            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>Submitted by:</span>
                <span className="font-semibold text-slate-800">
                  {ticket.createdBy?.fullName || ticket.createdBy?.username}
                </span>
                <span className="text-slate-400">({ticket.createdBy?.email})</span>
              </div>
              <div>
                Created on{' '}
                {new Date(ticket.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
          </div>

          {/* Discussion Thread (Public & Internal Notes) */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">Ticket Conversation</h2>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              </div>
              <span className="text-xs text-slate-500">Public replies &amp; internal notes</span>
            </div>

            {/* Comments List */}
            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No replies or notes yet. Use the composer below to reply or document an internal investigation.
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const isAgentAuthor = comment.author?.role === 'AGENT';
                  const isInternal = Boolean(comment.internal);

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border text-sm transition-all ${
                        isInternal
                          ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                          : isAgentAuthor
                          ? 'bg-purple-50/50 border-purple-100'
                          : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-xs">
                            {comment.author?.fullName || comment.author?.username}
                          </span>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isAgentAuthor
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            {isAgentAuthor ? 'Support Agent' : 'Customer'}
                          </span>

                          {isInternal && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span>Internal Note (Agents Only)</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Post Comment / Internal Note Form */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-slate-100 space-y-3">
              {commentError && (
                <Alert type="error" message={commentError} onClose={() => setCommentError('')} />
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="newComment" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {isInternalComment ? 'Add Internal Note' : 'Reply to Customer'}
                  </label>

                  {/* Internal Note Toggle */}
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded-sm border-slate-300 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Mark as Internal Note (hidden from customer)
                    </span>
                  </label>
                </div>

                <textarea
                  id="newComment"
                  rows={4}
                  value={newCommentBody}
                  onChange={(e) => {
                    setNewCommentBody(e.target.value);
                    if (commentError) setCommentError('');
                  }}
                  disabled={submittingComment}
                  placeholder={
                    isInternalComment
                      ? 'Document technical investigation, internal root cause analysis, or handover notes...'
                      : 'Type official response or update to the customer...'
                  }
                  className={`w-full px-3.5 py-2.5 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-100 ${
                    isInternalComment
                      ? 'bg-amber-50/50 border border-amber-300 text-amber-950 focus:ring-amber-500/20 focus:border-amber-500'
                      : 'bg-slate-50 border border-slate-300 text-slate-900 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {isInternalComment
                    ? '⚠️ Customer will NOT see this comment.'
                    : '🌐 This message will be visible to the customer.'}
                </span>

                <button
                  type="submit"
                  disabled={submittingComment || !newCommentBody.trim()}
                  className={`px-4 py-2 font-medium text-xs rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                    isInternalComment
                      ? 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500'
                      : 'bg-purple-700 hover:bg-purple-800 text-white focus:ring-purple-500'
                  }`}
                >
                  {submittingComment ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>{isInternalComment ? 'Post Internal Note' : 'Post Reply to Customer'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Customer Info, Metadata, & Activity Timeline */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Customer Information
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">
                {ticket.createdBy?.fullName?.charAt(0) || 'C'}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{ticket.createdBy?.fullName}</p>
                <p className="text-xs text-slate-500">{ticket.createdBy?.email}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Username:</span>
              <span className="font-mono text-slate-700">{ticket.createdBy?.username}</span>
            </div>
          </div>

          {/* Ticket Lifecycle Metadata */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Lifecycle Timestamps
            </h3>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </dd>
              </div>

              {ticket.resolvedAt && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Resolved</dt>
                  <dd className="font-medium text-emerald-700">
                    {new Date(ticket.resolvedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              )}

              {ticket.closedAt && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Closed</dt>
                  <dd className="font-medium text-slate-700">
                    {new Date(ticket.closedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity Audit Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Activity History
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
            ) : (
              <div className="relative pl-5 border-l-2 border-slate-200 space-y-4 my-2">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-600 ring-2 ring-white" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {act.description || act.actionType}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span>by {act.actor?.fullName || act.actor?.username || 'System'}</span>
                        <span>•</span>
                        <span>
                          {new Date(act.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentTicketDetailPage;
