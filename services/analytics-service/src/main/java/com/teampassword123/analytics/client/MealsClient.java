package com.teampassword123.analytics.client;

import com.teampassword123.analytics.dto.MealSummary;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class MealsClient {

    // Without timeouts a hung meals-service pins the calling Tomcat thread
    // indefinitely; every /analytics/* request holds one, so the pool drains.
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

    private final RestClient restClient;

    public MealsClient(@Value("${app.meals-service.base-url}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT);
        requestFactory.setReadTimeout(READ_TIMEOUT);
        this.restClient =
                RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    public List<MealSummary> listForUser(
            String bearerToken, @DateTimeFormat LocalDate from, LocalDate to, ZoneId zone) {
        return restClient
                .get()
                .uri(
                        uriBuilder ->
                                uriBuilder
                                        .path("/api/meals")
                                        .queryParam("from", from)
                                        .queryParam("to", to)
                                        .queryParam("tz", zone.getId())
                                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }

    // Distinct dates with at least one meal — a few bytes per day instead of the
    // full meal bodies listForUser transfers. Used by the streak computation. The
    // zone is forwarded so meals-service buckets days on the user's local calendar.
    public List<LocalDate> loggedDates(
            String bearerToken, LocalDate from, LocalDate to, ZoneId zone) {
        return restClient
                .get()
                .uri(
                        uriBuilder ->
                                uriBuilder
                                        .path("/api/meals/logged-dates")
                                        .queryParam("from", from)
                                        .queryParam("to", to)
                                        .queryParam("tz", zone.getId())
                                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }
}
