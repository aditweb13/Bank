package com.arbcbank.simple.controller;

import com.arbcbank.simple.model.Account;
import com.arbcbank.simple.model.Customer;
import com.arbcbank.simple.service.BankService;
import com.arbcbank.simple.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class CustomerSelfServiceTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BankService bankService;

    @Test
    @WithMockUser(username = "Khushi@example.com", authorities = "ROLE_CUSTOMER")
    public void getMyAccounts_Success() throws Exception {
        Account acc = new Account();
        acc.setId(1L);
        acc.setAccountNumber("AC1002003001");
        acc.setBalance(new BigDecimal("150000.00"));
        
        when(bankService.getMyAccounts("Khushi@example.com")).thenReturn(List.of(acc));

        mockMvc.perform(get("/api/customer/me/accounts"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$[0].accountNumber").value("AC1002003001"));
    }

    @Test
    public void getMyAccounts_NoToken_Unauthorized() throws Exception {
        mockMvc.perform(get("/api/customer/me/accounts"))
               .andExpect(status().isUnauthorized());
    }
}
