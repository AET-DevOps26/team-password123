package com.teampassword123.meals.service;

public interface MealAnalyzer {

  /**
   * @param visionProvider {@code auto}, {@code gemini}, or {@code nemotron}
   */
  MealAnalysis analyze(byte[] image, String filename, String visionProvider);
}
