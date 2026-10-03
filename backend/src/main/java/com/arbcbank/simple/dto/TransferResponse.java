package com.arbcbank.simple.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Safe outbound representation of a Transfer — no raw balance data of the counterparty. */
public class TransferResponse {

    private Long id;
    private String referenceNo;
    private String idempotencyKey;

    // From-account info (caller's own, so full number is fine)
    private Long fromAccountId;
    private String fromAccountNumber;

    // To-account: mask the account number, show only masked holder name
    private Long toAccountId;
    private String toAccountNumberMasked;
    private String toAccountHolderNameMasked;

    private BigDecimal amount;
    private String remarks;
    private String status;
    private String failureReason;
    private LocalDateTime createdAt;

    public TransferResponse() {}

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    public Long getFromAccountId() { return fromAccountId; }
    public void setFromAccountId(Long fromAccountId) { this.fromAccountId = fromAccountId; }

    public String getFromAccountNumber() { return fromAccountNumber; }
    public void setFromAccountNumber(String fromAccountNumber) { this.fromAccountNumber = fromAccountNumber; }

    public Long getToAccountId() { return toAccountId; }
    public void setToAccountId(Long toAccountId) { this.toAccountId = toAccountId; }

    public String getToAccountNumberMasked() { return toAccountNumberMasked; }
    public void setToAccountNumberMasked(String toAccountNumberMasked) { this.toAccountNumberMasked = toAccountNumberMasked; }

    public String getToAccountHolderNameMasked() { return toAccountHolderNameMasked; }
    public void setToAccountHolderNameMasked(String toAccountHolderNameMasked) { this.toAccountHolderNameMasked = toAccountHolderNameMasked; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
