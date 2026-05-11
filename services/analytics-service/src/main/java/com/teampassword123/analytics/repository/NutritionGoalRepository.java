package com.teampassword123.analytics.repository;

import com.teampassword123.analytics.domain.NutritionGoal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NutritionGoalRepository extends JpaRepository<NutritionGoal, UUID> {

    Optional<NutritionGoal> findByUserId(UUID userId);
}
