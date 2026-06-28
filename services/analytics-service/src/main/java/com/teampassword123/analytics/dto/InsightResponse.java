package com.teampassword123.analytics.dto;

import java.util.List;

public record InsightResponse(
    String insight, List<FactRef> factsUsed, String generatedBy, String result) {}
