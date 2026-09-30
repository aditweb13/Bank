package com.amcbank.simple.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amcbank.simple.dto.AccountLookupResponse;
import com.amcbank.simple.dto.NewTransferRequest;
import com.amcbank.simple.dto.PagedResponse;
import com.amcbank.simple.dto.TransferResponse;
import com.amcbank.simple.exception.ResourceNotFoundException;
import com.amcbank.simple.model.*;
import com.amcbank.simple.repository.*;

@Service
public class TransferService {

    private final TransferRepository transferRepository;
    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;

    @Value("${amc.banking.transfer.per-transaction-limit:50000.00}")
    private BigDecimal perTransactionLimit;

    @Value("${amc.banking.transfer.daily-limit:200000.00}")
    private BigDecimal dailyLimit;

    public TransferService(TransferRepository transferRepository,
                           AccountRepository accountRepository,
                           CustomerRepository customerRepository,
                           TransactionRepository transactionRepository,
                           UserRepository userRepository,
                           NotificationRepository notificationRepository,
                           AuditLogRepository auditLogRepository) {
        this.transferRepository = transferRepository;
        this.accountRepository = accountRepository;
        this.customerRepository = customerRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Executes atomic fund transfer with idempotency, consistent-order pessimistic locking,
     * limit enforcement, double-entry ledger records, and audit/notifications.
     */
    @Transactional
    public TransferResponse executeTransfer(NewTransferRequest req, String authenticatedUsername) {
        // 1. Idempotency Check: if key already processed, return original transfer without re-executing
        Optional<Transfer> existingOpt = transferRepository.findByIdempotencyKey(req.getIdempotencyKey());
        if (existingOpt.isPresent()) {
            return toTransferResponse(existingOpt.get());
        }

        // 2. Validate Amount
        if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Transfer amount must be greater than zero");
        }
        BigDecimal amount = req.getAmount().setScale(2, RoundingMode.HALF_UP);

        // 3. Per-Transaction Limit Check
        if (amount.compareTo(perTransactionLimit) > 0) {
            throw new IllegalArgumentException("Transfer amount of ₹" + amount + " exceeds maximum per-transaction limit of ₹" + perTransactionLimit);
        }

        // 4. Authenticate caller customer & check ownership
        Customer customer = getCustomerForUsername(authenticatedUsername);

        Account fromAcctRaw = accountRepository.findById(req.getFromAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Source account not found"));

        if (!fromAcctRaw.getCustomer().getId().equals(customer.getId())) {
            throw new SecurityException("Unauthorized: source account does not belong to you");
        }
        if (!"ACTIVE".equalsIgnoreCase(fromAcctRaw.getStatus())) {
            throw new IllegalStateException("Source account is " + fromAcctRaw.getStatus() + "; transfers are not permitted");
        }

        // 5. Destination Account Check
        Account toAcctRaw = accountRepository.findByAccountNumber(req.getToAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException("Destination account number not found"));

        if (!"ACTIVE".equalsIgnoreCase(toAcctRaw.getStatus())) {
            throw new IllegalStateException("Destination account is " + toAcctRaw.getStatus() + "; cannot receive transfers");
        }

        if (fromAcctRaw.getId().equals(toAcctRaw.getId())) {
            throw new IllegalArgumentException("Source and destination cannot be the same account");
        }

        // 6. Daily Limit Check (sum of completed transfers from source today)
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        BigDecimal dailySum = transferRepository.sumSuccessfulOutboundSince(fromAcctRaw.getId(), startOfDay);
        if (dailySum == null) {
            dailySum = BigDecimal.ZERO;
        }
        if (dailySum.add(amount).compareTo(dailyLimit) > 0) {
            throw new IllegalArgumentException("Daily transfer limit of ₹" + dailyLimit + " exceeded. Already transferred today: ₹" + dailySum);
        }

        // 7. Deadlock-free Pessimistic Locking: Lock accounts in consistent order (lower ID first)
        Long firstId = Math.min(fromAcctRaw.getId(), toAcctRaw.getId());
        Long secondId = Math.max(fromAcctRaw.getId(), toAcctRaw.getId());

        Account firstLocked = accountRepository.findByIdForUpdate(firstId)
                .orElseThrow(() -> new ResourceNotFoundException("Account lock failed"));
        Account secondLocked = accountRepository.findByIdForUpdate(secondId)
                .orElseThrow(() -> new ResourceNotFoundException("Account lock failed"));

        Account source = fromAcctRaw.getId().equals(firstLocked.getId()) ? firstLocked : secondLocked;
        Account target = toAcctRaw.getId().equals(firstLocked.getId()) ? firstLocked : secondLocked;

        // 8. Minimum Balance & Sufficiency Check
        BigDecimal minBalance = source.getMinimumBalance() != null ? source.getMinimumBalance() : BigDecimal.ZERO;
        BigDecimal balanceAfterDebit = source.getBalance().subtract(amount);
        if (balanceAfterDebit.compareTo(minBalance) < 0) {
            throw new IllegalArgumentException("Insufficient funds. Transfer would violate the minimum balance of ₹" + minBalance + ". Available: ₹" + source.getBalance());
        }

        // 9. Balance Mutation
        source.setBalance(balanceAfterDebit);
        target.setBalance(target.getBalance().add(amount));
        accountRepository.save(source);
        accountRepository.save(target);

        // 10. Generate Shared Reference Number
        String referenceNo = "TRF" + System.currentTimeMillis() + (int) (1000 + Math.random() * 9000);

        // 11. Write TWO Ledger Entries linked by the same referenceNo
        String cleanRemarks = (req.getRemarks() != null && !req.getRemarks().isBlank())
                ? req.getRemarks().trim()
                : "Funds Transfer";

        String debitDesc = "Transfer to " + maskAccountNumber(target.getAccountNumber()) + " - " + cleanRemarks;
        Transaction debitTxn = new Transaction(
                referenceNo,
                source,
                target,
                "TRANSFER_DEBIT",
                amount,
                source.getBalance(),
                debitDesc
        );
        transactionRepository.save(debitTxn);

        String creditDesc = "Transfer from " + maskAccountNumber(source.getAccountNumber()) + " - " + cleanRemarks;
        Transaction creditTxn = new Transaction(
                referenceNo,
                target,
                source,
                "TRANSFER_CREDIT",
                amount,
                target.getBalance(),
                creditDesc
        );
        transactionRepository.save(creditTxn);

        // 12. Persist Transfer Entity
        Transfer transfer = new Transfer();
        transfer.setIdempotencyKey(req.getIdempotencyKey());
        transfer.setReferenceNo(referenceNo);
        transfer.setFromAccount(source);
        transfer.setToAccount(target);
        transfer.setAmount(amount);
        transfer.setRemarks(req.getRemarks());
        transfer.setStatus("SUCCESS");
        transfer.setCreatedAt(LocalDateTime.now());
        Transfer savedTransfer = transferRepository.save(transfer);

        // 13. Audit Trail & In-App Notifications
        logAudit(authenticatedUsername, "ROLE_CUSTOMER", "FUND_TRANSFER",
                "Ref: " + referenceNo, "Transferred ₹" + amount + " from " + source.getAccountNumber() + " to " + target.getAccountNumber());

        sendNotificationToCustomer(customer, "Transfer Successful",
                "Transferred ₹" + amount + " to account " + maskAccountNumber(target.getAccountNumber()) + ". Ref: " + referenceNo, "TRANSACTION");

        if (target.getCustomer() != null && !target.getCustomer().getId().equals(customer.getId())) {
            sendNotificationToCustomer(target.getCustomer(), "Funds Received",
                    "Received ₹" + amount + " in account " + maskAccountNumber(target.getAccountNumber()) + " from " + maskName(customer.getName()) + ". Ref: " + referenceNo, "TRANSACTION");
        }

        return toTransferResponse(savedTransfer);
    }

    /**
     * Customer transfer history (paginated, optional account and status filters).
     */
    @Transactional(readOnly = true)
    public PagedResponse<TransferResponse> getCustomerTransfers(String username, int page, int size, Long accountId, String status) {
        Customer customer = getCustomerForUsername(username);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));

