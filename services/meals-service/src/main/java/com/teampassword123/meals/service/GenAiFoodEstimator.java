package com.teampassword123.meals.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.teampassword123.meals.dto.FoodEstimateResponse;
import java.math.BigDecimal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
@ConditionalOnProperty(prefix = "app.genai", name = "base-url")
public class GenAiFoodEstimator {

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 60_000;

    private final RestClient client;

    public GenAiFoodEstimator(@Value("${app.genai.base-url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        // RestClient.builder() (static), not an injected RestClient.Builder bean:
        // Spring Boot 4 no longer auto-provides that bean and the DI fails at startup.
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public FoodEstimateResponse estimate(String foodName) {
        GenAiEstimateRequest body = new GenAiEstimateRequest(foodName);

        try {
            GenAiEstimateResponse raw =
                    client.post()
                            .uri("/api/estimate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(body)
                            .retrieve()
                            .body(GenAiEstimateResponse.class);
            return toResponse(raw);
        } catch (RestClientResponseException ex) {
            HttpStatus status =
                    ex.getStatusCode().is4xxClientError()
                            ? HttpStatus.BAD_REQUEST
                            : HttpStatus.SERVICE_UNAVAILABLE;
            throw new ResponseStatusException(status, "AI estimation temporarily unavailable");
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "AI estimation temporarily unavailable");
        }
    }

    private static FoodEstimateResponse toResponse(GenAiEstimateResponse r) {
        return new FoodEstimateResponse(
                r.foodName(),
                clamp(r.caloriesPer100g()),
                clamp(r.proteinPer100g()),
                clamp(r.carbsPer100g()),
                clamp(r.fatPer100g()),
                clamp(r.typicalPortionGrams()),
                r.typicalPortionLabel() != null ? r.typicalPortionLabel() : "100 g",
                r.source() != null ? r.source() : "unknown",
                clamp(r.confidence()));
    }

    // Floor at zero: a null or negative value from genai must not pass through.
    private static BigDecimal clamp(BigDecimal v) {
        return v == null || v.signum() < 0 ? BigDecimal.ZERO : v;
    }

    private record GenAiEstimateRequest(@JsonProperty("food_name") String foodName) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record GenAiEstimateResponse(
            @JsonProperty("food_name") String foodName,
            @JsonProperty("calories_per_100g") BigDecimal caloriesPer100g,
            @JsonProperty("protein_grams_per_100g") BigDecimal proteinPer100g,
            @JsonProperty("carbs_grams_per_100g") BigDecimal carbsPer100g,
            @JsonProperty("fat_grams_per_100g") BigDecimal fatPer100g,
            @JsonProperty("typical_portion_grams") BigDecimal typicalPortionGrams,
            @JsonProperty("typical_portion_label") String typicalPortionLabel,
            String source,
            BigDecimal confidence) {}
}
