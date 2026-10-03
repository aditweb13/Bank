package com.arbcbank.simple.model;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;

@Entity
@Table(name = "loans")
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String type; // HOME, CAR, PERSONAL

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal;

    @Column(name = "outstanding_principal", precision = 15, scale = 2)
    private BigDecimal outstandingPrincipal;

    @Column(name = "interest_rate", nullable = false)
    private double interestRate;

    @Column(name = "tenure_months", nullable = false)
    private int tenureMonths;

    @Column(precision = 15, scale = 2)
    private BigDecimal emi;

    @Column(nullable = false)
    private String status = "APPLIED"; // APPLIED, APPROVED, REJECTED, ACTIVE, CLOSED

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_id", nullable = false)
    @JsonIgnore
    private Customer customer;

    @Column(name = "applied_at", nullable = false, updatable = false)
    private LocalDateTime appliedAt = LocalDateTime.now();

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "disbursed_at")
    private LocalDateTime disbursedAt;

    @Column(name = "auto_debit")
    private Boolean autoDebit = false;

    @Column(name = "auto_debit_account_id")
    private Long autoDebitAccountId;

    @Column(name = "foreclosure_date")
    private LocalDateTime foreclosureDate;

    @Column(name = "foreclosure_amount", precision = 15, scale = 2)
    private BigDecimal foreclosureAmount;

    @Version
    private Long version;

    public Loan() {
    }

    public void calculateEmi() {
        if (principal == null || tenureMonths <= 0) {
            emi = BigDecimal.ZERO;
            return;
        }

        if (interestRate == 0) {
            emi = principal.divide(BigDecimal.valueOf(tenureMonths), 2, RoundingMode.HALF_UP);
            if (outstandingPrincipal == null) {
                outstandingPrincipal = principal;
            }
            return;
        }

        // r = annual rate / 12 / 100
        BigDecimal monthlyRate = BigDecimal.valueOf(interestRate)
                .divide(BigDecimal.valueOf(1200), 10, RoundingMode.HALF_UP);

        // (1 + r)^n
        BigDecimal onePlusRPowN = BigDecimal.valueOf(Math.pow(1.0 + monthlyRate.doubleValue(), tenureMonths));

        // numerator = P * r * (1+r)^n
        BigDecimal numerator = principal.multiply(monthlyRate).multiply(onePlusRPowN);

        // denominator = (1+r)^n - 1
        BigDecimal denominator = onePlusRPowN.subtract(BigDecimal.ONE);

        if (denominator.compareTo(BigDecimal.ZERO) == 0) {
            emi = principal.divide(BigDecimal.valueOf(tenureMonths), 2, RoundingMode.HALF_UP);
        } else {
            emi = numerator.divide(denominator, 2, RoundingMode.HALF_UP);
        }

        if (outstandingPrincipal == null) {
            outstandingPrincipal = principal;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public BigDecimal getPrincipal() {
        return principal;
    }

    public void setPrincipal(BigDecimal principal) {
        this.principal = principal;
        if (this.outstandingPrincipal == null) {
            this.outstandingPrincipal = principal;
        }
    }

    public BigDecimal getOutstandingPrincipal() {
        return outstandingPrincipal != null ? outstandingPrincipal : principal;
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

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public LocalDateTime getAppliedAt() {
        return appliedAt;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public LocalDateTime getDisbursedAt() {
        return disbursedAt;
    }

    public void setDisbursedAt(LocalDateTime disbursedAt) {
        this.disbursedAt = disbursedAt;
    }

    public Boolean getAutoDebit() {
        return autoDebit != null && autoDebit;
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

    public LocalDateTime getForeclosureDate() {
        return foreclosureDate;
    }

    public void setForeclosureDate(LocalDateTime foreclosureDate) {
        this.foreclosureDate = foreclosureDate;
    }

    public BigDecimal getForeclosureAmount() {
        return foreclosureAmount;
    }

    public void setForeclosureAmount(BigDecimal foreclosureAmount) {
        this.foreclosureAmount = foreclosureAmount;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public Long getCustomerId() {
        return customer == null ? null : customer.getId();
    }

    public String getCustomerName() {
        return customer == null ? null : customer.getName();
    }
}
