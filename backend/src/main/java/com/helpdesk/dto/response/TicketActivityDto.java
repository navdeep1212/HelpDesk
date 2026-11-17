package com.helpdesk.dto.response;

import com.helpdesk.entity.TicketActivity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketActivityDto {

    private Long id;
    private Long ticketId;
    private UserSummaryDto actor;
    private String actionType;
    private String oldValue;
    private String newValue;
    private String description;
    private LocalDateTime createdAt;

    public static TicketActivityDto fromEntity(TicketActivity activity) {
        if (activity == null) {
            return null;
        }
        return TicketActivityDto.builder()
                .id(activity.getId())
                .ticketId(activity.getTicket() != null ? activity.getTicket().getId() : null)
                .actor(UserSummaryDto.fromEntity(activity.getActor()))
                .actionType(activity.getActionType())
                .oldValue(activity.getOldValue())
                .newValue(activity.getNewValue())
                .description(activity.getDescription())
                .createdAt(activity.getCreatedAt())
                .build();
    }
}
