package com.arbcbank.simple.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RejectDepositRequest {

    @NotBlank(message = "Rejection reason is mandatory")
    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    private String reason;

    public RejectDepositRequest() {}

    public RejectDepositRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
