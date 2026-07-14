package com.teampassword123.auth.service;

import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.dto.UpdateUserRequest;
import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.repository.AppUserRepository;
import com.teampassword123.common.web.NotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final AppUserRepository users;

    public UserService(AppUserRepository users) {
        this.users = users;
    }

    public UserResponse get(UUID id) {
        return toResponse(load(id));
    }

    // Full PUT replace: optional profile fields are set to null when omitted.
    public UserResponse update(UUID id, UpdateUserRequest req) {
        AppUser user = load(id);
        user.setDisplayName(req.displayName());
        user.setHeightCm(req.heightCm());
        user.setWeightKg(req.weightKg());
        user.setAge(req.age());
        user.setSex(req.sex());
        user.setActivityLevel(req.activityLevel());
        user.setGoal(req.goal());
        return toResponse(users.save(user));
    }

    private AppUser load(UUID id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
    }

    private UserResponse toResponse(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getCreatedAt(),
                user.getHeightCm(),
                user.getWeightKg(),
                user.getAge(),
                user.getSex(),
                user.getActivityLevel(),
                user.getGoal());
    }
}
