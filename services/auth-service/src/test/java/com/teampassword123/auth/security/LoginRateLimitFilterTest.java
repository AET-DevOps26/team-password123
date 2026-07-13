package com.teampassword123.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class LoginRateLimitFilterTest {

    @Test
    void blocksAfterMaxAttemptsFromSameIp() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter(3, 60_000L);

        for (int i = 0; i < 3; i++) {
            assertThat(login(filter, "1.2.3.4").getStatus()).isEqualTo(200);
        }
        assertThat(login(filter, "1.2.3.4").getStatus()).isEqualTo(429);
    }

    @Test
    void countsEachIpIndependently() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter(1, 60_000L);

        assertThat(login(filter, "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(login(filter, "2.2.2.2").getStatus()).isEqualTo(200);
        assertThat(login(filter, "1.1.1.1").getStatus()).isEqualTo(429); // 1.1.1.1 now over limit
    }

    @Test
    void prefersXForwardedForOverRemoteAddr() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter(1, 60_000L);

        // Same proxy remoteAddr, different real client IPs -> counted separately.
        assertThat(login(filter, "10.0.0.1", "203.0.113.1").getStatus()).isEqualTo(200);
        assertThat(login(filter, "10.0.0.1", "203.0.113.2").getStatus()).isEqualTo(200);
        assertThat(login(filter, "10.0.0.1", "203.0.113.1").getStatus()).isEqualTo(429);
    }

    @Test
    void doesNotThrottleNonAuthPaths() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter(1, 60_000L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/features");
            request.setRemoteAddr("9.9.9.9");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }

    private MockHttpServletResponse login(LoginRateLimitFilter filter, String remoteAddr)
            throws Exception {
        return login(filter, remoteAddr, null);
    }

    private MockHttpServletResponse login(
            LoginRateLimitFilter filter, String remoteAddr, String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
