package com.helpdesk.controller;

import com.helpdesk.dto.response.ApiResponse;
import com.helpdesk.dto.response.UserSummaryDto;
import com.helpdesk.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @GetMapping
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<List<UserSummaryDto>>> getAllAgents() {
        List<UserSummaryDto> agents = agentService.getAllAgents();
        return ResponseEntity.ok(ApiResponse.success("Agents retrieved successfully.", agents));
    }
}
