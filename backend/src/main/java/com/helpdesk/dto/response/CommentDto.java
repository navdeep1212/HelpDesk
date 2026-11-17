package com.helpdesk.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.helpdesk.entity.Comment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommentDto {

    private Long id;
    private Long ticketId;
    private UserSummaryDto author;
    private String body;
    private Boolean internal;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommentDto fromEntity(Comment comment, boolean isAgent) {
        if (comment == null) {
            return null;
        }
        return CommentDto.builder()
                .id(comment.getId())
                .ticketId(comment.getTicket() != null ? comment.getTicket().getId() : null)
                .author(UserSummaryDto.fromEntity(comment.getAuthor()))
                .body(comment.getBody())
                .internal(isAgent ? comment.isInternal() : null)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}
