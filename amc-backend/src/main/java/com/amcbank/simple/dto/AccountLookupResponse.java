package com.amcbank.simple.dto;

public class AccountLookupResponse {
    private String accountNumber;
    private String maskedAccountNumber;
    private String maskedHolderName;

    public AccountLookupResponse() {}

    public AccountLookupResponse(String accountNumber, String maskedAccountNumber, String maskedHolderName) {
        this.accountNumber = accountNumber;
        this.maskedAccountNumber = maskedAccountNumber;
        this.maskedHolderName = maskedHolderName;
    }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getMaskedAccountNumber() { return maskedAccountNumber; }
    public void setMaskedAccountNumber(String maskedAccountNumber) { this.maskedAccountNumber = maskedAccountNumber; }

    public String getMaskedHolderName() { return maskedHolderName; }
    public void setMaskedHolderName(String maskedHolderName) { this.maskedHolderName = maskedHolderName; }
}
