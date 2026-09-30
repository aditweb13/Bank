package com.amcbank.simple.dto;

import java.math.BigDecimal;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public class RepayRequest {

    @NotNull(message = "Source account ID is required")
    private Long sourceAccountId;

    @Positive(message = "Repayment amount must be positive if specified")
    private BigDecimal amount; // null means pay exact installment total due

    private String idempotencyKey;

    public RepayRequest() {
    }

    public RepayRequest(Long sourceAccountId, BigDecimal amount) {
        this.sourceAccountId = sourceAccountId;
        this.amount = amount;
    }

    public Long getSourceAccountId() {
        return sourceAccountId;
    }

    public void setSourceAccountId(Long sourceAccountId) {
        this.sourceAccountId = sourceAccountId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }
}
