package com.teampassword123.nutrition.controller;

import com.teampassword123.nutrition.dto.goal.GoalRequest;
import com.teampassword123.nutrition.dto.goal.GoalResponse;
import com.teampassword123.nutrition.security.UserPrincipal;
import com.teampassword123.nutrition.service.GoalService;
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
    public ResponseEntity<GoalResponse> get(@AuthenticationPrincipal UserPrincipal principal) {
        return goalService.get(principal.id())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public GoalResponse upsert(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody GoalRequest request
    ) {
        return goalService.upsert(principal.id(), request);
    }
}
