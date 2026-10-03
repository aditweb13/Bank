package com.arbcbank.simple.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.arbcbank.simple.dto.CreateDepositRequest;
import com.arbcbank.simple.dto.DepositRequestResponse;
import com.arbcbank.simple.dto.PagedResponse;
import com.arbcbank.simple.dto.ReconciliationResponse;
import com.arbcbank.simple.exception.ResourceNotFoundException;
import com.arbcbank.simple.model.*;
import com.arbcbank.simple.repository.*;

@Service
public class DepositService {

    private final DepositRequestRepository depositRequestRepository;
    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;

    @Value("${amc.banking.deposit.min-amount:100.00}")
    private BigDecimal minDepositAmount;

    @Value("${amc.banking.deposit.max-amount:10000000.00}")
    private BigDecimal maxDepositAmount;

    @Value("${amc.banking.deposit.large-deposit-threshold:1000000.00}")
    private BigDecimal largeDepositThreshold;

    @Value("${amc.banking.deposit.separation-of-duties:true}")
    private boolean separationOfDuties;

    public DepositService(DepositRequestRepository depositRequestRepository,
                          AccountRepository accountRepository,
                          CustomerRepository customerRepository,
                          TransactionRepository transactionRepository,
                          UserRepository userRepository,
                          NotificationRepository notificationRepository,
                          AuditLogRepository auditLogRepository) {
        this.depositRequestRepository = depositRequestRepository;
        this.accountRepository = accountRepository;
        this.customerRepository = customerRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Customer (or admin on behalf) creates a deposit request.
     * Balance does NOT change at this point.
     */
    @Transactional
    public DepositRequestResponse createDepositRequest(CreateDepositRequest req, String authenticatedUsername, boolean isAdmin) {
        if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be greater than zero");
        }
        BigDecimal amount = req.getAmount().setScale(2, RoundingMode.HALF_UP);

        if (amount.compareTo(minDepositAmount) < 0) {
            throw new IllegalArgumentException("Deposit amount ₹" + amount + " is below minimum allowed deposit of ₹" + minDepositAmount);
        }
        if (amount.compareTo(maxDepositAmount) > 0) {
            throw new IllegalArgumentException("Deposit amount ₹" + amount + " exceeds maximum allowed deposit of ₹" + maxDepositAmount);
        }

        Account account = accountRepository.findById(req.getAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with ID: " + req.getAccountId()));

        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalStateException("Account is not active (" + account.getStatus() + ")");
        }

        Customer customer = account.getCustomer();
        if (customer == null) {
            throw new ResourceNotFoundException("No customer linked to account " + account.getAccountNumber());
        }

        if (!isAdmin) {
            // Must belong to caller customer
            Customer callerCust = getCustomerForUsername(authenticatedUsername);
            if (!customer.getId().equals(callerCust.getId())) {
                throw new SecurityException("Unauthorized: account does not belong to you");
            }
        }

        String refNo = "DEP" + System.currentTimeMillis() + (int) (1000 + Math.random() * 9000);

        DepositRequest dr = new DepositRequest();
        dr.setReferenceNo(refNo);
        dr.setAccount(account);
        dr.setCustomer(customer);
        dr.setAmount(amount);
        dr.setMode(req.getMode() != null ? req.getMode().toUpperCase() : "CASH");
        dr.setPaymentReference(req.getPaymentReference());
        dr.setRemarks(req.getRemarks());
        dr.setStatus("PENDING");
        dr.setRequestedAt(LocalDateTime.now());
        if (isAdmin) {
            dr.setRequestedByAdmin(authenticatedUsername);
        }
        dr.setFlaggedLarge(amount.compareTo(largeDepositThreshold) >= 0);

        DepositRequest saved = depositRequestRepository.save(dr);

        logAudit(authenticatedUsername, isAdmin ? "ROLE_ADMIN" : "ROLE_CUSTOMER",
                "CREATE_DEPOSIT_REQUEST", "Ref: " + refNo, "Requested deposit of ₹" + amount + " into " + account.getAccountNumber());

        sendNotificationToCustomer(customer, "Deposit Request Submitted",
                "Your deposit request of ₹" + amount + " (" + dr.getMode() + ") is submitted and pending bank approval. Ref: " + refNo, "TRANSACTION");

        return toResponse(saved);
    }

