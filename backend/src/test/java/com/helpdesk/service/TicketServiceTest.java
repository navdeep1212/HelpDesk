package com.helpdesk.service;

import com.helpdesk.dto.request.*;
import com.helpdesk.dto.response.TicketDto;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.entity.enums.TicketCategory;
import com.helpdesk.entity.enums.TicketPriority;
import com.helpdesk.entity.enums.TicketStatus;
import com.helpdesk.exception.BadRequestException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityService activityService;

    @InjectMocks
    private TicketService ticketService;

    private User user1;
    private User user2;
    private User agentUser;
    private UserPrincipal user1Principal;
    private UserPrincipal user2Principal;
    private UserPrincipal agentPrincipal;

    @BeforeEach
    void setUp() {
        user1 = User.builder()
                .id(1L)
                .username("user1")
                .email("user1@example.com")
                .role(Role.USER)
                .active(true)
                .build();

        user2 = User.builder()
                .id(2L)
                .username("user2")
                .email("user2@example.com")
                .role(Role.USER)
                .active(true)
                .build();

        agentUser = User.builder()
                .id(3L)
                .username("agent1")
                .email("agent1@example.com")
                .role(Role.AGENT)
                .active(true)
                .build();

        user1Principal = new UserPrincipal(user1);
        user2Principal = new UserPrincipal(user2);
        agentPrincipal = new UserPrincipal(agentUser);
    }

    @Test
    @DisplayName("Should create ticket with status OPEN and record activity")
    void shouldCreateTicketSuccessfully() {
        CreateTicketRequest request = CreateTicketRequest.builder()
                .title("Cannot connect to VPN")
                .description("VPN client times out")
                .category(TicketCategory.TECHNICAL)
                .priority(TicketPriority.HIGH)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> {
            Ticket t = i.getArgument(0);
            t.setId(10L);
            return t;
        });

        TicketDto created = ticketService.createTicket(request, user1Principal);

        assertNotNull(created);
        assertEquals(TicketStatus.OPEN, created.getStatus());
        assertEquals(TicketPriority.HIGH, created.getPriority());
        assertEquals("Cannot connect to VPN", created.getTitle());
        verify(activityService, times(1)).recordActivity(any(), eq(user1), eq("TICKET_CREATED"), isNull(), any(), any());
    }

    @Test
    @DisplayName("Owner should be able to view their own ticket")
    void shouldAllowOwnerToViewTicket() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("Test Ticket")
                .description("Desc")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));

        TicketDto result = ticketService.getTicketById(10L, user1Principal);

        assertNotNull(result);
        assertEquals(10L, result.getId());
    }

    @Test
    @DisplayName("User should be denied when attempting to view another user's ticket")
    void shouldDenyUserViewingOtherTicket() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("User1's Ticket")
                .description("Desc")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));

        assertThrows(AccessDeniedException.class, () -> ticketService.getTicketById(10L, user2Principal));
    }

    @Test
    @DisplayName("Agent should be allowed to view any ticket")
    void shouldAllowAgentToViewAnyTicket() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("User1's Ticket")
                .description("Desc")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));

        TicketDto result = ticketService.getTicketById(10L, agentPrincipal);

        assertNotNull(result);
        assertEquals(10L, result.getId());
    }

    @Test
    @DisplayName("Owner should only be able to update ticket when OPEN")
    void shouldRejectUpdateWhenTicketNotOpen() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("Test")
                .description("Desc")
                .category(TicketCategory.BILLING)
                .status(TicketStatus.IN_PROGRESS)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));

        UpdateTicketRequest request = UpdateTicketRequest.builder()
                .title("Updated Title")
                .description("Updated Desc")
                .category(TicketCategory.BILLING)
                .build();

        assertThrows(BadRequestException.class, () -> ticketService.updateTicket(10L, request, user1Principal));
    }

    @Test
    @DisplayName("Agent should be able to update status and record activity")
    void shouldAllowAgentToUpdateStatus() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("Test")
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));
        when(userRepository.findById(3L)).thenReturn(Optional.of(agentUser));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        UpdateStatusRequest request = UpdateStatusRequest.builder()
                .status(TicketStatus.RESOLVED)
                .build();

        TicketDto updated = ticketService.updateStatus(10L, request, agentPrincipal);

        assertEquals(TicketStatus.RESOLVED, updated.getStatus());
        assertNotNull(ticket.getResolvedAt());
        verify(activityService, times(1)).recordActivity(any(), eq(agentUser), eq("STATUS_CHANGED"), eq("OPEN"), eq("RESOLVED"), any());
    }

    @Test
    @DisplayName("Regular user should be forbidden from updating ticket status")
    void shouldRejectUserUpdatingStatus() {
        UpdateStatusRequest request = UpdateStatusRequest.builder()
                .status(TicketStatus.CLOSED)
                .build();

        assertThrows(AccessDeniedException.class, () -> ticketService.updateStatus(10L, request, user1Principal));
    }

    @Test
    @DisplayName("Agent should be able to assign ticket to an active agent")
    void shouldAssignTicketToAgent() {
        Ticket ticket = Ticket.builder()
                .id(10L)
                .title("Test")
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build();

        when(ticketRepository.findByIdAndDeletedFalse(10L)).thenReturn(Optional.of(ticket));
        when(userRepository.findById(3L)).thenReturn(Optional.of(agentUser));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        AssignTicketRequest request = AssignTicketRequest.builder()
                .agentId(3L)
                .build();

        TicketDto result = ticketService.assignTicket(10L, request, agentPrincipal);

        assertNotNull(result.getAssignedTo());
        assertEquals("agent1", result.getAssignedTo().getUsername());
        verify(activityService, times(1)).recordActivity(any(), eq(agentUser), eq("ASSIGNED"), any(), eq("agent1"), any());
    }
}
