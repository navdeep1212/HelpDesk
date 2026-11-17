package com.helpdesk.service;

import com.helpdesk.dto.request.CreateCommentRequest;
import com.helpdesk.dto.response.CommentDto;
import com.helpdesk.entity.Comment;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.exception.BadRequestException;
import com.helpdesk.repository.CommentRepository;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private TicketService ticketService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityService activityService;

    @InjectMocks
    private CommentService commentService;

    private User regularUser;
    private User agentUser;
    private Ticket ticket;
    private UserPrincipal regularUserPrincipal;
    private UserPrincipal agentPrincipal;

    @BeforeEach
    void setUp() {
        regularUser = User.builder()
                .id(1L)
                .username("regular_user")
                .role(Role.USER)
                .active(true)
                .build();

        agentUser = User.builder()
                .id(2L)
                .username("support_agent")
                .role(Role.AGENT)
                .active(true)
                .build();

        ticket = Ticket.builder()
                .id(100L)
                .title("Ticket 100")
                .createdBy(regularUser)
                .deleted(false)
                .build();

        regularUserPrincipal = new UserPrincipal(regularUser);
        agentPrincipal = new UserPrincipal(agentUser);
    }

    @Test
    @DisplayName("Regular user should be rejected when trying to create internal comment")
    void shouldRejectUserCreatingInternalComment() {
        CreateCommentRequest request = CreateCommentRequest.builder()
                .body("Internal note attempt")
                .internal(true)
                .build();

        when(ticketService.findActiveTicketById(100L)).thenReturn(ticket);
        when(userRepository.findById(1L)).thenReturn(Optional.of(regularUser));

        assertThrows(BadRequestException.class, () -> commentService.addComment(100L, request, regularUserPrincipal));
        verify(commentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Agent should be allowed to create internal comment")
    void shouldAllowAgentToCreateInternalComment() {
        CreateCommentRequest request = CreateCommentRequest.builder()
                .body("Agent only note about this customer")
                .internal(true)
                .build();

        when(ticketService.findActiveTicketById(100L)).thenReturn(ticket);
        when(userRepository.findById(2L)).thenReturn(Optional.of(agentUser));
        when(commentRepository.save(any(Comment.class))).thenAnswer(i -> {
            Comment c = i.getArgument(0);
            c.setId(50L);
            return c;
        });

        CommentDto dto = commentService.addComment(100L, request, agentPrincipal);

        assertNotNull(dto);
        assertTrue(dto.getInternal());
        verify(commentRepository, times(1)).save(argThat(Comment::isInternal));
    }

    @Test
    @DisplayName("Regular user fetching comments should not see internal comments")
    void shouldFilterInternalCommentsForRegularUser() {
        Comment publicComment = Comment.builder()
                .id(1L)
                .ticket(ticket)
                .author(regularUser)
                .body("Public comment")
                .internal(false)
                .build();

        when(ticketService.findActiveTicketById(100L)).thenReturn(ticket);
        when(commentRepository.findByTicketIdAndDeletedFalseAndInternalFalseOrderByCreatedAtAsc(100L))
                .thenReturn(List.of(publicComment));

        List<CommentDto> comments = commentService.getCommentsForTicket(100L, regularUserPrincipal);

        assertEquals(1, comments.size());
        assertEquals("Public comment", comments.get(0).getBody());
        assertNull(comments.get(0).getInternal()); // internal field is null for regular users
        verify(commentRepository, never()).findByTicketIdAndDeletedFalseOrderByCreatedAtAsc(any());
    }

    @Test
    @DisplayName("Agent fetching comments should see all comments including internal notes")
    void shouldIncludeInternalCommentsForAgent() {
        Comment publicComment = Comment.builder()
                .id(1L)
                .ticket(ticket)
                .author(regularUser)
                .body("Public comment")
                .internal(false)
                .build();

        Comment internalComment = Comment.builder()
                .id(2L)
                .ticket(ticket)
                .author(agentUser)
                .body("Internal note")
                .internal(true)
                .build();

        when(ticketService.findActiveTicketById(100L)).thenReturn(ticket);
        when(commentRepository.findByTicketIdAndDeletedFalseOrderByCreatedAtAsc(100L))
                .thenReturn(List.of(publicComment, internalComment));

        List<CommentDto> comments = commentService.getCommentsForTicket(100L, agentPrincipal);

        assertEquals(2, comments.size());
        assertFalse(comments.get(0).getInternal());
        assertTrue(comments.get(1).getInternal());
    }
}
