package com.helpdesk.dto.response;

import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.enums.TicketCategory;
import com.helpdesk.entity.enums.TicketPriority;
import com.helpdesk.entity.enums.TicketStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketDto {

    private Long id;
    private String title;
    private String description;
    private TicketStatus status;
    private TicketPriority priority;
    private TicketCategory category;
    private UserSummaryDto createdBy;
    private UserSummaryDto assignedTo;
    private boolean deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;

    public static TicketDto fromEntity(Ticket ticket) {
        if (ticket == null) {
            return null;
        }
        return TicketDto.builder()
                .id(ticket.getId())
                .title(ticket.getTitle())
                .description(ticket.getDescription())
                .status(ticket.getStatus())
                .priority(ticket.getPriority())
                .category(ticket.getCategory())
                .createdBy(UserSummaryDto.fromEntity(ticket.getCreatedBy()))
                .assignedTo(UserSummaryDto.fromEntity(ticket.getAssignedTo()))
                .deleted(ticket.isDeleted())
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt())
                .resolvedAt(ticket.getResolvedAt())
                .closedAt(ticket.getClosedAt())
                .build();
    }
}
