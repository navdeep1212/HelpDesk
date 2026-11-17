import React, { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const AppLayout = () => {
  const { user, isAgent, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  // Role-based navigation links
  const customerNavLinks = [
    { to: '/', label: 'Dashboard', exact: true },
    { to: '/tickets', label: 'My Tickets', exact: true },
    { to: '/tickets/create', label: 'New Ticket', exact: true },
  ];

  const agentNavLinks = [
    { to: '/agent', label: 'Agent Dashboard', exact: true },
    { to: '/agent/tickets', label: 'All Tickets', exact: true },
  ];

  const currentNavLinks = isAgent ? agentNavLinks : customerNavLinks;

  const isActive = (path, exact) => {
    if (exact && (path === '/' || path === '/agent')) {
      return (
        location.pathname === path ||
        location.pathname === `${path}/` ||
        location.pathname === `${path}/dashboard`
      );
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const homePath = isAgent ? '/agent' : '/';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Role-specific Navigation */}
          <div className="flex items-center gap-8">
            <Link to={homePath} className="flex items-center gap-2.5 text-slate-900 font-bold text-lg hover:opacity-90">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${
                  isAgent
                    ? 'bg-purple-700 shadow-purple-500/20'
                    : 'bg-brand-600 shadow-brand-500/20'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="tracking-tight">
                HelpDesk <span className={isAgent ? 'text-purple-700' : 'text-brand-600'}>Pro</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {currentNavLinks.map((link) => {
                const active = isActive(link.to, link.exact);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? isAgent
                          ? 'bg-purple-50 text-purple-800 font-bold'
                          : 'bg-brand-50 text-brand-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section: Role Badge, User Info, Mobile Toggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${
                isAgent
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-brand-50 text-brand-700 border-brand-200'
              }`}
            >
              {isAgent ? 'Support Agent' : 'Customer Portal'}
            </span>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800">
                {user?.fullName || user?.username}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">{user?.email}</span>
            </div>

            <div
              className={`w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center ring-2 ring-white shadow-xs ${
                isAgent
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-brand-100 text-brand-800'
              }`}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200 disabled:opacity-50"
              title="Sign Out"
            >
              {loggingOut ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign out</span>
                </>
              )}
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-3 space-y-1 shadow-sm">
            {currentNavLinks.map((link) => {
              const active = isActive(link.to, link.exact);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    active
                      ? isAgent
                        ? 'bg-purple-50 text-purple-800 font-bold'
                        : 'bg-brand-50 text-brand-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
