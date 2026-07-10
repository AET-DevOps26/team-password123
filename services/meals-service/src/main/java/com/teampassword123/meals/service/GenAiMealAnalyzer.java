package com.teampassword123.meals.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Real {@link MealAnalyzer} backed by the GenAI service (a vision LLM behind {@code /api/analyze}).
 * Active only when {@code app.genai.base-url} is set — otherwise {@link HeuristicMealAnalyzer}
 * stays the sole analyzer. Marked {@link Primary} so it wins over the placeholder whenever it is
 * present.
 */
@Component
@Primary
@ConditionalOnProperty(prefix = "app.genai", name = "base-url")
public class GenAiMealAnalyzer implements MealAnalyzer {

  private static final int CONNECT_TIMEOUT_MS = 5_000;
  private static final int READ_TIMEOUT_MS = 120_000;

  private final RestClient client;

  public GenAiMealAnalyzer(
      @Value("${app.genai.base-url}") String baseUrl, RestClient.Builder builder) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
    factory.setReadTimeout(READ_TIMEOUT_MS);
    this.client = builder.baseUrl(baseUrl).requestFactory(factory).build();
  }

  @Override
  public MealAnalysis analyze(byte[] image, String filename, String visionProvider) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add("file", new NamedByteArrayResource(image, filename));

    GenAiNutrition nutrition =
        client
            .post()
            .uri(
                uriBuilder ->
                    uriBuilder
                        .path("/api/analyze")
                        .queryParam("vision_provider", normalizeVisionProvider(visionProvider))
                        .build())
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(body)
            .retrieve()
            .body(GenAiNutrition.class);

    return toMealAnalysis(nutrition);
  }

  static String normalizeVisionProvider(String visionProvider) {
    if (visionProvider == null || visionProvider.isBlank()) {
      return "auto";
    }
    return visionProvider.trim().toLowerCase();
  }

  /**
   * Maps the GenAI response onto the internal {@link MealAnalysis} shape. Package-private for
   * testing.
   */
  static MealAnalysis toMealAnalysis(GenAiNutrition nutrition) {
    return new MealAnalysis(
        dishName(nutrition.foods()),
        orZero(nutrition.calories()),
        orZero(nutrition.protein()),
        orZero(nutrition.carbs()),
        orZero(nutrition.fat()),
        nutrition.confidence() == null ? 0.0 : nutrition.confidence().doubleValue(),
        nutrition.visionModel(),
        orZero(nutrition.portionGrams()));
  }

  private static String dishName(List<String> foods) {
    if (foods == null || foods.isEmpty()) {
      return "Photo meal";
    }
    List<String> names =
        foods.stream()
            .filter(food -> food != null && !food.isBlank())
            .map(String::trim)
            .distinct()
            .limit(4)
            .toList();
    if (names.isEmpty()) {
      return "Photo meal";
    }
    return formatFoodList(names);
  }

  private static String formatFoodList(List<String> names) {
    List<String> titled = names.stream().map(GenAiMealAnalyzer::capitalize).toList();
    if (titled.size() == 1) {
      return titled.get(0);
    }
    if (titled.size() == 2) {
      return titled.get(0) + " and " + titled.get(1);
    }
    return String.join(", ", titled.subList(0, titled.size() - 1))
        + ", and "
        + titled.get(titled.size() - 1);
  }

  private static String capitalize(String value) {
    if (value.isEmpty()) {
      return value;
    }
    return Character.toUpperCase(value.charAt(0)) + value.substring(1);
  }

  private static BigDecimal orZero(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }

  /** ByteArrayResource that reports a filename, so the multipart part is sent as a file. */
  private static final class NamedByteArrayResource extends ByteArrayResource {
    private final String filename;

    private NamedByteArrayResource(byte[] bytes, String filename) {
      super(bytes);
      this.filename = filename;
    }

    @Override
    public String getFilename() {
      return filename;
    }
  }

  /** Mirror of the GenAI service's NutritionResponse (snake_case JSON). */
  @JsonIgnoreProperties(ignoreUnknown = true)
  record GenAiNutrition(
      List<String> foods,
      BigDecimal calories,
      @JsonProperty("protein_grams") BigDecimal protein,
      @JsonProperty("carbs_grams") BigDecimal carbs,
      @JsonProperty("fat_grams") BigDecimal fat,
      @JsonProperty("fiber_grams") BigDecimal fiber,
      BigDecimal confidence,
      @JsonProperty("vision_model") String visionModel,
      @JsonProperty("portion_grams") BigDecimal portionGrams) {}
}
