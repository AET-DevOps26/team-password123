package com.teampassword123.meals.repository;

import com.teampassword123.meals.domain.PhotoLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoLogRepository extends JpaRepository<PhotoLog, UUID> {

    Optional<PhotoLog> findByIdAndUserId(UUID id, UUID userId);
}
