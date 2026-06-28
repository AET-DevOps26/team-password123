package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GenAiInsightResponse(
    String insight,
    @JsonProperty("facts_used") List<FactRef> factsUsed,
    @JsonProperty("generated_by") String generatedBy,
    String result) {}
