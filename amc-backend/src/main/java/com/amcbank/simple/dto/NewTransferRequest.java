package com.amcbank.simple.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Inbound DTO for POST /api/customer/transfers.
 * Uses fromAccountId (owned by caller) + toAccountNumber (destination).
 */
public class NewTransferRequest {

    @NotNull(message = "Source account ID is required")
    private Long fromAccountId;

    @NotBlank(message = "Destination account number is required")
    @Pattern(regexp = "^[A-Za-z0-9]{10,20}$",
             message = "Destination account number must be 10-20 alphanumeric characters")
    private String toAccountNumber;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.00", message = "Transfer amount must be at least ₹1.00")
    private BigDecimal amount;

    @Size(max = 255, message = "Remarks must be at most 255 characters")
    private String remarks;

    /** Client-generated UUID to prevent duplicate submissions */
    @NotBlank(message = "Idempotency key is required")
    @Pattern(regexp = "^[0-9a-fA-F\\-]{36}$", message = "Idempotency key must be a valid UUID")
    private String idempotencyKey;

    public NewTransferRequest() {}

    public Long getFromAccountId() { return fromAccountId; }
    public void setFromAccountId(Long fromAccountId) { this.fromAccountId = fromAccountId; }

    public String getToAccountNumber() { return toAccountNumber; }
    public void setToAccountNumber(String toAccountNumber) { this.toAccountNumber = toAccountNumber; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
}
