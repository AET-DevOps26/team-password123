package com.teampassword123.auth.controller;

import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.security.UserPrincipal;
import com.teampassword123.auth.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

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

    @GetMapping("/{id}")
    public UserResponse byId(@PathVariable UUID id) {
        return userService.get(id);
    }
}
