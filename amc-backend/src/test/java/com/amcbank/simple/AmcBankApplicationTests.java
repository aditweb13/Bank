package com.amcbank.simple;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AmcBankApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Application Context Loads and Rejects Unauthenticated Protected Endpoint")
    void contextLoads() throws Exception {
        // Unauthenticated access to dashboard should return 401 or 403
        mockMvc.perform(post("/api/dashboard"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Public Login Endpoint Rejects Missing Credentials")
    void testLoginWithEmptyBody() throws Exception {
        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
