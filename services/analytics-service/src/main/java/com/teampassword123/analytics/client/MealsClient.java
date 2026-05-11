package com.teampassword123.analytics.client;

import com.teampassword123.analytics.dto.MealSummary;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class MealsClient {

    private final RestClient restClient;

    public MealsClient(@Value("${app.meals-service.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    public List<MealSummary> listForUser(String bearerToken, @DateTimeFormat LocalDate from, LocalDate to) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/meals")
                        .queryParam("from", from)
                        .queryParam("to", to)
                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }
}
