package com.amcbank.simple.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class LoanSummaryResponse {
    private Long loanId;
    private String loanType;
    private BigDecimal principal;
    private BigDecimal outstandingPrincipal;
    private double interestRate;
    private int tenureMonths;
    private BigDecimal emi;
    private String status;
    private BigDecimal totalInterestPaid;
    private BigDecimal totalPenaltyPaid;
    private int paidInstallmentsCount;
    private int remainingInstallmentsCount;
    private double repaymentProgressPercent;
    private Integer nextInstallmentNo;
    private LocalDate nextDueDate;
    private BigDecimal nextDueAmount;
    private BigDecimal overdueAmount;
    private Boolean autoDebit;
    private Long autoDebitAccountId;

    public LoanSummaryResponse() {
    }

    public Long getLoanId() {
        return loanId;
    }

    public void setLoanId(Long loanId) {
        this.loanId = loanId;
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

    public double getInterestRate() {
        return interestRate;
    }

    public void setInterestRate(double interestRate) {
        this.interestRate = interestRate;
    }

    public int getTenureMonths() {
        return tenureMonths;
    }

    public void setTenureMonths(int tenureMonths) {
        this.tenureMonths = tenureMonths;
    }

    public BigDecimal getEmi() {
        return emi;
    }

    public void setEmi(BigDecimal emi) {
        this.emi = emi;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getTotalInterestPaid() {
        return totalInterestPaid;
    }

    public void setTotalInterestPaid(BigDecimal totalInterestPaid) {
        this.totalInterestPaid = totalInterestPaid;
    }

    public BigDecimal getTotalPenaltyPaid() {
        return totalPenaltyPaid;
    }

    public void setTotalPenaltyPaid(BigDecimal totalPenaltyPaid) {
        this.totalPenaltyPaid = totalPenaltyPaid;
    }

    public int getPaidInstallmentsCount() {
        return paidInstallmentsCount;
    }

    public void setPaidInstallmentsCount(int paidInstallmentsCount) {
        this.paidInstallmentsCount = paidInstallmentsCount;
    }

    public int getRemainingInstallmentsCount() {
        return remainingInstallmentsCount;
    }

    public void setRemainingInstallmentsCount(int remainingInstallmentsCount) {
        this.remainingInstallmentsCount = remainingInstallmentsCount;
    }

    public double getRepaymentProgressPercent() {
        return repaymentProgressPercent;
    }

    public void setRepaymentProgressPercent(double repaymentProgressPercent) {
        this.repaymentProgressPercent = repaymentProgressPercent;
    }

    public Integer getNextInstallmentNo() {
        return nextInstallmentNo;
    }

    public void setNextInstallmentNo(Integer nextInstallmentNo) {
        this.nextInstallmentNo = nextInstallmentNo;
    }

    public LocalDate getNextDueDate() {
        return nextDueDate;
    }

    public void setNextDueDate(LocalDate nextDueDate) {
        this.nextDueDate = nextDueDate;
    }

    public BigDecimal getNextDueAmount() {
        return nextDueAmount;
    }

    public void setNextDueAmount(BigDecimal nextDueAmount) {
        this.nextDueAmount = nextDueAmount;
    }

    public BigDecimal getOverdueAmount() {
        return overdueAmount;
    }

    public void setOverdueAmount(BigDecimal overdueAmount) {
        this.overdueAmount = overdueAmount;
    }

    public Boolean getAutoDebit() {
        return autoDebit;
    }

    public void setAutoDebit(Boolean autoDebit) {
        this.autoDebit = autoDebit;
    }

    public Long getAutoDebitAccountId() {
        return autoDebitAccountId;
    }

    public void setAutoDebitAccountId(Long autoDebitAccountId) {
        this.autoDebitAccountId = autoDebitAccountId;
    }
}
