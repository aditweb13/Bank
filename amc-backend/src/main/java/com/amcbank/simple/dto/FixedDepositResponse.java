package com.amcbank.simple.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class FixedDepositResponse {
    private Long id;
    private String depositNumber;
    private Long customerId;
    private String customerName;
    private Long sourceAccountId;
    private String sourceAccountNumber;
    private BigDecimal principalAmount;
    private double interestRate;
    private int tenureMonths;
    private BigDecimal maturityAmount;
    private LocalDate startDate;
    private LocalDate maturityDate;
    private String status;
    private BigDecimal prematurePayout;
    private LocalDateTime createdAt;

    public FixedDepositResponse() {}

    public FixedDepositResponse(Long id, String depositNumber, Long customerId, String customerName,
                                Long sourceAccountId, String sourceAccountNumber, BigDecimal principalAmount,
                                double interestRate, int tenureMonths, BigDecimal maturityAmount,
                                LocalDate startDate, LocalDate maturityDate, String status,
                                BigDecimal prematurePayout, LocalDateTime createdAt) {
        this.id = id;
        this.depositNumber = depositNumber;
        this.customerId = customerId;
        this.customerName = customerName;
        this.sourceAccountId = sourceAccountId;
        this.sourceAccountNumber = sourceAccountNumber;
        this.principalAmount = principalAmount;
        this.interestRate = interestRate;
        this.tenureMonths = tenureMonths;
        this.maturityAmount = maturityAmount;
        this.startDate = startDate;
        this.maturityDate = maturityDate;
        this.status = status;
        this.prematurePayout = prematurePayout;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDepositNumber() { return depositNumber; }
    public void setDepositNumber(String depositNumber) { this.depositNumber = depositNumber; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public Long getSourceAccountId() { return sourceAccountId; }
    public void setSourceAccountId(Long sourceAccountId) { this.sourceAccountId = sourceAccountId; }

    public String getSourceAccountNumber() { return sourceAccountNumber; }
    public void setSourceAccountNumber(String sourceAccountNumber) { this.sourceAccountNumber = sourceAccountNumber; }

    public BigDecimal getPrincipalAmount() { return principalAmount; }
    public void setPrincipalAmount(BigDecimal principalAmount) { this.principalAmount = principalAmount; }

    public double getInterestRate() { return interestRate; }
    public void setInterestRate(double interestRate) { this.interestRate = interestRate; }

    public int getTenureMonths() { return tenureMonths; }
    public void setTenureMonths(int tenureMonths) { this.tenureMonths = tenureMonths; }

    public BigDecimal getMaturityAmount() { return maturityAmount; }
    public void setMaturityAmount(BigDecimal maturityAmount) { this.maturityAmount = maturityAmount; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getMaturityDate() { return maturityDate; }
    public void setMaturityDate(LocalDate maturityDate) { this.maturityDate = maturityDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getPrematurePayout() { return prematurePayout; }
    public void setPrematurePayout(BigDecimal prematurePayout) { this.prematurePayout = prematurePayout; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
