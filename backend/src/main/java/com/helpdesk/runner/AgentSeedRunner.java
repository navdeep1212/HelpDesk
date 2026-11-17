package com.helpdesk.runner;

import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Component
@Profile("seed")
@RequiredArgsConstructor
public class AgentSeedRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.agent-bootstrap-secret:}")
    private String bootstrapSecret;

    @Value("${app.agent-email:}")
    private String agentEmail;

    @Value("${app.agent-password:}")
    private String agentPassword;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting AgentSeedRunner in 'seed' profile...");

        if (!StringUtils.hasText(bootstrapSecret)) {
            log.error("Agent bootstrap failed: 'app.agent-bootstrap-secret' is missing or blank.");
            return;
        }

        if (!StringUtils.hasText(agentEmail)) {
            log.error("Agent bootstrap failed: 'app.agent-email' is missing or blank.");
            return;
        }

        if (!StringUtils.hasText(agentPassword) || agentPassword.length() < 8) {
            log.error("Agent bootstrap failed: 'app.agent-password' must be at least 8 characters long.");
            return;
        }

        String normalizedEmail = agentEmail.trim().toLowerCase();
        String derivedUsername = normalizedEmail.contains("@")
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : "agent";

        // Prevent duplicate accounts
        if (userRepository.existsByEmail(normalizedEmail)) {
            log.warn("Agent account with email '{}' already exists. Skipping creation.", normalizedEmail);
            return;
        }

        if (userRepository.existsByUsername(derivedUsername)) {
            derivedUsername = derivedUsername + "_" + System.currentTimeMillis() % 10000;
        }

        User agentUser = User.builder()
                .username(derivedUsername)
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(agentPassword))
                .fullName("System Agent")
                .role(Role.AGENT)
                .active(true)
                .build();

        userRepository.save(agentUser);
        log.info("Agent account bootstrapped successfully: username='{}', email='{}', role=AGENT", derivedUsername, normalizedEmail);
    }
}