    /**
     * Admin approves deposit request.
     * Executes in one @Transactional method with double-approval guard,
     * revalidates account status, credits balance, creates DEPOSIT ledger transaction, and notifies customer.
     */
    @Transactional
    public DepositRequestResponse approveDepositRequest(Long id, String adminUsername, String reviewRemarks) {
        DepositRequest dr = depositRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deposit request not found with ID: " + id));

        if (!"PENDING".equalsIgnoreCase(dr.getStatus())) {
            throw new IllegalStateException("Deposit request has already been processed (Current status: " + dr.getStatus() + ")");
        }

        // Separation of duties rule: if an admin created this request, a different admin must approve it
        if (separationOfDuties && dr.getRequestedByAdmin() != null &&
                dr.getRequestedByAdmin().equalsIgnoreCase(adminUsername)) {
            throw new SecurityException("Separation of duties violation: maker admin cannot approve their own deposit request");
        }

        // Lock account and verify ACTIVE
        Account account = accountRepository.findByIdForUpdate(dr.getAccount().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with ID: " + dr.getAccount().getId()));

        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalStateException("Cannot credit funds: Account is " + account.getStatus());
        }

        // Credit balance
        BigDecimal amount = dr.getAmount();
        BigDecimal newBalance = account.getBalance().add(amount);
        account.setBalance(newBalance);
        accountRepository.save(account);

        // Ledger Entry
        String desc = "Deposit Approved: " + dr.getMode() + (dr.getPaymentReference() != null ? " Ref: " + dr.getPaymentReference() : "")
                + " (Request Ref: " + dr.getReferenceNo() + ")";
        Transaction depositTxn = new Transaction(
                dr.getReferenceNo(),
                account,
                null,
                "DEPOSIT",
                amount,
                newBalance,
                desc
        );
        transactionRepository.save(depositTxn);

        // Update Request
        dr.setStatus("APPROVED");
        dr.setReviewedBy(adminUsername);
        dr.setReviewedAt(LocalDateTime.now());
        dr.setReviewRemarks(reviewRemarks != null && !reviewRemarks.isBlank() ? reviewRemarks.trim() : "Approved by Bank Admin");
        DepositRequest approved = depositRequestRepository.save(dr);

        // Audit & Notification
        logAudit(adminUsername, "ROLE_ADMIN", "APPROVE_DEPOSIT", "Ref: " + dr.getReferenceNo(),
                "Approved deposit of ₹" + amount + " to account " + account.getAccountNumber());

        sendNotificationToCustomer(dr.getCustomer(), "Deposit Approved & Credited",
                "Your deposit of ₹" + amount + " has been approved and credited to account " + TransferService.maskAccountNumber(account.getAccountNumber()) + ". Balance: ₹" + newBalance,
                "TRANSACTION");

        return toResponse(approved);
    }

    /**
     * Admin rejects deposit request with mandatory reason.
     * No balance changes.
     */
    @Transactional
    public DepositRequestResponse rejectDepositRequest(Long id, String adminUsername, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Rejection reason is mandatory");
        }

        DepositRequest dr = depositRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deposit request not found with ID: " + id));

        if (!"PENDING".equalsIgnoreCase(dr.getStatus())) {
            throw new IllegalStateException("Deposit request has already been processed (Current status: " + dr.getStatus() + ")");
        }

        dr.setStatus("REJECTED");
        dr.setReviewedBy(adminUsername);
        dr.setReviewedAt(LocalDateTime.now());
        dr.setReviewRemarks(reason.trim());
        DepositRequest rejected = depositRequestRepository.save(dr);

