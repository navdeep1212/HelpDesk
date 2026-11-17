import React from 'react';

const PRIORITY_CONFIG = {
  LOW: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    barColor: 'bg-slate-400',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
    barColor: 'bg-sky-500',
  },
  HIGH: {
    label: 'High',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    barColor: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    barColor: 'bg-rose-500',
  },
};

export const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority || 'Unknown',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    barColor: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.barColor}`} />
      <span>{config.label}</span>
    </span>
  );
};

export default PriorityBadge;
