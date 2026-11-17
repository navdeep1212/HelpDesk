package com.helpdesk.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCommentRequest {

    @NotBlank(message = "Comment body cannot be blank")
    private String body;

    // Only agents are allowed to set internal = true
    @Builder.Default
    private boolean internal = false;
}
