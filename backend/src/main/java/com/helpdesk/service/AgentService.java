package com.helpdesk.service;

import com.helpdesk.dto.response.UserSummaryDto;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AgentService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<UserSummaryDto> getAllAgents() {
        return userRepository.findByRoleAndActiveTrue(Role.AGENT).stream()
                .map(UserSummaryDto::fromEntity)
                .toList();
    }
}
