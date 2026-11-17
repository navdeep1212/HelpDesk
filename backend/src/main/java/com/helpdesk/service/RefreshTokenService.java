package com.helpdesk.service;

import com.helpdesk.entity.RefreshToken;
import com.helpdesk.entity.User;
import com.helpdesk.exception.TokenRefreshException;
import com.helpdesk.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int CONCURRENT_GRACE_WINDOW_SECONDS = 10;

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    public static class RotationResult {
        private final User user;
        private final String rawRefreshToken;

        public RotationResult(User user, String rawRefreshToken) {
            this.user = user;
            this.rawRefreshToken = rawRefreshToken;
        }

        public User getUser() {
            return user;
        }

        public String getRawRefreshToken() {
            return rawRefreshToken;
        }
    }

    @Transactional
    public String createRefreshToken(User user) {
        String rawToken = generateRawRandomToken();
        String tokenHash = hashToken(rawToken);

        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(refreshExpirationMs / 1000);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(expiresAt)
                .revoked(false)
                .build();

        refreshTokenRepository.save(refreshToken);
        return rawToken;
    }

    @Transactional
    public RotationResult rotateRefreshToken(String rawToken) {
        if (rawToken == null || rawToken.trim().isEmpty()) {
            throw new TokenRefreshException("Refresh token must not be empty.");
        }

        String incomingHash = hashToken(rawToken.trim());
        RefreshToken token = refreshTokenRepository.findByTokenHash(incomingHash)
                .orElseThrow(() -> new TokenRefreshException("Invalid refresh token."));

        User user = token.getUser();

        if (token.isExpired()) {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
            throw new TokenRefreshException("Refresh token has expired. Please login again.");
        }

        // Handle token already marked revoked
        if (token.isRevoked()) {
            // Check if this is within a short concurrency grace window from a recent replacement
            if (token.getReplacedByTokenHash() != null) {
                Optional<RefreshToken> successorOpt = refreshTokenRepository.findByTokenHash(token.getReplacedByTokenHash());
                if (successorOpt.isPresent()) {
                    RefreshToken successor = successorOpt.get();
                    boolean withinGraceWindow = successor.getCreatedAt() != null &&
                            successor.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(CONCURRENT_GRACE_WINDOW_SECONDS));

                    if (withinGraceWindow && !successor.isRevoked() && !successor.isExpired()) {
                        log.info("Concurrent refresh detected within grace window for user '{}'. Returning existing valid session.", user.getUsername());
                        // Return user with null raw token to indicate token was already rotated in flight
                        return new RotationResult(user, null);
                    }
                }
            }

            // If not in grace window: genuine reuse attack! Revoke all tokens for this user!
            log.warn("SECURITY ALERT: Refresh token reuse detected for user '{}'! Revoking all tokens.", user.getUsername());
            refreshTokenRepository.revokeAllUserTokens(user);
            throw new TokenRefreshException("Refresh token reuse detected. All active sessions have been revoked.");
        }

        // Normal rotation
        String newRawToken = generateRawRandomToken();
        String newTokenHash = hashToken(newRawToken);

        token.setRevoked(true);
        token.setReplacedByTokenHash(newTokenHash);
        refreshTokenRepository.save(token);

        LocalDateTime newExpiresAt = LocalDateTime.now().plusSeconds(refreshExpirationMs / 1000);
        RefreshToken newRefreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(newTokenHash)
                .expiresAt(newExpiresAt)
                .revoked(false)
                .build();

        refreshTokenRepository.save(newRefreshToken);

        return new RotationResult(user, newRawToken);
    }

    @Transactional
    public void revokeRefreshToken(String rawToken) {
        if (rawToken == null || rawToken.trim().isEmpty()) {
            return;
        }
        String hash = hashToken(rawToken.trim());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    private String generateRawRandomToken() {
        byte[] bytes = new byte[64];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
