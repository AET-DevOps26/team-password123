package com.teampassword123.nutrition.service;

import com.teampassword123.nutrition.domain.AppUser;
import com.teampassword123.nutrition.domain.NutritionGoal;
import com.teampassword123.nutrition.dto.goal.GoalRequest;
import com.teampassword123.nutrition.dto.goal.GoalResponse;
import com.teampassword123.nutrition.repository.NutritionGoalRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoalService {

    private final NutritionGoalRepository goals;
    private final UserLookupService userLookupService;

    public GoalService(NutritionGoalRepository goals, UserLookupService userLookupService) {
        this.goals = goals;
        this.userLookupService = userLookupService;
    }

    @Transactional(readOnly = true)
    public Optional<GoalResponse> get(UUID userId) {
        return goals.findByUserId(userId).map(this::toResponse);
    }

    @Transactional
    public GoalResponse upsert(UUID userId, GoalRequest request) {
        AppUser user = userLookupService.byId(userId);
        NutritionGoal goal = goals.findByUserId(userId).orElseGet(NutritionGoal::new);
        goal.setUser(user);
        goal.setDailyCalories(request.dailyCalories());
        goal.setProteinGrams(request.proteinGrams());
        goal.setCarbsGrams(request.carbsGrams());
        goal.setFatGrams(request.fatGrams());
        goal.setFiberGrams(request.fiberGrams());
        goal.setUpdatedAt(OffsetDateTime.now());
        return toResponse(goals.save(goal));
    }

    GoalResponse toResponse(NutritionGoal goal) {
        return new GoalResponse(
                goal.getId(),
                goal.getDailyCalories(),
                goal.getProteinGrams(),
                goal.getCarbsGrams(),
                goal.getFatGrams(),
                goal.getFiberGrams(),
                goal.getUpdatedAt()
        );
    }
}
