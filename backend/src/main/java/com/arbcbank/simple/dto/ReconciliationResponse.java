package com.arbcbank.simple.dto;

import java.math.BigDecimal;

public class ReconciliationResponse {

    private Long accountId;
    private String accountNumber;
    private BigDecimal accountBalance;
    private BigDecimal calculatedLedgerBalance;
    private BigDecimal difference;
    private boolean reconciled;
    private long totalLedgerEntries;
    private String message;

    public ReconciliationResponse() {}

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public BigDecimal getAccountBalance() { return accountBalance; }
    public void setAccountBalance(BigDecimal accountBalance) { this.accountBalance = accountBalance; }

    public BigDecimal getCalculatedLedgerBalance() { return calculatedLedgerBalance; }
    public void setCalculatedLedgerBalance(BigDecimal calculatedLedgerBalance) { this.calculatedLedgerBalance = calculatedLedgerBalance; }

    public BigDecimal getDifference() { return difference; }
    public void setDifference(BigDecimal difference) { this.difference = difference; }

    public boolean isReconciled() { return reconciled; }
    public void setReconciled(boolean reconciled) { this.reconciled = reconciled; }

    public long getTotalLedgerEntries() { return totalLedgerEntries; }
    public void setTotalLedgerEntries(long totalLedgerEntries) { this.totalLedgerEntries = totalLedgerEntries; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
