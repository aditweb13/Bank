package com.arbcbank.simple.dto;

import java.math.BigDecimal;

public class OverdueLoanItemDto {
    private Long loanId;
    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String loanType;
    private BigDecimal principal;
    private BigDecimal outstandingPrincipal;
    private int overdueInstallmentsCount;
    private BigDecimal totalOverdueAmount;
    private long maxDaysPastDue;

    public OverdueLoanItemDto() {
    }

    public Long getLoanId() {
        return loanId;
    }

    public void setLoanId(Long loanId) {
        this.loanId = loanId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long customerId) {
        this.customerId = customerId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerEmail() {
        return customerEmail;
    }

    public void setCustomerEmail(String customerEmail) {
        this.customerEmail = customerEmail;
    }

    public String getLoanType() {
        return loanType;
    }

    public void setLoanType(String loanType) {
        this.loanType = loanType;
    }

    public BigDecimal getPrincipal() {
        return principal;
    }

    public void setPrincipal(BigDecimal principal) {
        this.principal = principal;
    }

    public BigDecimal getOutstandingPrincipal() {
        return outstandingPrincipal;
    }

    public void setOutstandingPrincipal(BigDecimal outstandingPrincipal) {
        this.outstandingPrincipal = outstandingPrincipal;
    }

    public int getOverdueInstallmentsCount() {
        return overdueInstallmentsCount;
    }

    public void setOverdueInstallmentsCount(int overdueInstallmentsCount) {
        this.overdueInstallmentsCount = overdueInstallmentsCount;
    }

    public BigDecimal getTotalOverdueAmount() {
        return totalOverdueAmount;
    }

    public void setTotalOverdueAmount(BigDecimal totalOverdueAmount) {
        this.totalOverdueAmount = totalOverdueAmount;
    }

    public long getMaxDaysPastDue() {
        return maxDaysPastDue;
    }

    public void setMaxDaysPastDue(long maxDaysPastDue) {
        this.maxDaysPastDue = maxDaysPastDue;
    }
}
