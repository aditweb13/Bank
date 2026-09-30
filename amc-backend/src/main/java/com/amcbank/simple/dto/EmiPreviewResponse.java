package com.amcbank.simple.dto;

import java.math.BigDecimal;
import java.util.List;

public class EmiPreviewResponse {
    private BigDecimal emi;
    private BigDecimal totalInterest;
    private BigDecimal totalPayable;
    private List<InstallmentDto> schedule;

    public EmiPreviewResponse() {
    }

    public EmiPreviewResponse(BigDecimal emi, BigDecimal totalInterest, BigDecimal totalPayable, List<InstallmentDto> schedule) {
        this.emi = emi;
        this.totalInterest = totalInterest;
        this.totalPayable = totalPayable;
        this.schedule = schedule;
    }

    public BigDecimal getEmi() {
        return emi;
    }

    public void setEmi(BigDecimal emi) {
        this.emi = emi;
    }

    public BigDecimal getTotalInterest() {
        return totalInterest;
    }

    public void setTotalInterest(BigDecimal totalInterest) {
        this.totalInterest = totalInterest;
    }

    public BigDecimal getTotalPayable() {
        return totalPayable;
    }

    public void setTotalPayable(BigDecimal totalPayable) {
        this.totalPayable = totalPayable;
    }

    public List<InstallmentDto> getSchedule() {
        return schedule;
    }

    public void setSchedule(List<InstallmentDto> schedule) {
        this.schedule = schedule;
    }
}
