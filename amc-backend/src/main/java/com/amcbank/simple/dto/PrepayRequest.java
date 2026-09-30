package com.amcbank.simple.dto;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class PrepayRequest {

    @NotNull(message = "Source account ID is required")
    private Long sourceAccountId;

    @NotNull(message = "Prepayment amount is required")
    @DecimalMin(value = "1000.00", message = "Minimum prepayment amount is ₹1,000.00")
    private BigDecimal prepaymentAmount;

    @NotBlank(message = "Mode is required (REDUCE_TENURE or REDUCE_EMI)")
    @Pattern(regexp = "REDUCE_TENURE|REDUCE_EMI", message = "Mode must be REDUCE_TENURE or REDUCE_EMI")
    private String mode;

    public PrepayRequest() {
    }

    public PrepayRequest(Long sourceAccountId, BigDecimal prepaymentAmount, String mode) {
        this.sourceAccountId = sourceAccountId;
        this.prepaymentAmount = prepaymentAmount;
        this.mode = mode;
    }

    public Long getSourceAccountId() {
        return sourceAccountId;
    }

    public void setSourceAccountId(Long sourceAccountId) {
        this.sourceAccountId = sourceAccountId;
    }

    public BigDecimal getPrepaymentAmount() {
        return prepaymentAmount;
    }

    public void setPrepaymentAmount(BigDecimal prepaymentAmount) {
        this.prepaymentAmount = prepaymentAmount;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }
}
