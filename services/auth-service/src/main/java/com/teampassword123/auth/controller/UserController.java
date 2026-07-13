package com.teampassword123.auth.controller;

import com.teampassword123.auth.dto.UpdateUserRequest;
import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.security.UserPrincipal;
import com.teampassword123.auth.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.get(principal.id());
    }

    @PutMapping("/me")
    public UserResponse updateMe(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateUserRequest req) {
        return userService.update(principal.id(), req);
    }

    // GET /api/users/{id} removed: it returned any user's profile by UUID with no
    // ownership check (IDOR). Callers use /me, which is scoped to the JWT subject.
}