        logAudit(adminUsername, "ROLE_ADMIN", "REJECT_DEPOSIT", "Ref: " + dr.getReferenceNo(),
                "Rejected deposit of ₹" + dr.getAmount() + " for account " + dr.getAccount().getAccountNumber() + ". Reason: " + reason);

        sendNotificationToCustomer(dr.getCustomer(), "Deposit Request Rejected",
                "Your deposit request of ₹" + dr.getAmount() + " was rejected. Reason: " + reason.trim(),
                "TRANSACTION");

        return toResponse(rejected);
    }

    /**
     * Customer cancels their own pending deposit request.
     */
    @Transactional
    public DepositRequestResponse cancelDepositRequest(Long id, String username) {
        Customer customer = getCustomerForUsername(username);

        DepositRequest dr = depositRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deposit request not found with ID: " + id));

        if (!dr.getCustomer().getId().equals(customer.getId())) {
            throw new SecurityException("Unauthorized: deposit request does not belong to you");
        }

        if (!"PENDING".equalsIgnoreCase(dr.getStatus())) {
            throw new IllegalStateException("Only PENDING deposit requests can be cancelled. Current status: " + dr.getStatus());
        }

        dr.setStatus("CANCELLED");
        dr.setReviewRemarks("Cancelled by customer");
        dr.setReviewedAt(LocalDateTime.now());
        DepositRequest cancelled = depositRequestRepository.save(dr);

        logAudit(username, "ROLE_CUSTOMER", "CANCEL_DEPOSIT_REQUEST", "Ref: " + dr.getReferenceNo(),
                "Cancelled deposit request of ₹" + dr.getAmount());

        return toResponse(cancelled);
    }

    /**
     * Customer: paginated list of own deposit requests.
     */
    @Transactional(readOnly = true)
    public PagedResponse<DepositRequestResponse> getCustomerDepositRequests(String username, int page, int size, String status) {
        Customer customer = getCustomerForUsername(username);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));

        Page<DepositRequest> pageResult;
        if (status != null && !status.isBlank()) {
            pageResult = depositRequestRepository.findByCustomerIdAndStatusOrderByRequestedAtDesc(
                    customer.getId(), status.trim().toUpperCase(), pageable);
        } else {
            pageResult = depositRequestRepository.findByCustomerIdOrderByRequestedAtDesc(customer.getId(), pageable);
        }

        return new PagedResponse<>(
                pageResult.getContent().stream().map(this::toResponse).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isLast()
        );
    }

    /**
     * Admin: paginated list of deposit requests with filters.
     */
    @Transactional(readOnly = true)
    public PagedResponse<DepositRequestResponse> getAllDepositRequests(int page, int size, String status, String search) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));

        Page<DepositRequest> pageResult;
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
                ? status.trim().toUpperCase() : null;

        if (search != null && !search.isBlank()) {
            pageResult = depositRequestRepository.searchByStatusAndKeyword(cleanStatus, search.trim(), pageable);
        } else if (cleanStatus != null) {
            pageResult = depositRequestRepository.findByStatusOrderByRequestedAtDesc(cleanStatus, pageable);
        } else {
            pageResult = depositRequestRepository.findAllByOrderByRequestedAtDesc(pageable);
        }

        return new PagedResponse<>(
                pageResult.getContent().stream().map(this::toResponse).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isLast()
        );
    }

    /**
     * Single request detail.
     */
    @Transactional(readOnly = true)
    public DepositRequestResponse getDepositRequestById(Long id) {
        DepositRequest dr = depositRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Deposit request not found with ID: " + id));
        return toResponse(dr);
    }

    /**
     * Count pending requests for Admin KPI tile.
     */
    @Transactional(readOnly = true)
    public long countPending() {
        return depositRequestRepository.countByStatus("PENDING");
    }

    /**
     * Ledger reconciliation check:
     * Computes sum of credit transactions minus debit transactions and compares to account balance.
     */
    @Transactional(readOnly = true)
    public ReconciliationResponse reconcileAccount(Long accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with ID: " + accountId));

        List<Transaction> transactions = transactionRepository.findByAccountIdOrderByTimestampDesc(accountId);

        BigDecimal calculatedLedger = BigDecimal.ZERO;
        for (Transaction t : transactions) {
            String type = t.getTransactionType();
            // Credits add money; debits subtract money
            if ("DEPOSIT".equalsIgnoreCase(type) ||
                "TRANSFER_CREDIT".equalsIgnoreCase(type) ||
                "TRANSFER_IN".equalsIgnoreCase(type) ||
                "INTEREST_CREDIT".equalsIgnoreCase(type)) {
                calculatedLedger = calculatedLedger.add(t.getAmount());
            } else if ("WITHDRAWAL".equalsIgnoreCase(type) ||
                       "TRANSFER_DEBIT".equalsIgnoreCase(type) ||
                       "TRANSFER_OUT".equalsIgnoreCase(type) ||
                       "EMI_PAYMENT".equalsIgnoreCase(type) ||
                       "FD_DEPOSIT".equalsIgnoreCase(type) ||
                       "RD_DEPOSIT".equalsIgnoreCase(type)) {
                calculatedLedger = calculatedLedger.subtract(t.getAmount());
            }
        }

        BigDecimal diff = account.getBalance().subtract(calculatedLedger).abs();
        boolean reconciled = diff.compareTo(new BigDecimal("0.01")) < 0;

        ReconciliationResponse res = new ReconciliationResponse();
        res.setAccountId(account.getId());
        res.setAccountNumber(account.getAccountNumber());
        res.setAccountBalance(account.getBalance());
        res.setCalculatedLedgerBalance(calculatedLedger);
        res.setDifference(diff);
        res.setReconciled(reconciled);
        res.setTotalLedgerEntries(transactions.size());
        res.setMessage(reconciled
                ? "Account balance perfectly reconciles with ledger entries."
                : "Discrepancy detected: account balance differs from net ledger transactions by ₹" + diff);

        return res;
    }

    // ── Helper Mappings ──

    public DepositRequestResponse toResponse(DepositRequest dr) {
        DepositRequestResponse res = new DepositRequestResponse();
        res.setId(dr.getId());
        res.setReferenceNo(dr.getReferenceNo());
        if (dr.getAccount() != null) {
            res.setAccountId(dr.getAccount().getId());
            res.setAccountNumberMasked(TransferService.maskAccountNumber(dr.getAccount().getAccountNumber()));
        }
        if (dr.getCustomer() != null) {
            res.setCustomerId(dr.getCustomer().getId());
            res.setCustomerNameMasked(TransferService.maskName(dr.getCustomer().getName()));
        }
        res.setAmount(dr.getAmount());
        res.setMode(dr.getMode());
        res.setPaymentReference(dr.getPaymentReference());
        res.setRemarks(dr.getRemarks());
        res.setStatus(dr.getStatus());
        res.setRequestedByAdmin(dr.getRequestedByAdmin());
        res.setRequestedAt(dr.getRequestedAt());
        res.setReviewedBy(dr.getReviewedBy());
        res.setReviewedAt(dr.getReviewedAt());
        res.setReviewRemarks(dr.getReviewRemarks());
        res.setLargeDeposit(dr.isFlaggedLarge());
        return res;
    }

    private Customer getCustomerForUsername(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found for username: " + username));
        if (user.getCustomer() == null) {
            throw new SecurityException("No customer profile linked to username: " + username);
        }
        return user.getCustomer();
    }

    private void logAudit(String username, String role, String action, String resource, String details) {
        try {
            AuditLog log = new AuditLog(username, role, action, resource, details, "127.0.0.1");
            auditLogRepository.save(log);
        } catch (Exception ignored) {}
    }

    private void sendNotificationToCustomer(Customer customer, String title, String message, String type) {
        try {
            userRepository.findByCustomerId(customer.getId()).ifPresent(user -> {
                Notification notif = new Notification(user, title, message, type);
                notificationRepository.save(notif);
            });
        } catch (Exception ignored) {}
    }
}
