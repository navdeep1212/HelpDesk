package com.helpdesk.service;

import com.helpdesk.dto.request.LoginRequest;
import com.helpdesk.dto.request.RegisterRequest;
import com.helpdesk.dto.response.AuthResponse;
import com.helpdesk.dto.response.UserDto;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.exception.DuplicateResourceException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.exception.UnauthorizedException;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtTokenProvider;
import com.helpdesk.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;

    public record LoginResult(AuthResponse authResponse, String rawRefreshToken) {}
    public record RefreshResult(AuthResponse authResponse, String rawRefreshToken) {}

    @Transactional
    public UserDto registerUser(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new DuplicateResourceException("Username '" + request.getUsername() + "' is already taken.");
        }
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new DuplicateResourceException("Email '" + request.getEmail() + "' is already in use.");
        }

        // Always enforce role = USER for public registration
        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .role(Role.USER)
                .active(true)
                .build();

        User saved = userRepository.save(user);
        log.info("Registered new user '{}' with role USER.", saved.getUsername());
        return UserDto.fromEntity(saved);
    }

    @Transactional
    public LoginResult login(LoginRequest request) {
        String identifier = request.getUsernameOrEmail().trim();

        // Authenticate via Spring Security authentication manager
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(identifier, request.getPassword())
            );
        } catch (BadCredentialsException ex) {
            throw new BadCredentialsException("Invalid username/email or password.");
        }

        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier.toLowerCase()))
                .orElseThrow(() -> new UnauthorizedException("User not found."));

        if (!user.isActive()) {
            throw new UnauthorizedException("Account is disabled. Please contact support.");
        }

        String accessToken = tokenProvider.generateAccessToken(user);
        String rawRefreshToken = refreshTokenService.createRefreshToken(user);

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getExpirationMs())
                .user(UserDto.fromEntity(user))
                .build();

        return new LoginResult(authResponse, rawRefreshToken);
    }

    @Transactional
    public RefreshResult refreshToken(String rawRefreshToken) {
        RefreshTokenService.RotationResult rotationResult = refreshTokenService.rotateRefreshToken(rawRefreshToken);
        User user = rotationResult.getUser();

        String newAccessToken = tokenProvider.generateAccessToken(user);

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(newAccessToken)
                .tokenType("Bearer")
                .expiresIn(tokenProvider.getExpirationMs())
                .user(UserDto.fromEntity(user))
                .build();

        return new RefreshResult(authResponse, rotationResult.getRawRefreshToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken != null && !rawRefreshToken.trim().isEmpty()) {
            refreshTokenService.revokeRefreshToken(rawRefreshToken);
        }
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUserProfile() {
        Long userId = SecurityUtils.getCurrentUserId()
                .orElseThrow(() -> new UnauthorizedException("User is not authenticated."));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        return UserDto.fromEntity(user);
    }
}
