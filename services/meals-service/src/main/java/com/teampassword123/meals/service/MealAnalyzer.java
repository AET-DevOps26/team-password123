package com.teampassword123.meals.service;

public interface MealAnalyzer {

    MealAnalysis analyze(byte[] image, String filename);
}
