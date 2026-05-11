package com.teampassword123.analytics.controller;

import com.teampassword123.analytics.dto.GoalRequest;
import com.teampassword123.analytics.dto.GoalResponse;
import com.teampassword123.analytics.security.AuthenticatedUser;
import com.teampassword123.analytics.service.GoalService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/goals")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    @GetMapping
    public ResponseEntity<GoalResponse> get(@AuthenticationPrincipal AuthenticatedUser user) {
        return goalService.get(user.id())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public GoalResponse upsert(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody GoalRequest request
    ) {
        return goalService.upsert(user.id(), request);
    }
}
