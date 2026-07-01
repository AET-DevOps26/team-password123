package com.teampassword123.analytics.client;

import com.teampassword123.analytics.dto.GenAiInsightRequest;
import com.teampassword123.analytics.dto.GenAiInsightResponse;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class GenAiInsightClient {

  private static final Logger log = LoggerFactory.getLogger(GenAiInsightClient.class);
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
  private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);

  private final RestClient restClient;

  public GenAiInsightClient(@Value("${app.genai.base-url}") String baseUrl) {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(CONNECT_TIMEOUT);
    requestFactory.setReadTimeout(READ_TIMEOUT);
    this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
  }

  /**
   * POSTs the eating profile to genai-service and returns the generated insight. Returns {@code
   * null} on any failure (timeout, connection error, non-2xx) so the caller can fail soft — this is
   * best-effort, never a hard dependency.
   */
  public GenAiInsightResponse generate(GenAiInsightRequest request) {
    try {
      return restClient
          .post()
          .uri("/api/insight")
          .contentType(MediaType.APPLICATION_JSON)
          .body(request)
          .retrieve()
          .body(GenAiInsightResponse.class);
    } catch (Exception e) {
      log.warn("genai insight request failed: {}", e.getMessage());
      return null;
    }
  }
}
