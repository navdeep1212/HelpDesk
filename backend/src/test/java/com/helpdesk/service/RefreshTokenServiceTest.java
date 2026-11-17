package com.helpdesk.service;

import com.helpdesk.entity.RefreshToken;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.exception.TokenRefreshException;
import com.helpdesk.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationMs", 604800000L);

        sampleUser = User.builder()
                .id(1L)
                .username("john_doe")
                .email("john@example.com")
                .role(Role.USER)
                .build();
    }

    @Test
    @DisplayName("Should create raw refresh token and save hashed record")
    void shouldCreateRefreshToken() {
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        String rawToken = refreshTokenService.createRefreshToken(sampleUser);

        assertNotNull(rawToken);
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Should rotate valid refresh token into new raw token")
    void shouldRotateValidToken() {
        String rawToken = "sample-raw-token-123";
        String tokenHash = RefreshTokenService.hashToken(rawToken);

        RefreshToken existing = RefreshToken.builder()
                .id(10L)
                .user(sampleUser)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(existing));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        RefreshTokenService.RotationResult result = refreshTokenService.rotateRefreshToken(rawToken);

        assertNotNull(result);
        assertEquals(sampleUser, result.getUser());
        assertNotNull(result.getRawRefreshToken());
        assertTrue(existing.isRevoked());
        assertNotNull(existing.getReplacedByTokenHash());
    }

    @Test
    @DisplayName("Should detect genuine token reuse and revoke all user tokens")
    void shouldDetectTokenReuseAndRevokeAllUserTokens() {
        String rawToken = "stolen-raw-token";
        String tokenHash = RefreshTokenService.hashToken(rawToken);

        // An already-revoked token with replacement older than grace window
        RefreshToken existing = RefreshToken.builder()
                .id(10L)
                .user(sampleUser)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .revoked(true)
                .replacedByTokenHash("another-hash")
                .build();

        RefreshToken successor = RefreshToken.builder()
                .id(11L)
                .user(sampleUser)
                .tokenHash("another-hash")
                .createdAt(LocalDateTime.now().minusSeconds(60)) // Older than grace window (10s)
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(existing));
        when(refreshTokenRepository.findByTokenHash("another-hash")).thenReturn(Optional.of(successor));

        assertThrows(TokenRefreshException.class, () -> refreshTokenService.rotateRefreshToken(rawToken));
        verify(refreshTokenRepository, times(1)).revokeAllUserTokens(sampleUser);
    }
}
