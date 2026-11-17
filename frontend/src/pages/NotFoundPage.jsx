import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl font-black text-slate-300 mb-2">404</div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-600 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
