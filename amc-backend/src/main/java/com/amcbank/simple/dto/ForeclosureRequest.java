package com.amcbank.simple.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

public class ForeclosureRequest {

    @NotNull(message = "Source account ID is required")
    private Long sourceAccountId;

    @NotNull(message = "Confirmation is required")
    @AssertTrue(message = "Foreclosure must be explicitly confirmed")
    private Boolean confirmation;

    public ForeclosureRequest() {
    }

    public ForeclosureRequest(Long sourceAccountId, Boolean confirmation) {
        this.sourceAccountId = sourceAccountId;
        this.confirmation = confirmation;
    }

    public Long getSourceAccountId() {
        return sourceAccountId;
    }

    public void setSourceAccountId(Long sourceAccountId) {
        this.sourceAccountId = sourceAccountId;
    }

    public Boolean getConfirmation() {
        return confirmation;
    }

    public void setConfirmation(Boolean confirmation) {
        this.confirmation = confirmation;
    }
}
