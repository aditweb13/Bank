package com.amcbank.simple.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "deposit_requests")
public class DepositRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reference_no", nullable = false, unique = true, length = 30)
    private String referenceNo;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** CASH | CHEQUE | ONLINE | NEFT | RTGS */
    @Column(nullable = false, length = 20)
    private String mode = "CASH";

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    @Column(length = 255)
    private String remarks;

    /** PENDING | APPROVED | REJECTED | CANCELLED */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    /** Non-null → an admin created this request on behalf of the customer */
    @Column(name = "requested_by_admin", length = 100)
    private String requestedByAdmin;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private LocalDateTime requestedAt = LocalDateTime.now();

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_remarks", columnDefinition = "TEXT")
    private String reviewRemarks;

    /** Flagged when amount exceeds large-deposit threshold */
    @Column(name = "flagged_large", nullable = false)
    private boolean flaggedLarge = false;

    @Version
    private Long version;

    public DepositRequest() {}

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReferenceNo() { return referenceNo; }
    public void setReferenceNo(String referenceNo) { this.referenceNo = referenceNo; }

    public Account getAccount() { return account; }
    public void setAccount(Account account) { this.account = account; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

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

    public boolean isFlaggedLarge() { return flaggedLarge; }
    public void setFlaggedLarge(boolean flaggedLarge) { this.flaggedLarge = flaggedLarge; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
