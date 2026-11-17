package com.helpdesk.controller;

import com.helpdesk.dto.request.LoginRequest;
import com.helpdesk.dto.request.RegisterRequest;
import com.helpdesk.dto.response.ApiResponse;
import com.helpdesk.dto.response.AuthResponse;
import com.helpdesk.dto.response.UserDto;
import com.helpdesk.exception.UnauthorizedException;
import com.helpdesk.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${app.jwt.refresh-cookie-name:refresh_token}")
    private String refreshCookieName;

    @Value("${app.jwt.refresh-cookie-path:/api/auth}")
    private String refreshCookiePath;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserDto>> register(@Valid @RequestBody RegisterRequest request) {
        UserDto registeredUser = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User registered successfully.", registeredUser));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthService.LoginResult result = authService.login(request);

        ResponseCookie cookie = createRefreshCookie(
                result.rawRefreshToken(),
                Duration.ofMillis(refreshExpirationMs),
                httpRequest.isSecure()
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Login successful.", result.authResponse()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @CookieValue(name = "${app.jwt.refresh-cookie-name:refresh_token}", required = false) String rawRefreshToken,
            HttpServletRequest httpRequest
    ) {
        if (rawRefreshToken == null || rawRefreshToken.trim().isEmpty()) {
            throw new UnauthorizedException("No refresh token provided in request cookie.");
        }

        AuthService.RefreshResult result = authService.refreshToken(rawRefreshToken);

        ResponseEntity.BodyBuilder responseBuilder = ResponseEntity.ok();

        // If a new raw refresh token was generated during rotation, update the cookie
        if (result.rawRefreshToken() != null) {
            ResponseCookie newCookie = createRefreshCookie(
                    result.rawRefreshToken(),
                    Duration.ofMillis(refreshExpirationMs),
                    httpRequest.isSecure()
            );
            responseBuilder.header(HttpHeaders.SET_COOKIE, newCookie.toString());
        }

        return responseBuilder.body(ApiResponse.success("Token refreshed successfully.", result.authResponse()));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = "${app.jwt.refresh-cookie-name:refresh_token}", required = false) String rawRefreshToken,
            HttpServletRequest httpRequest
    ) {
        if (rawRefreshToken != null && !rawRefreshToken.trim().isEmpty()) {
            authService.logout(rawRefreshToken);
        }

        // Clear the cookie with matching attributes and maxAge = 0
        ResponseCookie clearCookie = createRefreshCookie("", Duration.ZERO, httpRequest.isSecure());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString())
                .body(ApiResponse.success("Logged out successfully."));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> getCurrentUser() {
        UserDto currentUser = authService.getCurrentUserProfile();
        return ResponseEntity.ok(ApiResponse.success("Current user profile retrieved.", currentUser));
    }

    private ResponseCookie createRefreshCookie(String tokenValue, Duration maxAge, boolean isSecure) {
        return ResponseCookie.from(refreshCookieName, tokenValue)
                .httpOnly(true)
                .secure(isSecure)
                .path(refreshCookiePath)
                .maxAge(maxAge)
                .sameSite("Lax")
                .build();
    }
}
