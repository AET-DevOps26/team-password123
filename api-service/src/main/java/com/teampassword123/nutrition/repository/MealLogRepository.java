package com.teampassword123.nutrition.repository;

import com.teampassword123.nutrition.domain.MealLog;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MealLogRepository extends JpaRepository<MealLog, UUID> {

    @EntityGraph(attributePaths = "items")
    List<MealLog> findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
            UUID userId,
            OffsetDateTime from,
            OffsetDateTime to
    );

    @EntityGraph(attributePaths = "items")
    Optional<MealLog> findByIdAndUserId(UUID id, UUID userId);
}
