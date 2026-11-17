package com.helpdesk.service;

import com.helpdesk.dto.request.LoginRequest;
import com.helpdesk.dto.request.RegisterRequest;
import com.helpdesk.dto.response.UserDto;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.exception.DuplicateResourceException;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtTokenProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("Public registration should always enforce Role.USER")
    void shouldAlwaysCreateUserWithRoleUser() {
        RegisterRequest request = RegisterRequest.builder()
                .username("newuser")
                .email("new@example.com")
                .password("Password123!")
                .fullName("New User")
                .build();

        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("hashed-pwd");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(100L);
            return u;
        });

        UserDto created = authService.registerUser(request);

        assertNotNull(created);
        assertEquals(Role.USER, created.getRole());
        assertEquals("newuser", created.getUsername());
        verify(userRepository, times(1)).save(argThat(user -> user.getRole() == Role.USER));
    }

    @Test
    @DisplayName("Registration should reject duplicate username")
    void shouldRejectDuplicateUsername() {
        RegisterRequest request = RegisterRequest.builder()
                .username("existinguser")
                .email("other@example.com")
                .password("Password123!")
                .fullName("Existing User")
                .build();

        when(userRepository.existsByUsername("existinguser")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> authService.registerUser(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Registration should reject duplicate email")
    void shouldRejectDuplicateEmail() {
        RegisterRequest request = RegisterRequest.builder()
                .username("otheruser")
                .email("existing@example.com")
                .password("Password123!")
                .fullName("Other User")
                .build();

        when(userRepository.existsByUsername("otheruser")).thenReturn(false);
        when(userRepository.existsByEmail("existing@example.com")).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> authService.registerUser(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Successful login should return AuthResponse with access token and raw refresh token")
    void shouldLoginSuccessfully() {
        LoginRequest request = LoginRequest.builder()
                .usernameOrEmail("john_doe")
                .password("Password123!")
                .build();

        User user = User.builder()
                .id(1L)
                .username("john_doe")
                .email("john@example.com")
                .passwordHash("hashed")
                .fullName("John Doe")
                .role(Role.USER)
                .active(true)
                .build();

        when(userRepository.findByUsername("john_doe")).thenReturn(Optional.of(user));
        when(tokenProvider.generateAccessToken(user)).thenReturn("sample-access-jwt");
        when(tokenProvider.getExpirationMs()).thenReturn(900000L);
        when(refreshTokenService.createRefreshToken(user)).thenReturn("sample-raw-refresh-token");

        AuthService.LoginResult result = authService.login(request);

        assertNotNull(result);
        assertEquals("sample-access-jwt", result.authResponse().getAccessToken());
        assertEquals("sample-raw-refresh-token", result.rawRefreshToken());
    }
}
