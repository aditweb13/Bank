package com.arbcbank.simple.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ForeclosureQuoteResponse {
    private Long loanId;
    private LocalDate asOfDate;
    private BigDecimal outstandingPrincipal;
    private BigDecimal accruedInterest;
    private double foreclosureFeeRate;
    private BigDecimal foreclosureFee;
    private BigDecimal pendingPenalties;
    private BigDecimal totalForeclosureAmount;

    public ForeclosureQuoteResponse() {
    }

    public Long getLoanId() {
        return loanId;
    }

    public void setLoanId(Long loanId) {
        this.loanId = loanId;
    }

    public LocalDate getAsOfDate() {
        return asOfDate;
    }

    public void setAsOfDate(LocalDate asOfDate) {
        this.asOfDate = asOfDate;
    }

    public BigDecimal getOutstandingPrincipal() {
        return outstandingPrincipal;
    }

    public void setOutstandingPrincipal(BigDecimal outstandingPrincipal) {
        this.outstandingPrincipal = outstandingPrincipal;
    }

    public BigDecimal getAccruedInterest() {
        return accruedInterest;
    }

    public void setAccruedInterest(BigDecimal accruedInterest) {
        this.accruedInterest = accruedInterest;
    }

    public double getForeclosureFeeRate() {
        return foreclosureFeeRate;
    }

    public void setForeclosureFeeRate(double foreclosureFeeRate) {
        this.foreclosureFeeRate = foreclosureFeeRate;
    }

    public BigDecimal getForeclosureFee() {
        return foreclosureFee;
    }

    public void setForeclosureFee(BigDecimal foreclosureFee) {
        this.foreclosureFee = foreclosureFee;
    }

    public BigDecimal getPendingPenalties() {
        return pendingPenalties;
    }

    public void setPendingPenalties(BigDecimal pendingPenalties) {
        this.pendingPenalties = pendingPenalties;
    }

    public BigDecimal getTotalForeclosureAmount() {
        return totalForeclosureAmount;
    }

    public void setTotalForeclosureAmount(BigDecimal totalForeclosureAmount) {
        this.totalForeclosureAmount = totalForeclosureAmount;
    }
}
