package com.arbcbank.simple.dto;

import java.math.BigDecimal;

public class CustomerAccountResponse {
    private Long id;
    private String accountNumber;
    private String maskedAccountNumber;
    private String type;
    private BigDecimal balance;
    private BigDecimal minimumBalance;
    private BigDecimal dailyTransferLimit;
    private String status;

    public CustomerAccountResponse() {}

    public CustomerAccountResponse(Long id, String accountNumber, String maskedAccountNumber, String type,
                                   BigDecimal balance, BigDecimal minimumBalance, BigDecimal dailyTransferLimit, String status) {
        this.id = id;
        this.accountNumber = accountNumber;
        this.maskedAccountNumber = maskedAccountNumber;
        this.type = type;
        this.balance = balance;
        this.minimumBalance = minimumBalance;
        this.dailyTransferLimit = dailyTransferLimit;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getMaskedAccountNumber() { return maskedAccountNumber; }
    public void setMaskedAccountNumber(String maskedAccountNumber) { this.maskedAccountNumber = maskedAccountNumber; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public BigDecimal getMinimumBalance() { return minimumBalance; }
    public void setMinimumBalance(BigDecimal minimumBalance) { this.minimumBalance = minimumBalance; }

    public BigDecimal getDailyTransferLimit() { return dailyTransferLimit; }
    public void setDailyTransferLimit(BigDecimal dailyTransferLimit) { this.dailyTransferLimit = dailyTransferLimit; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
