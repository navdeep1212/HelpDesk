import React from 'react';

const CATEGORY_CONFIG = {
  TECHNICAL: { label: 'Technical', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  BILLING: { label: 'Billing', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  GENERAL: { label: 'General', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  FEATURE_REQUEST: { label: 'Feature Request', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  BUG_REPORT: { label: 'Bug Report', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const CategoryBadge = ({ category }) => {
  const config = CATEGORY_CONFIG[category] || {
    label: category || 'General',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
};

export default CategoryBadge;
