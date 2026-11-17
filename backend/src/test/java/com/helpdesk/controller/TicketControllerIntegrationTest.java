package com.helpdesk.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.helpdesk.dto.request.*;
import com.helpdesk.entity.Comment;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.entity.enums.TicketCategory;
import com.helpdesk.entity.enums.TicketPriority;
import com.helpdesk.entity.enums.TicketStatus;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.TicketActivityRepository;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TicketControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private TicketActivityRepository activityRepository;

    @Autowired
    private com.helpdesk.repository.RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private User user1;
    private User user2;
    private User agentUser;
    private String user1Token;
    private String user2Token;
    private String agentToken;

    @BeforeEach
    void setUp() {
        activityRepository.deleteAll();
        commentRepository.deleteAll();
        ticketRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        user1 = userRepository.save(User.builder()
                .username("john_user")
                .email("john@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("John User")
                .role(Role.USER)
                .active(true)
                .build());

        user2 = userRepository.save(User.builder()
                .username("jane_user")
                .email("jane@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("Jane User")
                .role(Role.USER)
                .active(true)
                .build());

        agentUser = userRepository.save(User.builder()
                .username("sarah_agent")
                .email("sarah@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("Sarah Agent")
                .role(Role.AGENT)
                .active(true)
                .build());

        user1Token = jwtTokenProvider.generateAccessToken(user1);
        user2Token = jwtTokenProvider.generateAccessToken(user2);
        agentToken = jwtTokenProvider.generateAccessToken(agentUser);
    }

    @Test
    @DisplayName("POST /api/tickets should create a new ticket in OPEN status")
    void shouldCreateTicket() throws Exception {
        CreateTicketRequest request = CreateTicketRequest.builder()
                .title("Cannot access billing portal")
                .description("Getting 500 internal server error on invoices page")
                .category(TicketCategory.BILLING)
                .priority(TicketPriority.HIGH)
                .build();

        mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + user1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Cannot access billing portal"))
                .andExpect(jsonPath("$.data.status").value("OPEN"))
                .andExpect(jsonPath("$.data.priority").value("HIGH"))
                .andExpect(jsonPath("$.data.category").value("BILLING"))
                .andExpect(jsonPath("$.data.createdBy.username").value("john_user"));
    }

    @Test
    @DisplayName("GET /api/tickets should return only own tickets for USER role")
    void shouldReturnOnlyOwnTicketsForUser() throws Exception {
        // Create ticket for user1
        ticketRepository.save(Ticket.builder()
                .title("User 1 Ticket")
                .description("Desc 1")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        // Create ticket for user2
        ticketRepository.save(Ticket.builder()
                .title("User 2 Ticket")
                .description("Desc 2")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user2)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].title").value("User 1 Ticket"));
    }

    @Test
    @DisplayName("GET /api/tickets should return all tickets for AGENT role")
    void shouldReturnAllTicketsForAgent() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("User 1 Ticket")
                .description("Desc 1")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        ticketRepository.save(Ticket.builder()
                .title("User 2 Ticket")
                .description("Desc 2")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.IN_PROGRESS)
                .createdBy(user2)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalElements").value(2));
    }

    @Test
    @DisplayName("GET /api/tickets should safely handle missing sort parameter")
    void shouldHandleMissingSortParam() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("Ticket A")
                .description("Desc A")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("GET /api/tickets should safely handle sort=[] parameter (Swagger UI empty array)")
    void shouldHandleEmptyArraySortParamFromSwagger() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("Ticket Swagger")
                .description("Desc Swagger")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .param("sort", "[]")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("Ticket Swagger"));
    }

    @Test
    @DisplayName("GET /api/tickets should safely handle empty string sort parameter")
    void shouldHandleEmptyStringSortParam() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("Ticket Empty Sort")
                .description("Desc Empty Sort")
                .category(TicketCategory.BILLING)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .param("sort", "")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("Ticket Empty Sort"));
    }

    @Test
    @DisplayName("GET /api/tickets should support valid sorting (e.g. title,asc)")
    void shouldSupportValidSorting() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("Alpha Ticket")
                .description("Desc A")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        ticketRepository.save(Ticket.builder()
                .title("Beta Ticket")
                .description("Desc B")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .param("sort", "title,asc")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("Alpha Ticket"))
                .andExpect(jsonPath("$.data.content[1].title").value("Beta Ticket"));
    }

    @Test
    @DisplayName("GET /api/tickets should fall back safely when unknown sort property is passed")
    void shouldHandleUnknownSortPropertySafely() throws Exception {
        ticketRepository.save(Ticket.builder()
                .title("Safe Fallback Ticket")
                .description("Desc")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(get("/api/tickets")
                        .param("sort", "nonExistentField,desc")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].title").value("Safe Fallback Ticket"));
    }

    @Test
    @DisplayName("GET /api/tickets/{id} should forbid access when a user attempts to view another user's ticket")
    void shouldForbidUserFromViewingOtherUserTicket() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("User 1 Secret Ticket")
                .description("Desc")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        // user2 attempts to view user1's ticket
        mockMvc.perform(get("/api/tickets/" + ticket.getId())
                        .header("Authorization", "Bearer " + user2Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("PATCH /api/tickets/{id}/status should be allowed for AGENT and forbidden for USER")
    void shouldHandleStatusUpdatePermissions() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("Support issue")
                .description("Need fix")
                .category(TicketCategory.BUG_REPORT)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        UpdateStatusRequest statusRequest = UpdateStatusRequest.builder()
                .status(TicketStatus.IN_PROGRESS)
                .build();

        // USER forbidden
        mockMvc.perform(patch("/api/tickets/" + ticket.getId() + "/status")
                        .header("Authorization", "Bearer " + user1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusRequest)))
                .andExpect(status().isForbidden());

        // AGENT allowed
        mockMvc.perform(patch("/api/tickets/" + ticket.getId() + "/status")
                        .header("Authorization", "Bearer " + agentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));
    }

    @Test
    @DisplayName("PATCH /api/tickets/{id}/assign should allow AGENT to assign ticket to themselves or others")
    void shouldAllowAgentToAssignTicket() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("Unassigned task")
                .description("Desc")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        AssignTicketRequest assignRequest = AssignTicketRequest.builder()
                .agentId(agentUser.getId())
                .build();

        mockMvc.perform(patch("/api/tickets/" + ticket.getId() + "/assign")
                        .header("Authorization", "Bearer " + agentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.assignedTo.username").value("sarah_agent"));
    }

    @Test
    @DisplayName("DELETE /api/tickets/{id} should soft-delete the ticket and exclude it from GET")
    void shouldSoftDeleteTicket() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("Delete Me")
                .description("Desc")
                .category(TicketCategory.GENERAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        mockMvc.perform(delete("/api/tickets/" + ticket.getId())
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Subsequent get should return 404
        mockMvc.perform(get("/api/tickets/" + ticket.getId())
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    @DisplayName("Comments: USER should be rejected when sending internal=true, and should never see internal comments")
    void shouldEnforceInternalCommentRules() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("Comment Test Ticket")
                .description("Desc")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        // 1. Regular user attempts to post internal comment -> 400 Bad Request
        CreateCommentRequest userInternalAttempt = CreateCommentRequest.builder()
                .body("User trying internal comment")
                .internal(true)
                .build();

        mockMvc.perform(post("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + user1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(userInternalAttempt)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));

        // 2. Regular user posts a public comment -> 201 Created
        CreateCommentRequest userPublicComment = CreateCommentRequest.builder()
                .body("Public comment by user")
                .internal(false)
                .build();

        mockMvc.perform(post("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + user1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(userPublicComment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.body").value("Public comment by user"));

        // 3. Agent posts an internal comment -> 201 Created
        CreateCommentRequest agentInternalComment = CreateCommentRequest.builder()
                .body("Confidential note: customer is on enterprise trial")
                .internal(true)
                .build();

        mockMvc.perform(post("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + agentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(agentInternalComment)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.internal").value(true));

        // 4. Regular user fetches comments: MUST NOT SEE internal comment!
        mockMvc.perform(get("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].body").value("Public comment by user"))
                .andExpect(jsonPath("$.data[0].internal").doesNotExist());

        // 5. Agent fetches comments: MUST SEE BOTH public and internal comments!
        mockMvc.perform(get("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[1].internal").value(true));
    }

    @Test
    @DisplayName("GET /api/agents should only be accessible by AGENT role")
    void shouldRestrictAgentListToAgents() throws Exception {
        mockMvc.perform(get("/api/agents")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/agents")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].username").value("sarah_agent"));
    }

    @Test
    @DisplayName("GET /api/tickets/{id}/activities should return activity timeline")
    void shouldReturnActivityTimeline() throws Exception {
        Ticket ticket = ticketRepository.save(Ticket.builder()
                .title("Activity Ticket")
                .description("Desc")
                .category(TicketCategory.TECHNICAL)
                .status(TicketStatus.OPEN)
                .createdBy(user1)
                .deleted(false)
                .build());

        // Add a comment to trigger activity
        CreateCommentRequest commentRequest = CreateCommentRequest.builder()
                .body("Hello support")
                .internal(false)
                .build();

        mockMvc.perform(post("/api/tickets/" + ticket.getId() + "/comments")
                        .header("Authorization", "Bearer " + user1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentRequest)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/tickets/" + ticket.getId() + "/activities")
                        .header("Authorization", "Bearer " + user1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[0].actionType").value("COMMENT_ADDED"));
    }
}
