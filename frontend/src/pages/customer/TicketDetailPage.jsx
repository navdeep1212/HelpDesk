import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ticketApi } from '../../api/ticketApi';
import StatusBadge from '../../components/tickets/StatusBadge';
import PriorityBadge from '../../components/tickets/PriorityBadge';
import CategoryBadge from '../../components/tickets/CategoryBadge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const TicketDetailPage = () => {
  const { id } = useParams();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comment submission state
  const [newCommentBody, setNewCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');

  const fetchTicketData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [ticketData, commentsData, activitiesData] = await Promise.all([
        ticketApi.getTicketById(id),
        ticketApi.getTicketComments(id),
        ticketApi.getTicketActivities(id),
      ]);

      setTicket(ticketData);
      setComments(commentsData);
      setActivities(activitiesData);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Ticket not found or has been removed.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this ticket.');
      } else {
        setError(err.response?.data?.message || 'Failed to load ticket details.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicketData();
  }, [fetchTicketData]);

  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!newCommentBody.trim()) {
      setCommentError('Comment message cannot be empty.');
      return;
    }

    setSubmittingComment(true);
    setCommentError('');
    setCommentSuccess('');

    try {
      const createdComment = await ticketApi.addComment(id, {
        body: newCommentBody,
      });

      setComments((prev) => [...prev, createdComment]);
      setNewCommentBody('');
      setCommentSuccess('Comment added successfully.');

      // Refresh activity timeline to show new comment activity
      const updatedActivities = await ticketApi.getTicketActivities(id);
      setActivities(updatedActivities);
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to post comment. Please try again.');
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

  if (error) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert type="error" message={error} />
        <div>
          <Link
            to="/tickets"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to My Tickets</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/tickets" className="hover:text-slate-800">Tickets</Link>
            <span>/</span>
            <span className="font-mono text-slate-800 font-semibold">#{ticket.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {ticket.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
      </div>

      {/* Main Grid: Left Details & Comments, Right Sidebar Metadata & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Ticket Info & Comments (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Description Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Description
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

          {/* Comments Discussion Section */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Conversation</h2>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              </div>
              <span className="text-xs text-slate-500">Public correspondence</span>
            </div>

            {/* Comments List */}
            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No replies or messages yet. Post a comment below to update our team.
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const isAgentAuthor = comment.author?.role === 'AGENT';
                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border text-sm transition-all ${
                        isAgentAuthor
                          ? 'bg-purple-50/50 border-purple-100'
                          : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">
                            {comment.author?.fullName || comment.author?.username || 'User'}
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

            {/* Post Comment Form */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-slate-100 space-y-3">
              {commentError && (
                <Alert type="error" message={commentError} onClose={() => setCommentError('')} />
              )}
              {commentSuccess && (
                <Alert type="success" message={commentSuccess} onClose={() => setCommentSuccess('')} />
              )}

              <div>
                <label htmlFor="newComment" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Add a Reply
                </label>
                <textarea
                  id="newComment"
                  rows={3}
                  value={newCommentBody}
                  onChange={(e) => {
                    setNewCommentBody(e.target.value);
                    if (commentError) setCommentError('');
                  }}
                  disabled={submittingComment}
                  placeholder="Type additional details, follow-up questions, or confirmation here..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors disabled:bg-slate-100"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={submittingComment || !newCommentBody.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {submittingComment ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Post Reply</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Metadata & Activity Timeline (1 col) */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Ticket Details
            </h3>

            <dl className="space-y-3.5 text-xs">
              <div>
                <dt className="text-slate-500 mb-1">Status</dt>
                <dd>
                  <StatusBadge status={ticket.status} />
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 mb-1">Priority</dt>
                <dd>
                  <PriorityBadge priority={ticket.priority} />
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 mb-1">Category</dt>
                <dd>
                  <CategoryBadge category={ticket.category} />
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Assigned Support Agent</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  {ticket.assignedTo ? (
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-semibold text-[10px] flex items-center justify-center">
                        {ticket.assignedTo.fullName?.charAt(0) || 'A'}
                      </div>
                      <span>{ticket.assignedTo.fullName}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned (In Queue)</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-800 mt-0.5">
                  {new Date(ticket.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>

              {ticket.resolvedAt && (
                <div>
                  <dt className="text-slate-500">Resolved</dt>
                  <dd className="font-medium text-emerald-700 mt-0.5">
                    {new Date(ticket.resolvedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
              )}

              {ticket.closedAt && (
                <div>
                  <dt className="text-slate-500">Closed</dt>
                  <dd className="font-medium text-slate-700 mt-0.5">
                    {new Date(ticket.closedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity Timeline Card */}
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
                    {/* Circle icon on line */}
                    <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-brand-500 ring-2 ring-white" />
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

export default TicketDetailPage;
