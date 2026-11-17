package com.helpdesk.controller;

import com.helpdesk.dto.request.*;
import com.helpdesk.dto.response.*;
import com.helpdesk.entity.enums.TicketCategory;
import com.helpdesk.entity.enums.TicketPriority;
import com.helpdesk.entity.enums.TicketStatus;
import com.helpdesk.security.UserPrincipal;
import com.helpdesk.service.CommentService;
import com.helpdesk.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;
    private final CommentService commentService;

    @PostMapping
    public ResponseEntity<ApiResponse<TicketDto>> createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.createTicket(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Ticket created successfully.", ticket));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<TicketDto>>> getAllTickets(
            @RequestParam(required = false) TicketStatus status,
            @RequestParam(required = false) TicketPriority priority,
            @RequestParam(required = false) TicketCategory category,
            @RequestParam(required = false) Long assignedToId,
            @RequestParam(required = false) Boolean assignedToMe,
            @RequestParam(required = false) String keyword,
            @ParameterObject @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        PagedResponse<TicketDto> tickets = ticketService.getAllTickets(
                status, priority, category, assignedToId, assignedToMe, keyword, pageable, currentUser
        );
        return ResponseEntity.ok(ApiResponse.success("Tickets retrieved successfully.", tickets));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketDto>> getTicketById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.getTicketById(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket retrieved successfully.", ticket));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketDto>> updateTicket(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTicketRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.updateTicket(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket updated successfully.", ticket));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTicket(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        ticketService.softDeleteTicket(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket deleted successfully."));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<TicketDto>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.updateStatus(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket status updated successfully.", ticket));
    }

    @PatchMapping("/{id}/priority")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<TicketDto>> updatePriority(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePriorityRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.updatePriority(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket priority updated successfully.", ticket));
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<TicketDto>> assignTicket(
            @PathVariable Long id,
            @RequestBody AssignTicketRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        TicketDto ticket = ticketService.assignTicket(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket assignment updated successfully.", ticket));
    }

    @GetMapping("/{id}/activities")
    public ResponseEntity<ApiResponse<List<TicketActivityDto>>> getTicketActivities(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        List<TicketActivityDto> activities = ticketService.getTicketActivities(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Ticket activities retrieved successfully.", activities));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<CommentDto>> addComment(
            @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        CommentDto comment = commentService.addComment(id, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Comment added successfully.", comment));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<List<CommentDto>>> getComments(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        List<CommentDto> comments = commentService.getCommentsForTicket(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Comments retrieved successfully.", comments));
    }
}
