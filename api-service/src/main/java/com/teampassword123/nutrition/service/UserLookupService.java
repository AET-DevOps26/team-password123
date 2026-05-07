package com.teampassword123.nutrition.service;

import com.teampassword123.nutrition.domain.AppUser;
import com.teampassword123.nutrition.exception.NotFoundException;
import com.teampassword123.nutrition.repository.AppUserRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class UserLookupService {

    private final AppUserRepository users;

    public UserLookupService(AppUserRepository users) {
        this.users = users;
    }

    public AppUser byId(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }
}
