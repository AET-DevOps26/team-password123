package com.teampassword123.nutrition.repository;

import com.teampassword123.nutrition.domain.NutritionGoal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NutritionGoalRepository extends JpaRepository<NutritionGoal, UUID> {

    Optional<NutritionGoal> findByUserId(UUID userId);
}
