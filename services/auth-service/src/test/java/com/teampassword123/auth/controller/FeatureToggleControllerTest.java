package com.teampassword123.auth.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.teampassword123.auth.service.FeatureToggleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class FeatureToggleControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FeatureToggleService featureToggles = new FeatureToggleService();
        FeatureToggleController controller = new FeatureToggleController(featureToggles);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getUnknownFeatureReturnsFalse() throws Exception {
        mockMvc.perform(get("/api/features/scan-vision-model-picker"))
                .andExpect(status().isOk())
                .andExpect(content().string("false"));
    }

    @Test
    void canToggleFeatureViaPut() throws Exception {
        mockMvc.perform(put("/api/features/scan-vision-model-picker").param("enabled", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string("true"));

        mockMvc.perform(get("/api/features/scan-vision-model-picker"))
                .andExpect(status().isOk())
                .andExpect(content().string("true"));
    }

    @Test
    void listEndpointReturnsMap() throws Exception {
        mockMvc.perform(get("/api/features")).andExpect(status().isOk());
    }
}
