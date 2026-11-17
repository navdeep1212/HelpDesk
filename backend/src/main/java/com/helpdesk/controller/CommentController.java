package com.helpdesk.controller;

import com.helpdesk.dto.request.UpdateCommentRequest;
import com.helpdesk.dto.response.ApiResponse;
import com.helpdesk.dto.response.CommentDto;
import com.helpdesk.security.UserPrincipal;
import com.helpdesk.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CommentDto>> updateComment(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCommentRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        CommentDto updated = commentService.updateComment(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Comment updated successfully.", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        commentService.deleteComment(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("Comment deleted successfully."));
    }
}
