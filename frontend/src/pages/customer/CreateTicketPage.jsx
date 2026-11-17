import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ticketApi } from '../../api/ticketApi';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const CATEGORIES = [
  { value: 'TECHNICAL', label: 'Technical Issue', description: 'System errors, network drops, software issues' },
  { value: 'BILLING', label: 'Billing & Payments', description: 'Invoices, subscriptions, payment questions' },
  { value: 'GENERAL', label: 'General Inquiry', description: 'Questions regarding services, accounts or usage' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request', description: 'Suggest an improvement or new capability' },
  { value: 'BUG_REPORT', label: 'Bug Report', description: 'Reproducible defects or broken application behavior' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', description: 'Minor inconvenience; work is not impacted' },
  { value: 'MEDIUM', label: 'Medium', description: 'Standard priority; work continues with workaround' },
  { value: 'HIGH', label: 'High', description: 'Significant impact on day-to-day operations' },
  { value: 'CRITICAL', label: 'Critical', description: 'Complete system outage or blocker' },
];

export const CreateTicketPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    category: 'TECHNICAL',
    priority: 'MEDIUM',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const validate = () => {
    if (!formData.title.trim()) {
      return 'Ticket title is required.';
    }
    if (formData.title.trim().length > 200) {
      return 'Ticket title cannot exceed 200 characters.';
    }
    if (!formData.category) {
      return 'Please select a ticket category.';
    }
    if (!formData.priority) {
      return 'Please select a priority level.';
    }
    if (!formData.description.trim()) {
      return 'Ticket description is required.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const clientError = validate();
    if (clientError) {
      setErrorMessage(clientError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const createdTicket = await ticketApi.createTicket({
        title: formData.title,
        category: formData.category,
        priority: formData.priority,
        description: formData.description,
      });

      setSuccessMessage('Ticket created successfully! Redirecting...');
      setTimeout(() => {
        navigate(`/tickets/${createdTicket.id}`, { replace: true });
      }, 700);
    } catch (err) {
      const backendError =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to create ticket. Please check your inputs.';
      setErrorMessage(backendError);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/tickets" className="hover:text-slate-800">Tickets</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Create Ticket</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Support Ticket</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit a new ticket describing the problem. Our support team will review and respond promptly.
          </p>
        </div>

        <Link
          to="/tickets"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-sm"
        >
          Cancel
        </Link>
      </div>

      {errorMessage && (
        <Alert type="error" message={errorMessage} onClose={() => setErrorMessage('')} />
      )}

      {successMessage && (
        <Alert type="success" message={successMessage} />
      )}

      {/* Ticket Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="title" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Ticket Title <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">
              {formData.title.length}/200 characters
            </span>
          </div>
          <div className="mt-1.5">
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              value={formData.title}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="e.g. Unable to authenticate to VPN server from remote office"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Category & Priority Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Category <span className="text-rose-500">*</span>
            </label>
            <div className="mt-1.5">
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors disabled:bg-slate-100"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {CATEGORIES.find((c) => c.value === formData.category)?.description}
            </p>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Priority <span className="text-rose-500">*</span>
            </label>
            <div className="mt-1.5">
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors disabled:bg-slate-100"
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri.value} value={pri.value}>
                    {pri.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {PRIORITIES.find((p) => p.value === formData.priority)?.description}
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Problem Description <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1.5">
            <textarea
              id="description"
              name="description"
              rows={6}
              required
              value={formData.description}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Please provide steps to reproduce, error codes, expected behavior, and any relevant troubleshooting steps taken..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Be as descriptive as possible to help our agents resolve your request quickly.
          </p>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to="/tickets"
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-lg shadow-sm shadow-brand-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Submitting Ticket...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Submit Ticket</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTicketPage;
