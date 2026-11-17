import apiClient from './axios';

/**
 * Agent API Service
 * Interacts with Spring Boot backend agent endpoints and agent ticket mutations
 */
export const agentApi = {
  /**
   * Fetch all active AGENT users (for ticket assignment dropdowns)
   */
  async getAllAgents() {
    const response = await apiClient.get('/agents');
    return response.data?.data || [];
  },

  /**
   * Assign a ticket to an agent, or unassign by passing null
   * @param {number|string} ticketId
   * @param {number|null} agentId
   */
  async assignTicket(ticketId, agentId = null) {
    const response = await apiClient.patch(`/tickets/${ticketId}/assign`, {
      agentId: agentId ? Number(agentId) : null,
    });
    return response.data?.data;
  },

  /**
   * Update ticket status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
   * @param {number|string} ticketId
   * @param {string} status
   */
  async updateStatus(ticketId, status) {
    const response = await apiClient.patch(`/tickets/${ticketId}/status`, {
      status,
    });
    return response.data?.data;
  },

  /**
   * Update ticket priority (LOW, MEDIUM, HIGH, CRITICAL)
   * @param {number|string} ticketId
   * @param {string} priority
   */
  async updatePriority(ticketId, priority) {
    const response = await apiClient.patch(`/tickets/${ticketId}/priority`, {
      priority,
    });
    return response.data?.data;
  },

  /**
   * Calculate agent dashboard statistics using existing /api/tickets endpoints
   */
  async getAgentStats() {
    const [
      totalRes,
      openRes,
      inProgressRes,
      resolvedRes,
      closedRes,
      assignedToMeRes,
      recentRes,
    ] = await Promise.all([
      apiClient.get('/tickets', { params: { size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'OPEN', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'IN_PROGRESS', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'RESOLVED', size: 1 } }),
      apiClient.get('/tickets', { params: { status: 'CLOSED', size: 1 } }),
      apiClient.get('/tickets', { params: { assignedToMe: true, size: 1 } }),
      apiClient.get('/tickets', { params: { size: 10, sort: 'createdAt,desc' } }),
    ]);

    const recentTickets = recentRes.data?.data?.content || [];
    // Calculate unassigned count from the fetched recent sample or indicate unassigned
    const unassignedInRecent = recentTickets.filter((t) => !t.assignedTo).length;

    return {
      total: totalRes.data?.data?.totalElements || 0,
      open: openRes.data?.data?.totalElements || 0,
      inProgress: inProgressRes.data?.data?.totalElements || 0,
      resolved: resolvedRes.data?.data?.totalElements || 0,
      closed: closedRes.data?.data?.totalElements || 0,
      assignedToMe: assignedToMeRes.data?.data?.totalElements || 0,
      unassignedRecentCount: unassignedInRecent,
      recentTickets,
    };
  },
};

export default agentApi;
