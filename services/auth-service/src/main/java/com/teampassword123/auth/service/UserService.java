package com.teampassword123.auth.service;

import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.exception.NotFoundException;
import com.teampassword123.auth.repository.AppUserRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final AppUserRepository users;

    public UserService(AppUserRepository users) {
        this.users = users;
    }

    public UserResponse get(UUID id) {
        AppUser user = users.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
    }
}
