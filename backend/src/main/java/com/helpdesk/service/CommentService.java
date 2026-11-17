package com.helpdesk.service;

import com.helpdesk.dto.request.CreateCommentRequest;
import com.helpdesk.dto.request.UpdateCommentRequest;
import com.helpdesk.dto.response.CommentDto;
import com.helpdesk.entity.Comment;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.exception.BadRequestException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.repository.CommentRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final TicketService ticketService;
    private final UserRepository userRepository;
    private final ActivityService activityService;

    @Transactional
    public CommentDto addComment(Long ticketId, CreateCommentRequest request, UserPrincipal currentUser) {
        Ticket ticket = ticketService.findActiveTicketById(ticketId);
        ticketService.verifyTicketViewPermission(ticket, currentUser);

        User author = loadUser(currentUser.getId());
        boolean isAgent = currentUser.getRole() == Role.AGENT;

        // Security check: regular users cannot create internal comments
        if (request.isInternal() && !isAgent) {
            throw new BadRequestException("Regular users cannot create internal comments.");
        }

        boolean internalFlag = isAgent && request.isInternal();

        Comment comment = Comment.builder()
                .ticket(ticket)
                .author(author)
                .body(request.getBody().trim())
                .internal(internalFlag)
                .deleted(false)
                .build();

        Comment saved = commentRepository.save(comment);

        // Record activity
        String desc = internalFlag ? "Internal comment added by " + author.getUsername() : "Comment added by " + author.getUsername();
        activityService.recordActivity(
                ticket,
                author,
                "COMMENT_ADDED",
                null,
                internalFlag ? "INTERNAL" : "PUBLIC",
                desc
        );

        return CommentDto.fromEntity(saved, isAgent);
    }

    @Transactional(readOnly = true)
    public List<CommentDto> getCommentsForTicket(Long ticketId, UserPrincipal currentUser) {
        Ticket ticket = ticketService.findActiveTicketById(ticketId);
        ticketService.verifyTicketViewPermission(ticket, currentUser);

        boolean isAgent = currentUser.getRole() == Role.AGENT;

        if (isAgent) {
            // Agents see all non-deleted comments including internal notes
            return commentRepository.findByTicketIdAndDeletedFalseOrderByCreatedAtAsc(ticketId).stream()
                    .map(c -> CommentDto.fromEntity(c, true))
                    .toList();
        } else {
            // Regular users see ONLY public non-deleted comments (filtered at repository level)
            return commentRepository.findByTicketIdAndDeletedFalseAndInternalFalseOrderByCreatedAtAsc(ticketId).stream()
                    .map(c -> CommentDto.fromEntity(c, false))
                    .toList();
        }
    }

    @Transactional
    public CommentDto updateComment(Long commentId, UpdateCommentRequest request, UserPrincipal currentUser) {
        Comment comment = findActiveCommentById(commentId);

        // Only comment author can edit their own comment
        if (!comment.getAuthor().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You can only edit your own comments.");
        }

        comment.setBody(request.getBody().trim());
        Comment saved = commentRepository.save(comment);

        boolean isAgent = currentUser.getRole() == Role.AGENT;
        return CommentDto.fromEntity(saved, isAgent);
    }

    @Transactional
    public void deleteComment(Long commentId, UserPrincipal currentUser) {
        Comment comment = findActiveCommentById(commentId);

        // Either the author or an AGENT can soft-delete a comment
        boolean isAuthor = comment.getAuthor().getId().equals(currentUser.getId());
        boolean isAgent = currentUser.getRole() == Role.AGENT;

        if (!isAuthor && !isAgent) {
            throw new AccessDeniedException("You do not have permission to delete this comment.");
        }

        comment.setDeleted(true);
        comment.setDeletedAt(LocalDateTime.now());
        commentRepository.save(comment);
        log.info("Comment #{} soft-deleted by user '{}'", commentId, currentUser.getUsername());
    }

    private Comment findActiveCommentById(Long commentId) {
        return commentRepository.findByIdAndDeletedFalse(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with id: " + commentId));
    }

    private User loadUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }
}
