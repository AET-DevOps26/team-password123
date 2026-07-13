package com.teampassword123.meals.repository;

import com.teampassword123.meals.domain.MealLog;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MealLogRepository extends JpaRepository<MealLog, UUID> {

  @EntityGraph(attributePaths = "items")
  List<MealLog> findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
      UUID userId, OffsetDateTime from, OffsetDateTime to);

  @EntityGraph(attributePaths = "items")
  Optional<MealLog> findByIdAndUserId(UUID id, UUID userId);

  // Timestamps only — no meal/items graph — so callers that just need "which
  // days have meals" (streak) don't pull whole meal bodies out of the DB.
  @Query(
      "select m.loggedAt from MealLog m where m.userId = :userId and m.loggedAt between :from and :to")
  List<OffsetDateTime> findLoggedAtInRange(
      @Param("userId") UUID userId,
      @Param("from") OffsetDateTime from,
      @Param("to") OffsetDateTime to);
}
