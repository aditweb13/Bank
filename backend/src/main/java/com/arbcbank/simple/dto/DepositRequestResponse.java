package com.arbcbank.simple.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class DepositRequestResponse {

    private Long id;
    private String referenceNo;
    private Long accountId;
    private String accountNumberMasked;
    private Long customerId;
    private String customerNameMasked;
    private BigDecimal amount;
    private String mode;
    private String paymentReference;
    private String remarks;
    private String status;
    private String requestedByAdmin;
    private LocalDateTime requestedAt;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private String reviewRemarks;
    private boolean largeDeposit;

    public DepositRequestResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }

    public String getAccountNumberMasked() { return accountNumberMasked; }
    public void setAccountNumberMasked(String accountNumberMasked) { this.accountNumberMasked = accountNumberMasked; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public String getCustomerNameMasked() { return customerNameMasked; }
    public void setCustomerNameMasked(String customerNameMasked) { this.customerNameMasked = customerNameMasked; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRequestedByAdmin() { return requestedByAdmin; }
    public void setRequestedByAdmin(String requestedByAdmin) { this.requestedByAdmin = requestedByAdmin; }

    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }

    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewRemarks() { return reviewRemarks; }
    public void setReviewRemarks(String reviewRemarks) { this.reviewRemarks = reviewRemarks; }

    public boolean isLargeDeposit() { return largeDeposit; }
    public void setLargeDeposit(boolean largeDeposit) { this.largeDeposit = largeDeposit; }
}
