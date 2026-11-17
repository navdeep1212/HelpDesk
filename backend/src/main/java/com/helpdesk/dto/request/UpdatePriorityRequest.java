package com.helpdesk.dto.request;

import com.helpdesk.entity.enums.TicketPriority;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePriorityRequest {

    @NotNull(message = "Priority is required")
    private TicketPriority priority;
}
