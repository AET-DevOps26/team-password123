package com.teampassword123.analytics.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.analytics.dto.InsightResponse;
import com.teampassword123.analytics.service.AnalyticsService;
import com.teampassword123.analytics.service.InsightService;
import com.teampassword123.common.security.AuthenticatedUser;
import com.teampassword123.common.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerInsightTest {

    private static final String TOKEN = "bearer-token";
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private AnalyticsService analyticsService;

    @Mock private InsightService insightService;

    @Mock private HttpServletRequest request;

    @InjectMocks private AnalyticsController controller;

    @Test
    void insightForwardsUserIdAndBearerTokenToService() {
        AuthenticatedUser user = new AuthenticatedUser(USER_ID, "user@example.com");
        InsightResponse expected =
                new InsightResponse("ok", List.of(), "logos:gpt-oss-120b", "success");
        when(request.getAttribute(JwtAuthenticationFilter.BEARER_TOKEN_ATTRIBUTE))
                .thenReturn(TOKEN);
        // tz omitted (null) resolves to UTC.
        when(insightService.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC))
                .thenReturn(expected);

        InsightResponse result = controller.insight(user, request, "week", null);

        assertThat(result).isSameAs(expected);
        verify(insightService).getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);
    }
}
