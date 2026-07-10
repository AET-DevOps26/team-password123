package com.teampassword123.auth.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.teampassword123.auth.service.FeatureToggleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FeatureToggleController.class)
@Import(FeatureToggleService.class)
@AutoConfigureMockMvc(addFilters = false)
class FeatureToggleControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @Test
  void getUnknownFeatureReturnsFalse() throws Exception {
    mockMvc
        .perform(get("/api/features/scan-vision-model-picker"))
        .andExpect(status().isOk())
        .andExpect(content().string("false"));
  }

  @Test
  void canToggleFeatureViaPut() throws Exception {
    mockMvc
        .perform(put("/api/features/scan-vision-model-picker").param("enabled", "true"))
        .andExpect(status().isOk())
        .andExpect(content().string("true"));

    mockMvc
        .perform(get("/api/features/scan-vision-model-picker"))
        .andExpect(status().isOk())
        .andExpect(content().string("true"));
  }

  @Test
  void listEndpointReturnsMap() throws Exception {
    mockMvc.perform(get("/api/features")).andExpect(status().isOk());
  }
}