        Page<Transfer> pageResult;
        if (accountId != null) {
            // Verify caller owns accountId
            Account account = accountRepository.findById(accountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
            if (!account.getCustomer().getId().equals(customer.getId())) {
                throw new SecurityException("Unauthorized: account does not belong to you");
            }
            pageResult = transferRepository.findByAccountId(accountId, pageable);
        } else {
            pageResult = transferRepository.findByCustomerId(customer.getId(), pageable);
        }

        return new PagedResponse<>(
                pageResult.getContent().stream().map(this::toTransferResponse).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isLast()
        );
    }

    /**
     * Transfer receipt details by ID (ensures customer is party to the transfer).
     */
    @Transactional(readOnly = true)
    public TransferResponse getTransferDetails(Long id, String username) {
        Customer customer = getCustomerForUsername(username);
        Transfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found with ID: " + id));

        boolean isSender = transfer.getFromAccount().getCustomer().getId().equals(customer.getId());
        boolean isReceiver = transfer.getToAccount().getCustomer() != null &&
                transfer.getToAccount().getCustomer().getId().equals(customer.getId());

        if (!isSender && !isReceiver) {
            throw new SecurityException("Unauthorized: you do not have access to this transfer");
        }

        return toTransferResponse(transfer);
    }

    /**
     * Admin: all transfers paginated.
     */
    @Transactional(readOnly = true)
    public PagedResponse<TransferResponse> getAllTransfers(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        Page<Transfer> pageResult = transferRepository.findAllByOrderByCreatedAtDesc(pageable);
        return new PagedResponse<>(
                pageResult.getContent().stream().map(this::toTransferResponse).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isLast()
        );
    }

