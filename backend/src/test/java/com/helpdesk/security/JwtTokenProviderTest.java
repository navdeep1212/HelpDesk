package com.helpdesk.security;

import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private JwtTokenProvider tokenProvider;
    // 64+ bytes Base64 string for HS512
    private static final String VALID_SECRET = "q3t6w9z$C&F)J@NcQfTjWnZr4u7x!A%D*G-KaPdSgUkXp2s5v8y/B?E(H+MbQeTh";

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", VALID_SECRET);
        ReflectionTestUtils.setField(tokenProvider, "jwtExpirationMs", 3600000L);
        tokenProvider.init();
    }

    @Test
    @DisplayName("Should generate valid JWT access token and extract subject")
    void shouldGenerateAndValidateToken() {
        User user = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .role(Role.USER)
                .build();

        String token = tokenProvider.generateAccessToken(user);

        assertNotNull(token);
        assertTrue(tokenProvider.validateToken(token));
        assertEquals("testuser", tokenProvider.getUsernameFromToken(token));
    }

    @Test
    @DisplayName("Should reject invalid or tampered JWT token")
    void shouldRejectInvalidToken() {
        String invalidToken = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.invalid.payload";
        assertFalse(tokenProvider.validateToken(invalidToken));
    }

    @Test
    @DisplayName("Should reject token when secret is too short (< 64 bytes)")
    void shouldThrowWhenSecretTooShort() {
        JwtTokenProvider shortSecretProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(shortSecretProvider, "jwtSecret", "too-short-secret");
        ReflectionTestUtils.setField(shortSecretProvider, "jwtExpirationMs", 3600000L);

        assertThrows(IllegalStateException.class, shortSecretProvider::init);
    }
}
