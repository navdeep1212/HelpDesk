package com.helpdesk.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Validates Origin/Referer header on cookie-authenticated sensitive endpoints
 * (/api/auth/refresh, /api/auth/logout) to prevent Cross-Site Request Forgery (CSRF).
 *
 * Requirements:
 * 1. Allow legitimate same-origin requests (e.g. backend at http://localhost:8080, Swagger UI).
 * 2. Allow explicitly configured frontend origins (e.g. http://localhost:5173).
 * 3. Reject untrusted cross-origin mutation requests.
 * 4. Handle missing Origin headers safely for non-browser clients (curl, Postman, test harnesses)
 *    while blocking cross-site browser requests (e.g. via Sec-Fetch-Site).
 */
@Slf4j
@Component
public class OriginValidationFilter extends OncePerRequestFilter {

    private final List<String> allowedOrigins;

    public OriginValidationFilter(@Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:8080}") String allowedOriginsStr) {
        this.allowedOrigins = new ArrayList<>(
                Arrays.stream(allowedOriginsStr.split(","))
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .toList()
        );
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String uri = request.getRequestURI();

        // Enforce Origin / CSRF check on cookie-consuming mutation endpoints
        if (uri.endsWith("/api/auth/refresh") || uri.endsWith("/api/auth/logout")) {

            // 1. Check Sec-Fetch-Site if provided by modern browsers
            String secFetchSite = request.getHeader("Sec-Fetch-Site");
            if ("cross-site".equalsIgnoreCase(secFetchSite)) {
                log.warn("Blocked CSRF attempt with Sec-Fetch-Site: cross-site on URI: {}", uri);
                sendCsrfError(response, "Untrusted cross-origin request blocked.");
                return;
            }

            // 2. Extract Origin from 'Origin' or fallback to 'Referer'
            String origin = request.getHeader("Origin");
            if (!StringUtils.hasText(origin)) {
                String referer = request.getHeader("Referer");
                if (StringUtils.hasText(referer)) {
                    try {
                        URI refUri = URI.create(referer);
                        if (refUri.getScheme() != null && refUri.getAuthority() != null) {
                            origin = refUri.getScheme() + "://" + refUri.getAuthority();
                        }
                    } catch (Exception e) {
                        log.warn("Invalid Referer header received: {}", referer);
                    }
                }
            }

            // 3. If an Origin / Referer is present, validate it against allowed origins and same-origin
            if (StringUtils.hasText(origin)) {
                if (!isOriginPermitted(origin, request)) {
                    log.warn("Blocked CSRF request from untrusted origin '{}' on URI: {}", origin, uri);
                    sendCsrfError(response, "Untrusted origin blocked.");
                    return;
                }
            }
            // 4. If neither Origin nor Referer is present:
            // Non-browser clients (curl, Postman, test harnesses) do not send Origin/Referer
            // or Sec-Fetch-Site. They are permitted because ambient browser credentials
            // cannot be exploited without a browser origin.
        }

        filterChain.doFilter(request, response);
    }

    private boolean isOriginPermitted(String origin, HttpServletRequest request) {
        if (!StringUtils.hasText(origin) || "null".equalsIgnoreCase(origin.trim())) {
            return false;
        }

        String normalizedOrigin = origin.trim();

        // Check explicitly allowed origins
        for (String allowed : allowedOrigins) {
            if (allowed.equalsIgnoreCase(normalizedOrigin)) {
                return true;
            }
        }

        // Check if origin matches current request (same-origin, e.g. Swagger UI on backend port)
        return isSameOrigin(normalizedOrigin, request);
    }

    private boolean isSameOrigin(String origin, HttpServletRequest request) {
        try {
            URI originUri = URI.create(origin);
            String originScheme = originUri.getScheme();
            String originHost = originUri.getHost();
            int originPort = originUri.getPort();
            if (originPort == -1) {
                originPort = "https".equalsIgnoreCase(originScheme) ? 443 : 80;
            }

            String serverScheme = request.getScheme();
            String serverHost = request.getServerName();
            int serverPort = request.getServerPort();
            if (serverPort == -1) {
                serverPort = "https".equalsIgnoreCase(serverScheme) ? 443 : 80;
            }

            // Direct scheme, host, and port match
            if (originScheme != null && originScheme.equalsIgnoreCase(serverScheme)
                    && originHost != null && (originHost.equalsIgnoreCase(serverHost) || isLoopbackHost(originHost, serverHost))
                    && originPort == serverPort) {
                return true;
            }

            // Also check Host header if behind proxy / container
            String hostHeader = request.getHeader("Host");
            if (StringUtils.hasText(hostHeader)) {
                String expectedHostOrigin = serverScheme + "://" + hostHeader;
                if (expectedHostOrigin.equalsIgnoreCase(origin)) {
                    return true;
                }
            }
        } catch (Exception e) {
            log.warn("Error comparing same-origin for origin '{}': {}", origin, e.getMessage());
        }
        return false;
    }

    private boolean isLoopbackHost(String host1, String host2) {
        return (host1.equalsIgnoreCase("localhost") || host1.equals("127.0.0.1"))
                && (host2.equalsIgnoreCase("localhost") || host2.equals("127.0.0.1"));
    }

    private void sendCsrfError(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"success\":false,\"error\":\"CSRF_VIOLATION\",\"message\":\"" + message + "\"}");
        response.getWriter().flush();
    }
}
