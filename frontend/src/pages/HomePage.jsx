import React from 'react';
import { useAuth } from '../context/AuthContext';

export const HomePage = () => {
  const { user, isAgent } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {user?.fullName}!
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isAgent
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-brand-50 text-brand-700 border border-brand-200'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            {isAgent
              ? 'You have agent privileges: view all customer tickets, assign agents, update status and post internal comments.'
              : 'You are signed in as a customer: submit support tickets, view status updates and communicate with our agents.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Authentication Active (Memory Token)</span>
        </div>
      </div>

      {/* User Session Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            User Profile
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Username</dt>
              <dd className="font-medium text-slate-900">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Account ID</dt>
              <dd className="font-medium text-slate-900">#{user?.id}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Security &amp; Tokens
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Access Token Storage</dt>
              <dd className="font-medium text-emerald-700 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                JavaScript Memory Only
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Refresh Strategy</dt>
              <dd className="font-medium text-slate-900">HttpOnly /api/auth Cookie</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="font-medium text-emerald-700">Active &amp; Verified</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Frontend Architecture
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Phase 4 Foundation ready: Axios request &amp; response interceptors, single-flight token rotation queue,
            role guards, and public/protected routes are verified.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Next Phase</span>
            <span className="font-semibold text-brand-600">Phase 5: Ticket UI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
