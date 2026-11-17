package com.helpdesk.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.helpdesk.dto.request.LoginRequest;
import com.helpdesk.dto.request.RegisterRequest;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.repository.RefreshTokenRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtTokenProvider;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void cleanUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Cookie createAndLoginUser(String username, String email) throws Exception {
        User user = User.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("Test User")
                .role(Role.USER)
                .active(true)
                .build();
        userRepository.save(user);

        LoginRequest loginRequest = LoginRequest.builder()
                .usernameOrEmail(username)
                .password("Password123!")
                .build();

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie refreshCookie = loginResult.getResponse().getCookie("refresh_token");
        assertNotNull(refreshCookie);
        return refreshCookie;
    }

    @Test
    @DisplayName("POST /api/auth/register should create user with role USER and return 201")
    void shouldRegisterNewUser() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .username("alice_smith")
                .email("alice@example.com")
                .password("SecurePass123!")
                .fullName("Alice Smith")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("alice_smith"))
                .andExpect(jsonPath("$.data.email").value("alice@example.com"))
                .andExpect(jsonPath("$.data.role").value("USER"));
    }

    @Test
    @DisplayName("POST /api/auth/register should reject invalid inputs with 400")
    void shouldRejectInvalidRegistration() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .username("al") // too short (< 3)
                .email("not-an-email")
                .password("short") // too short (< 8)
                .fullName("")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("POST /api/auth/login should return access token and set HttpOnly refresh cookie with Path=/api/auth")
    void shouldLoginAndSetRefreshCookie() throws Exception {
        User user = User.builder()
                .username("bob_jones")
                .email("bob@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("Bob Jones")
                .role(Role.USER)
                .active(true)
                .build();
        userRepository.save(user);

        LoginRequest request = LoginRequest.builder()
                .usernameOrEmail("bob_jones")
                .password("Password123!")
                .build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.username").value("bob_jones"))
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", containsString("refresh_token=")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")));
    }

    @Test
    @DisplayName("POST /api/auth/refresh should allow frontend origin (http://localhost:5173)")
    void shouldAllowFrontendOriginOnRefresh() throws Exception {
        Cookie refreshCookie = createAndLoginUser("frontend_user", "frontend@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(header().exists("Set-Cookie"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh should allow same-origin requests from backend/Swagger UI (http://localhost:8080)")
    void shouldAllowSameOriginSwaggerUiOnRefresh() throws Exception {
        Cookie refreshCookie = createAndLoginUser("swagger_user", "swagger@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Origin", "http://localhost:8080"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(header().exists("Set-Cookie"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh should allow same-origin requests using Referer from Swagger UI")
    void shouldAllowSameOriginSwaggerRefererOnRefresh() throws Exception {
        Cookie refreshCookie = createAndLoginUser("swagger_ref_user", "swagger_ref@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Referer", "http://localhost:8080/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("POST /api/auth/refresh should allow missing Origin for non-browser clients (curl, Postman)")
    void shouldAllowMissingOriginForNonBrowserClients() throws Exception {
        Cookie refreshCookie = createAndLoginUser("curl_user", "curl@example.com");

        // No Origin, no Referer, no Sec-Fetch-Site (typical curl / Postman request)
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("POST /api/auth/refresh should reject untrusted cross-origin requests with 403")
    void shouldRejectUntrustedOriginOnRefresh() throws Exception {
        Cookie refreshCookie = createAndLoginUser("victim_user", "victim@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Origin", "http://malicious-website.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/auth/refresh should reject Sec-Fetch-Site: cross-site requests with 403")
    void shouldRejectSecFetchSiteCrossSite() throws Exception {
        Cookie refreshCookie = createAndLoginUser("cross_site_user", "cross_site@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Sec-Fetch-Site", "cross-site"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("CSRF_VIOLATION"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh should reject null origin")
    void shouldRejectNullOrigin() throws Exception {
        Cookie refreshCookie = createAndLoginUser("null_origin_user", "null_origin@example.com");

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie)
                        .header("Origin", "null"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/auth/logout should clear refresh cookie with Max-Age=0 and Path=/api/auth")
    void shouldLogoutAndClearCookie() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .header("Origin", "http://localhost:8080"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth")));
    }

    @Test
    @DisplayName("GET /api/auth/me should return current user profile when valid Bearer token provided")
    void shouldGetCurrentUserProfile() throws Exception {
        User user = User.builder()
                .username("david_clark")
                .email("david@example.com")
                .passwordHash(passwordEncoder.encode("Password123!"))
                .fullName("David Clark")
                .role(Role.USER)
                .active(true)
                .build();
        userRepository.save(user);

        String token = jwtTokenProvider.generateAccessToken(user);

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("david_clark"))
                .andExpect(jsonPath("$.data.email").value("david@example.com"));
    }
}