    /**
     * Account lookup for destination account validation — returns ONLY masked name & masked number.
     * Never reveals balance or sensitive details.
     */
    @Transactional(readOnly = true)
    public AccountLookupResponse lookupAccount(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) {
            throw new IllegalArgumentException("Account number is required");
        }
        Account account = accountRepository.findByAccountNumber(accountNumber.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with number: " + accountNumber));

        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalStateException("Account is not active (" + account.getStatus() + ")");
        }

        String holderName = (account.getCustomer() != null && account.getCustomer().getName() != null)
                ? account.getCustomer().getName()
                : "Account Holder";

        return new AccountLookupResponse(
                account.getAccountNumber(),
                maskAccountNumber(account.getAccountNumber()),
                maskName(holderName)
        );
    }

    // ── Helper Mappings & Utilities ──

    public TransferResponse toTransferResponse(Transfer t) {
        TransferResponse res = new TransferResponse();
        res.setId(t.getId());
        res.setReferenceNo(t.getReferenceNo());
        res.setIdempotencyKey(t.getIdempotencyKey());

        if (t.getFromAccount() != null) {
            res.setFromAccountId(t.getFromAccount().getId());
            res.setFromAccountNumber(t.getFromAccount().getAccountNumber());
        }

        if (t.getToAccount() != null) {
            res.setToAccountId(t.getToAccount().getId());
            res.setToAccountNumberMasked(maskAccountNumber(t.getToAccount().getAccountNumber()));
            if (t.getToAccount().getCustomer() != null) {
                res.setToAccountHolderNameMasked(maskName(t.getToAccount().getCustomer().getName()));
            } else {
                res.setToAccountHolderNameMasked("Account Holder");
            }
        }

        res.setAmount(t.getAmount());
        res.setRemarks(t.getRemarks());
        res.setStatus(t.getStatus());
        res.setFailureReason(t.getFailureReason());
        res.setCreatedAt(t.getCreatedAt());
        return res;
    }

    public static String maskAccountNumber(String acct) {
        if (acct == null || acct.length() < 4) return acct;
        return "••••" + acct.substring(acct.length() - 4);
    }

    public static String maskName(String name) {
        if (name == null || name.isBlank()) return "Unknown";
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i];
            if (p.length() <= 1) {
                sb.append(p);
            } else {
                sb.append(p.charAt(0)).append("*".repeat(Math.max(1, p.length() - 1)));
            }
            if (i < parts.length - 1) sb.append(" ");
        }
        return sb.toString();
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
