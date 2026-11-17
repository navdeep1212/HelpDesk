import apiClient from './axios';

/**
 * Ticket API Service
 * Interacts with Spring Boot backend endpoints under /api/tickets
 */
export const ticketApi = {
  /**
   * Create a new ticket
   * @param {Object} data { title, description, category, priority }
   */
  async createTicket({ title, description, category, priority }) {
    const response = await apiClient.post('/tickets', {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
    });
    return response.data?.data;
  },

  /**
   * Fetch tickets with optional filters, search keyword, and pagination
   * @param {Object} params { status, priority, category, keyword, assignedToId, assignedToMe, page, size, sort }
   */
  async getTickets(params = {}) {
    const cleanParams = {};
    if (params.status) cleanParams.status = params.status;
    if (params.priority) cleanParams.priority = params.priority;
    if (params.category) cleanParams.category = params.category;
    if (params.keyword && params.keyword.trim()) cleanParams.keyword = params.keyword.trim();
    if (params.assignedToId) cleanParams.assignedToId = params.assignedToId;
    if (typeof params.assignedToMe === 'boolean') cleanParams.assignedToMe = params.assignedToMe;
    if (typeof params.page === 'number') cleanParams.page = params.page;
    if (typeof params.size === 'number') cleanParams.size = params.size;
    if (params.sort) cleanParams.sort = params.sort;

    const response = await apiClient.get('/tickets', { params: cleanParams });
    return response.data?.data;
  },

  /**
   * Fetch ticket details by ID
   * @param {number|string} id
   */
  async getTicketById(id) {
    const response = await apiClient.get(`/tickets/${id}`);
    return response.data?.data;
  },

  /**
   * Fetch activities for a ticket
   * @param {number|string} id
   */
  async getTicketActivities(id) {
    const response = await apiClient.get(`/tickets/${id}/activities`);
    return response.data?.data || [];
  },

  /**
   * Fetch comments for a ticket
   * @param {number|string} id
   */
  async getTicketComments(id) {
    const response = await apiClient.get(`/tickets/${id}/comments`);
    return response.data?.data || [];
  },

  /**
   * Add a public or internal comment to a ticket
   * @param {number|string} id
   * @param {Object} data { body, internal }
   */
  async addComment(id, { body, internal = false }) {
    const response = await apiClient.post(`/tickets/${id}/comments`, {
      body: body.trim(),
      internal: Boolean(internal),
    });
    return response.data?.data;
  },

  /**
   * Calculate customer statistics directly from existing /api/tickets endpoint
   * Performs lightweight parallel queries using size=1 to read totalElements count
   */
  async getCustomerStats() {
    const [totalRes, openRes, inProgressRes, resolvedRes, closedRes, recentRes] = await Promise.all([
      apiClient.get('/tickets', { params: { size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'OPEN', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'IN_PROGRESS', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'RESOLVED', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'CLOSED', size: 1 } }),
      apiClient.get('/tickets', { params: { size: 5, sort: 'createdAt,desc' } }),
    ]);

    return {
      total: totalRes.data?.data?.totalElements || 0,
      open: openRes.data?.data?.totalElements || 0,
      inProgress: inProgressRes.data?.data?.totalElements || 0,
      resolved: resolvedRes.data?.data?.totalElements || 0,
      closed: closedRes.data?.data?.totalElements || 0,
      recentTickets: recentRes.data?.data?.content || [],
    };
  },
};

export default ticketApi;
