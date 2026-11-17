package com.helpdesk.runner;

import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentSeedRunnerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AgentSeedRunner agentSeedRunner;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(agentSeedRunner, "bootstrapSecret", "valid-bootstrap-secret");
        ReflectionTestUtils.setField(agentSeedRunner, "agentEmail", "agent@helpdesk.local");
        ReflectionTestUtils.setField(agentSeedRunner, "agentPassword", "AgentPassword123!");
    }

    @Test
    @DisplayName("Should create agent account when valid credentials and secret are provided")
    void shouldCreateAgentAccount() {
        when(userRepository.existsByEmail("agent@helpdesk.local")).thenReturn(false);
        when(userRepository.existsByUsername("agent")).thenReturn(false);
        when(passwordEncoder.encode("AgentPassword123!")).thenReturn("hashed-agent-pwd");

        agentSeedRunner.run();

        verify(userRepository, times(1)).save(argThat(user ->
                user.getRole() == Role.AGENT &&
                        user.getEmail().equals("agent@helpdesk.local") &&
                        user.getUsername().equals("agent")
        ));
    }

    @Test
    @DisplayName("Should skip creation when agent email already exists to prevent duplicate")
    void shouldSkipWhenEmailAlreadyExists() {
        when(userRepository.existsByEmail("agent@helpdesk.local")).thenReturn(true);

        agentSeedRunner.run();

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("Should abort when bootstrap secret is blank")
    void shouldAbortWhenSecretIsBlank() {
        ReflectionTestUtils.setField(agentSeedRunner, "bootstrapSecret", "");

        agentSeedRunner.run();

        verify(userRepository, never()).save(any(User.class));
    }
}
