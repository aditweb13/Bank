package com.arbcbank.simple.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.arbcbank.simple.dto.*;
import com.arbcbank.simple.model.*;
import com.arbcbank.simple.repository.*;

@Service
public class LoanService {

    private final LoanRepository loanRepository;
    private final LoanInstallmentRepository installmentRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;

    @Value("${amc.banking.loan.late-fee-rate:0.02}")
    private double lateFeeRate;

    @Value("${amc.banking.loan.foreclosure-fee-rate:0.02}")
    private double foreclosureFeeRate;

    public LoanService(LoanRepository loanRepository,
                       LoanInstallmentRepository installmentRepository,
                       AccountRepository accountRepository,
                       UserRepository userRepository,
                       TransactionRepository transactionRepository,
                       NotificationRepository notificationRepository,
                       AuditLogRepository auditLogRepository) {
        this.loanRepository = loanRepository;
        this.installmentRepository = installmentRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.notificationRepository = notificationRepository;
        this.auditLogRepository = auditLogRepository;
    }

    // ----------------------------------------------------
    // 1. EMI CALCULATION & SCHEDULE GENERATION
    // ----------------------------------------------------

    public BigDecimal calculateMonthlyEmi(BigDecimal principal, double annualInterestRate, int tenureMonths) {
        if (principal == null || tenureMonths <= 0) {
            return BigDecimal.ZERO;
        }

        if (annualInterestRate == 0) {
            return principal.divide(BigDecimal.valueOf(tenureMonths), 2, RoundingMode.HALF_UP);
        }

        double p = principal.doubleValue();
        double r = annualInterestRate / 1200.0;
        double factor = Math.pow(1.0 + r, tenureMonths);
        double result = (p * r * factor) / (factor - 1.0);

        return BigDecimal.valueOf(result).setScale(2, RoundingMode.HALF_UP);
    }

    public EmiPreviewResponse previewSchedule(BigDecimal principal, double interestRate, int tenureMonths) {
        if (principal == null || principal.compareTo(new BigDecimal("10000")) < 0) {
            throw new IllegalArgumentException("Principal must be at least ₹10,000");
        }
        if (interestRate < 0 || interestRate > 50) {
            throw new IllegalArgumentException("Interest rate must be between 0% and 50%");
        }
        if (tenureMonths < 1 || tenureMonths > 480) {
            throw new IllegalArgumentException("Tenure must be between 1 and 480 months");
        }

        BigDecimal emi = calculateMonthlyEmi(principal, interestRate, tenureMonths);
        double r = interestRate / 1200.0;

        List<InstallmentDto> list = new ArrayList<>();
        BigDecimal opening = principal;
        BigDecimal totalInterest = BigDecimal.ZERO;
        LocalDate firstDue = LocalDate.now().plusMonths(1);

        for (int i = 1; i <= tenureMonths; i++) {
            LocalDate dueDate = firstDue.plusMonths(i - 1);
            BigDecimal interestComp;
            if (interestRate == 0) {
                interestComp = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            } else {
                interestComp = opening.multiply(BigDecimal.valueOf(r)).setScale(2, RoundingMode.HALF_UP);
            }

            BigDecimal principalComp;
            BigDecimal closing;
            BigDecimal installmentEmi = emi;

            if (i == tenureMonths) {
                // Final installment absorbs any rounding discrepancies
                principalComp = opening;
                closing = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                installmentEmi = principalComp.add(interestComp);
            } else {
                principalComp = emi.subtract(interestComp);
                if (principalComp.compareTo(opening) > 0) {
                    principalComp = opening;
                }
                closing = opening.subtract(principalComp).setScale(2, RoundingMode.HALF_UP);
            }

            totalInterest = totalInterest.add(interestComp);

            InstallmentDto dto = new InstallmentDto();
            dto.setInstallmentNo(i);
            dto.setDueDate(dueDate);
            dto.setOpeningBalance(opening);
            dto.setEmiAmount(installmentEmi);
            dto.setPrincipalComponent(principalComp);
            dto.setInterestComponent(interestComp);
            dto.setClosingBalance(closing);
            dto.setStatus("PENDING");
            dto.setPaidAmount(BigDecimal.ZERO);
            dto.setPenaltyAmount(BigDecimal.ZERO);
            dto.setTotalDue(installmentEmi);
            list.add(dto);

            opening = closing;
        }

        BigDecimal totalPayable = principal.add(totalInterest).setScale(2, RoundingMode.HALF_UP);
        return new EmiPreviewResponse(emi, totalInterest, totalPayable, list);
    }

    @Transactional
    public void generateAndSaveSchedule(Loan loan, LocalDate startDate) {
        installmentRepository.deleteByLoanIdAndInstallmentNoGreaterThanEqual(loan.getId(), 1);

        BigDecimal principal = loan.getPrincipal();
        double interestRate = loan.getInterestRate();
        int tenureMonths = loan.getTenureMonths();
        BigDecimal emi = loan.getEmi();
        double r = interestRate / 1200.0;

        BigDecimal opening = principal;
        List<LoanInstallment> installments = new ArrayList<>();

        for (int i = 1; i <= tenureMonths; i++) {
            LocalDate dueDate = startDate.plusMonths(i - 1);
            BigDecimal interestComp;
            if (interestRate == 0) {
                interestComp = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            } else {
                interestComp = opening.multiply(BigDecimal.valueOf(r)).setScale(2, RoundingMode.HALF_UP);
            }

            BigDecimal principalComp;
            BigDecimal closing;
            BigDecimal installmentEmi = emi;

            if (i == tenureMonths) {
                principalComp = opening;
                closing = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                installmentEmi = principalComp.add(interestComp);
            } else {
                principalComp = emi.subtract(interestComp);
                if (principalComp.compareTo(opening) > 0) {
                    principalComp = opening;
                }
                closing = opening.subtract(principalComp).setScale(2, RoundingMode.HALF_UP);
            }

            LoanInstallment inst = new LoanInstallment(
                    loan, i, dueDate, opening, installmentEmi, principalComp, interestComp, closing
            );
            installments.add(inst);

            opening = closing;
        }

        installmentRepository.saveAll(installments);
    }

    // ----------------------------------------------------
    // 2. READ ENDPOINTS (SCHEDULE & SUMMARY)
    // ----------------------------------------------------

    public List<InstallmentDto> getLoanSchedule(Long loanId, String username, boolean isAdmin) {
        Loan loan = getLoanAndValidateAccess(loanId, username, isAdmin);
        List<LoanInstallment> list = installmentRepository.findByLoanIdOrderByInstallmentNoAsc(loan.getId());

        // Auto-generate if missing for existing active loan
        if (list.isEmpty() && !"REJECTED".equalsIgnoreCase(loan.getStatus())) {
            LocalDate start = loan.getDisbursedAt() != null ? loan.getDisbursedAt().toLocalDate().plusMonths(1) : LocalDate.now().plusMonths(1);
            generateAndSaveSchedule(loan, start);
            list = installmentRepository.findByLoanIdOrderByInstallmentNoAsc(loan.getId());
        }

        List<InstallmentDto> dtos = new ArrayList<>();
        for (LoanInstallment item : list) {
            dtos.add(mapToDto(item));
        }
        return dtos;
    }

    public LoanSummaryResponse getLoanSummary(Long loanId, String username, boolean isAdmin) {
        Loan loan = getLoanAndValidateAccess(loanId, username, isAdmin);
        List<LoanInstallment> schedule = installmentRepository.findByLoanIdOrderByInstallmentNoAsc(loan.getId());

        if (schedule.isEmpty() && !"REJECTED".equalsIgnoreCase(loan.getStatus())) {
            LocalDate start = loan.getDisbursedAt() != null ? loan.getDisbursedAt().toLocalDate().plusMonths(1) : LocalDate.now().plusMonths(1);
            generateAndSaveSchedule(loan, start);
            schedule = installmentRepository.findByLoanIdOrderByInstallmentNoAsc(loan.getId());
        }

        LoanSummaryResponse res = new LoanSummaryResponse();
        res.setLoanId(loan.getId());
        res.setLoanType(loan.getType());
        res.setPrincipal(loan.getPrincipal());
        res.setOutstandingPrincipal(loan.getOutstandingPrincipal());
        res.setInterestRate(loan.getInterestRate());
        res.setTenureMonths(loan.getTenureMonths());
        res.setEmi(loan.getEmi());
        res.setStatus(loan.getStatus());
        res.setAutoDebit(loan.getAutoDebit());
        res.setAutoDebitAccountId(loan.getAutoDebitAccountId());

        int paidCount = 0;
        BigDecimal totalInterestPaid = BigDecimal.ZERO;
        BigDecimal totalPenaltyPaid = BigDecimal.ZERO;
        BigDecimal overdueAmount = BigDecimal.ZERO;

        LoanInstallment nextInstallment = null;

        for (LoanInstallment inst : schedule) {
            if ("PAID".equalsIgnoreCase(inst.getStatus())) {
                paidCount++;
                totalInterestPaid = totalInterestPaid.add(inst.getInterestComponent());
                totalPenaltyPaid = totalPenaltyPaid.add(inst.getPenaltyAmount());
            } else if ("OVERDUE".equalsIgnoreCase(inst.getStatus())) {
                BigDecimal pending = inst.getEmiAmount().subtract(inst.getPaidAmount()).add(inst.getPenaltyAmount());
                overdueAmount = overdueAmount.add(pending);
                if (nextInstallment == null) {
                    nextInstallment = inst;
                }
            } else if ("PARTIALLY_PAID".equalsIgnoreCase(inst.getStatus()) || "PENDING".equalsIgnoreCase(inst.getStatus())) {
                if (nextInstallment == null) {
                    nextInstallment = inst;
                }
            }
        }

        res.setPaidInstallmentsCount(paidCount);
        res.setRemainingInstallmentsCount(schedule.size() - paidCount);
        double progress = schedule.isEmpty() ? 0 : ((double) paidCount / schedule.size()) * 100.0;
        res.setRepaymentProgressPercent(Math.round(progress * 10.0) / 10.0);
        res.setTotalInterestPaid(totalInterestPaid);
        res.setTotalPenaltyPaid(totalPenaltyPaid);
        res.setOverdueAmount(overdueAmount);

        if (nextInstallment != null) {
            res.setNextInstallmentNo(nextInstallment.getInstallmentNo());
            res.setNextDueDate(nextInstallment.getDueDate());
            BigDecimal due = nextInstallment.getEmiAmount().subtract(nextInstallment.getPaidAmount()).add(nextInstallment.getPenaltyAmount());
            res.setNextDueAmount(due);
        } else {
            res.setNextInstallmentNo(null);
            res.setNextDueDate(null);
            res.setNextDueAmount(BigDecimal.ZERO);
        }

        return res;
    }

    // ----------------------------------------------------
    // 3. REPAYMENT SYSTEM (NEXT EMI)
    // ----------------------------------------------------

    @Transactional
    public InstallmentDto repayNextInstallment(Long loanId, String username, RepayRequest request) {
        Loan loan = getLoanAndValidateAccess(loanId, username, false);

        if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not ACTIVE (current status: " + loan.getStatus() + ")");
        }

        Account sourceAccount = accountRepository.findById(request.getSourceAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Source account not found"));

        Customer customer = getCustomerForUsername(username);
        if (!sourceAccount.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("Source account does not belong to you");
        }

        if (!"ACTIVE".equalsIgnoreCase(sourceAccount.getStatus())) {
            throw new IllegalArgumentException("Source account is not ACTIVE (current status: " + sourceAccount.getStatus() + ")");
        }

        LoanInstallment installment = installmentRepository
                .findFirstByLoanIdAndStatusInOrderByInstallmentNoAsc(loan.getId(), List.of("OVERDUE", "PARTIALLY_PAID", "PENDING"))
                .orElseThrow(() -> new IllegalArgumentException("No pending installment found for this loan"));

        BigDecimal remainingEmi = installment.getEmiAmount().subtract(installment.getPaidAmount());
        BigDecimal totalDueForInstallment = remainingEmi.add(installment.getPenaltyAmount());

        BigDecimal paymentAmount = (request.getAmount() == null) ? totalDueForInstallment : request.getAmount();

        if (paymentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }

        if (paymentAmount.compareTo(totalDueForInstallment) > 0) {
            paymentAmount = totalDueForInstallment; // Cap at exact due
        }

        if (sourceAccount.getBalance().compareTo(paymentAmount) < 0) {
            throw new IllegalArgumentException("Insufficient balance in source account. Available: ₹" + sourceAccount.getBalance() + ", Required: ₹" + paymentAmount);
        }

        // 1. Debit Source Account
        sourceAccount.setBalance(sourceAccount.getBalance().subtract(paymentAmount));
        accountRepository.save(sourceAccount);

        // 2. Update Installment
        installment.setPaidAmount(installment.getPaidAmount().add(paymentAmount));
        installment.setPaidDate(LocalDateTime.now());

        if (installment.getPaidAmount().compareTo(installment.getEmiAmount().add(installment.getPenaltyAmount())) >= 0) {
            installment.setStatus("PAID");
        } else {
            installment.setStatus("PARTIALLY_PAID");
        }
        installmentRepository.save(installment);

        // 3. Update Loan Outstanding Principal
        BigDecimal principalPaid = installment.getPrincipalComponent();
        loan.setOutstandingPrincipal(loan.getOutstandingPrincipal().subtract(principalPaid).max(BigDecimal.ZERO));

        // Check if all installments are now PAID
        long pendingCount = installmentRepository.countByLoanIdAndStatus(loan.getId(), "PENDING")
                + installmentRepository.countByLoanIdAndStatus(loan.getId(), "OVERDUE")
                + installmentRepository.countByLoanIdAndStatus(loan.getId(), "PARTIALLY_PAID");

        if (pendingCount == 0) {
            loan.setStatus("CLOSED");
            loan.setOutstandingPrincipal(BigDecimal.ZERO);
        }
        loanRepository.save(loan);

        // 4. Record Transaction
        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        Transaction txn = new Transaction(
                refId,
                sourceAccount,
                null,
                "LOAN_EMI",
                paymentAmount,
                sourceAccount.getBalance(),
                "EMI Payment - Installment #" + installment.getInstallmentNo() + " (" + loan.getType() + " Loan)"
        );
        transactionRepository.save(txn);

        // 5. Audit Log & Notification
        logAudit(username, "ROLE_CUSTOMER", "LOAN_REPAYMENT", "Loan #" + loan.getId() + " Inst #" + installment.getInstallmentNo(), "Paid ₹" + paymentAmount);
        sendNotification(customer.getEmail(), "EMI Payment Successful", "Payment of ₹" + paymentAmount + " for " + loan.getType() + " Loan processed.", "LOAN");

        return mapToDto(installment);
    }

    // ----------------------------------------------------
    // 4. PREPAYMENT & FORECLOSURE
    // ----------------------------------------------------

    @Transactional
    public LoanSummaryResponse prepayLoan(Long loanId, String username, PrepayRequest request) {
        Loan loan = getLoanAndValidateAccess(loanId, username, false);

        if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not ACTIVE");
        }

        Account sourceAccount = accountRepository.findById(request.getSourceAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Source account not found"));

        Customer customer = getCustomerForUsername(username);
        if (!sourceAccount.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("Source account does not belong to you");
        }

        if (!"ACTIVE".equalsIgnoreCase(sourceAccount.getStatus())) {
            throw new IllegalArgumentException("Source account is not ACTIVE");
        }

        BigDecimal prepayAmt = request.getPrepaymentAmount();
        if (prepayAmt == null || prepayAmt.compareTo(new BigDecimal("1000.00")) < 0) {
            throw new IllegalArgumentException("Prepayment amount must be at least ₹1,000.00");
        }

        if (sourceAccount.getBalance().compareTo(prepayAmt) < 0) {
            throw new IllegalArgumentException("Insufficient account balance. Available: ₹" + sourceAccount.getBalance());
        }

        if (prepayAmt.compareTo(loan.getOutstandingPrincipal()) >= 0) {
            // Full prepayment -> Foreclose instead
            ForeclosureRequest fcReq = new ForeclosureRequest(request.getSourceAccountId(), true);
            forecloseLoan(loanId, username, fcReq);
            return getLoanSummary(loanId, username, false);
        }

        // Debit account
        sourceAccount.setBalance(sourceAccount.getBalance().subtract(prepayAmt));
        accountRepository.save(sourceAccount);

        BigDecimal newOutstanding = loan.getOutstandingPrincipal().subtract(prepayAmt);
        loan.setOutstandingPrincipal(newOutstanding);

        // Identify future unpaid installments
        List<LoanInstallment> unpaid = installmentRepository.findByLoanIdAndStatusIn(
                loan.getId(), List.of("PENDING", "OVERDUE", "PARTIALLY_PAID")
        );

        if (!unpaid.isEmpty()) {
            int firstUnpaidNo = unpaid.get(0).getInstallmentNo();
            LocalDate nextDueDate = unpaid.get(0).getDueDate();

            // Delete old future installments
            installmentRepository.deleteByLoanIdAndInstallmentNoGreaterThanEqual(loan.getId(), firstUnpaidNo);

            double r = loan.getInterestRate() / 1200.0;

            if ("REDUCE_EMI".equalsIgnoreCase(request.getMode())) {
                // Keep remaining tenure months the same, reduce monthly EMI
                int remainingTenure = unpaid.size();
                BigDecimal newEmi = calculateMonthlyEmi(newOutstanding, loan.getInterestRate(), remainingTenure);
                loan.setEmi(newEmi);

                regenerateInstallmentsFrom(loan, firstUnpaidNo, nextDueDate, newOutstanding, newEmi, remainingTenure);
            } else {
                // REDUCE_TENURE: Keep original EMI, shorten remaining months
                BigDecimal emi = loan.getEmi();
                double p = newOutstanding.doubleValue();
                int newRemainingMonths;

                if (r == 0) {
                    newRemainingMonths = (int) Math.ceil(p / emi.doubleValue());
                } else {
                    double emiVal = emi.doubleValue();
                    if (emiVal <= p * r) {
                        newRemainingMonths = unpaid.size();
                    } else {
                        double months = Math.log(emiVal / (emiVal - p * r)) / Math.log(1.0 + r);
                        newRemainingMonths = Math.max(1, (int) Math.ceil(months));
                    }
                }

                regenerateInstallmentsFrom(loan, firstUnpaidNo, nextDueDate, newOutstanding, emi, newRemainingMonths);
            }
        }

        loanRepository.save(loan);

        // Transaction & Audit
        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        Transaction txn = new Transaction(
                refId, sourceAccount, null, "LOAN_EMI", prepayAmt, sourceAccount.getBalance(),
                "Part Prepayment (" + request.getMode() + ") for " + loan.getType() + " Loan"
        );
        transactionRepository.save(txn);

        logAudit(username, "ROLE_CUSTOMER", "LOAN_PREPAYMENT", "Loan #" + loan.getId(), "Prepaid ₹" + prepayAmt + " [" + request.getMode() + "]");
        sendNotification(customer.getEmail(), "Loan Prepayment Successful", "Prepayment of ₹" + prepayAmt + " processed. Remaining balance: ₹" + newOutstanding, "LOAN");

        return getLoanSummary(loanId, username, false);
    }

    private void regenerateInstallmentsFrom(Loan loan, int startInstallmentNo, LocalDate startDueDate,
                                           BigDecimal startingPrincipal, BigDecimal emi, int tenureCount) {
        BigDecimal opening = startingPrincipal;
        double r = loan.getInterestRate() / 1200.0;
        List<LoanInstallment> newItems = new ArrayList<>();

        for (int i = 1; i <= tenureCount; i++) {
            int no = startInstallmentNo + i - 1;
            LocalDate dueDate = startDueDate.plusMonths(i - 1);

            BigDecimal interestComp;
            if (loan.getInterestRate() == 0) {
                interestComp = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            } else {
                interestComp = opening.multiply(BigDecimal.valueOf(r)).setScale(2, RoundingMode.HALF_UP);
            }

            BigDecimal principalComp;
            BigDecimal closing;
            BigDecimal currentEmi = emi;

            if (i == tenureCount) {
                principalComp = opening;
                closing = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                currentEmi = principalComp.add(interestComp);
            } else {
                principalComp = emi.subtract(interestComp);
                if (principalComp.compareTo(opening) > 0) {
                    principalComp = opening;
                }
                closing = opening.subtract(principalComp).setScale(2, RoundingMode.HALF_UP);
            }

            LoanInstallment item = new LoanInstallment(
                    loan, no, dueDate, opening, currentEmi, principalComp, interestComp, closing
            );
            newItems.add(item);
            opening = closing;
        }

        installmentRepository.saveAll(newItems);
    }

    public ForeclosureQuoteResponse getForeclosureQuote(Long loanId, String username, boolean isAdmin) {
        Loan loan = getLoanAndValidateAccess(loanId, username, isAdmin);

        if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not ACTIVE");
        }

        BigDecimal outstanding = loan.getOutstandingPrincipal();
        double r = loan.getInterestRate() / 1200.0;
        BigDecimal accruedInterest = outstanding.multiply(BigDecimal.valueOf(r)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fee = outstanding.multiply(BigDecimal.valueOf(foreclosureFeeRate)).setScale(2, RoundingMode.HALF_UP);

        // Sum unpaid overdue penalties
        List<LoanInstallment> unpaid = installmentRepository.findByLoanIdAndStatusIn(
                loan.getId(), List.of("PENDING", "OVERDUE", "PARTIALLY_PAID")
        );
        BigDecimal pendingPenalties = unpaid.stream()
                .map(LoanInstallment::getPenaltyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal total = outstanding.add(accruedInterest).add(fee).add(pendingPenalties).setScale(2, RoundingMode.HALF_UP);

        ForeclosureQuoteResponse quote = new ForeclosureQuoteResponse();
        quote.setLoanId(loan.getId());
        quote.setAsOfDate(LocalDate.now());
        quote.setOutstandingPrincipal(outstanding);
        quote.setAccruedInterest(accruedInterest);
        quote.setForeclosureFeeRate(foreclosureFeeRate * 100.0);
        quote.setForeclosureFee(fee);
        quote.setPendingPenalties(pendingPenalties);
        quote.setTotalForeclosureAmount(total);

        return quote;
    }

    @Transactional
    public LoanSummaryResponse forecloseLoan(Long loanId, String username, ForeclosureRequest request) {
        Loan loan = getLoanAndValidateAccess(loanId, username, false);

        if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Loan is not ACTIVE");
        }

        if (request.getConfirmation() == null || !request.getConfirmation()) {
            throw new IllegalArgumentException("Foreclosure confirmation is required");
        }

        Account sourceAccount = accountRepository.findById(request.getSourceAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Source account not found"));

        Customer customer = getCustomerForUsername(username);
        if (!sourceAccount.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("Source account does not belong to you");
        }

        if (!"ACTIVE".equalsIgnoreCase(sourceAccount.getStatus())) {
            throw new IllegalArgumentException("Source account is not ACTIVE");
        }

        ForeclosureQuoteResponse quote = getForeclosureQuote(loanId, username, false);
        BigDecimal totalAmount = quote.getTotalForeclosureAmount();

        if (sourceAccount.getBalance().compareTo(totalAmount) < 0) {
            throw new IllegalArgumentException("Insufficient balance in account. Required: ₹" + totalAmount + ", Available: ₹" + sourceAccount.getBalance());
        }

        // Debit source account
        sourceAccount.setBalance(sourceAccount.getBalance().subtract(totalAmount));
        accountRepository.save(sourceAccount);

        // Update loan status
        loan.setStatus("CLOSED");
        loan.setOutstandingPrincipal(BigDecimal.ZERO);
        loan.setForeclosureDate(LocalDateTime.now());
        loan.setForeclosureAmount(totalAmount);
        loanRepository.save(loan);

        // Mark all remaining installments as PAID
        List<LoanInstallment> unpaid = installmentRepository.findByLoanIdAndStatusIn(
                loan.getId(), List.of("PENDING", "OVERDUE", "PARTIALLY_PAID")
        );
        for (LoanInstallment item : unpaid) {
            item.setStatus("PAID");
            item.setPaidAmount(item.getEmiAmount().add(item.getPenaltyAmount()));
            item.setPaidDate(LocalDateTime.now());
        }
        installmentRepository.saveAll(unpaid);

        // Record Transaction
        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        Transaction txn = new Transaction(
                refId, sourceAccount, null, "LOAN_EMI", totalAmount, sourceAccount.getBalance(),
                "Full Foreclosure Payoff for " + loan.getType() + " Loan (Loan #" + loan.getId() + ")"
        );
        transactionRepository.save(txn);

        logAudit(username, "ROLE_CUSTOMER", "LOAN_FORECLOSURE", "Loan #" + loan.getId(), "Foreclosed with payment ₹" + totalAmount);
        sendNotification(customer.getEmail(), "Loan Foreclosed Successfully", "Your " + loan.getType() + " Loan #" + loan.getId() + " is now completely closed.", "LOAN");

        return getLoanSummary(loanId, username, false);
    }

    // ----------------------------------------------------
    // 5. OVERDUE & PENALTY HANDLING (SCHEDULED JOB)
    // ----------------------------------------------------

    @Scheduled(cron = "${amc.banking.loan.overdue-cron:0 0 1 * * ?}")
    @Transactional
    public void processOverdueAndAutoDebit() {
        LocalDate today = LocalDate.now();
        List<LoanInstallment> pastDue = installmentRepository.findOverdueInstallments(today);

        for (LoanInstallment item : pastDue) {
            Loan loan = item.getLoan();
            if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
                continue;
            }

            // 1. Mark as OVERDUE and apply late fee idempotently
            if ("PENDING".equalsIgnoreCase(item.getStatus())) {
                item.setStatus("OVERDUE");
            }

            // Idempotent penalty application: apply if penalty is 0.00
            if (item.getPenaltyAmount().compareTo(BigDecimal.ZERO) == 0) {
                BigDecimal penalty = item.getEmiAmount().multiply(BigDecimal.valueOf(lateFeeRate))
                        .setScale(2, RoundingMode.HALF_UP);
                item.setPenaltyAmount(penalty);
            }

            // 2. Auto-Debit if enabled
            if (loan.getAutoDebit() && loan.getAutoDebitAccountId() != null) {
                Optional<Account> autoAcc = accountRepository.findById(loan.getAutoDebitAccountId());
                if (autoAcc.isPresent()) {
                    Account acc = autoAcc.get();
                    BigDecimal totalDue = item.getEmiAmount().subtract(item.getPaidAmount()).add(item.getPenaltyAmount());

                    if ("ACTIVE".equalsIgnoreCase(acc.getStatus()) && acc.getBalance().compareTo(totalDue) >= 0) {
                        acc.setBalance(acc.getBalance().subtract(totalDue));
                        accountRepository.save(acc);

                        item.setPaidAmount(item.getPaidAmount().add(totalDue));
                        item.setPaidDate(LocalDateTime.now());
                        item.setStatus("PAID");

                        loan.setOutstandingPrincipal(loan.getOutstandingPrincipal().subtract(item.getPrincipalComponent()).max(BigDecimal.ZERO));
                        loanRepository.save(loan);

                        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
                        Transaction txn = new Transaction(
                                refId, acc, null, "LOAN_EMI", totalDue, acc.getBalance(),
                                "Auto-Debit EMI Payment - Inst #" + item.getInstallmentNo() + " (" + loan.getType() + " Loan)"
                        );
                        transactionRepository.save(txn);

                        sendNotification(loan.getCustomer().getEmail(), "Auto-Debit Successful",
                                "EMI payment of ₹" + totalDue + " was successfully auto-debited for " + loan.getType() + " Loan.", "LOAN");
                    } else {
                        sendNotification(loan.getCustomer().getEmail(), "Auto-Debit Failed",
                                "Auto-debit for EMI installment #" + item.getInstallmentNo() + " failed due to insufficient funds.", "LOAN");
                    }
                }
            }

            installmentRepository.save(item);
        }
    }

    public List<OverdueLoanItemDto> getOverdueLoansList() {
        List<Long> loanIds = installmentRepository.findLoanIdsWithOverdueInstallments();
        List<OverdueLoanItemDto> result = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Long loanId : loanIds) {
            Optional<Loan> loanOpt = loanRepository.findById(loanId);
            if (loanOpt.isEmpty()) continue;
            Loan loan = loanOpt.get();
            if (!"ACTIVE".equalsIgnoreCase(loan.getStatus())) continue;

            List<LoanInstallment> overdues = installmentRepository.findByLoanIdAndStatusIn(loan.getId(), List.of("OVERDUE"));
            if (overdues.isEmpty()) continue;

            BigDecimal totalOverdue = BigDecimal.ZERO;
            long maxDpd = 0;

            for (LoanInstallment o : overdues) {
                BigDecimal due = o.getEmiAmount().subtract(o.getPaidAmount()).add(o.getPenaltyAmount());
                totalOverdue = totalOverdue.add(due);
                long dpd = ChronoUnit.DAYS.between(o.getDueDate(), today);
                if (dpd > maxDpd) {
                    maxDpd = dpd;
                }
            }

            OverdueLoanItemDto item = new OverdueLoanItemDto();
            item.setLoanId(loan.getId());
            item.setCustomerId(loan.getCustomer().getId());
            item.setCustomerName(loan.getCustomer().getName());
            item.setCustomerEmail(loan.getCustomer().getEmail());
            item.setLoanType(loan.getType());
            item.setPrincipal(loan.getPrincipal());
            item.setOutstandingPrincipal(loan.getOutstandingPrincipal());
            item.setOverdueInstallmentsCount(overdues.size());
            item.setTotalOverdueAmount(totalOverdue);
            item.setMaxDaysPastDue(maxDpd);

            result.add(item);
        }

        result.sort((a, b) -> Long.compare(b.getMaxDaysPastDue(), a.getMaxDaysPastDue()));
        return result;
    }

    // ----------------------------------------------------
    // 6. CSV EXPORT & AUTO-DEBIT CONFIG
    // ----------------------------------------------------

    public ByteArrayInputStream exportScheduleCsv(Long loanId, String username, boolean isAdmin) {
        List<InstallmentDto> schedule = getLoanSchedule(loanId, username, isAdmin);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try (CSVPrinter printer = new CSVPrinter(new PrintWriter(out),
                CSVFormat.DEFAULT.withHeader("Installment No", "Due Date", "Opening Balance (INR)", "EMI Amount (INR)",
                        "Principal Component (INR)", "Interest Component (INR)", "Closing Balance (INR)", "Status",
                        "Paid Amount (INR)", "Penalty (INR)", "Paid Date"))) {

            for (InstallmentDto s : schedule) {
                printer.printRecord(
                        s.getInstallmentNo(),
                        s.getDueDate(),
                        s.getOpeningBalance(),
                        s.getEmiAmount(),
                        s.getPrincipalComponent(),
                        s.getInterestComponent(),
                        s.getClosingBalance(),
                        s.getStatus(),
                        s.getPaidAmount(),
                        s.getPenaltyAmount(),
                        s.getPaidDate() != null ? s.getPaidDate().toString() : ""
                );
            }
            printer.flush();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate schedule CSV: " + e.getMessage());
        }

        return new ByteArrayInputStream(out.toByteArray());
    }

    @Transactional
    public Loan toggleAutoDebit(Long loanId, String username, boolean enable, Long accountId) {
        Loan loan = getLoanAndValidateAccess(loanId, username, false);
        if (enable) {
            Account acc = accountRepository.findById(accountId)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found"));
            Customer cust = getCustomerForUsername(username);
            if (!acc.getCustomer().getId().equals(cust.getId())) {
                throw new IllegalArgumentException("Account does not belong to you");
            }
            loan.setAutoDebit(true);
            loan.setAutoDebitAccountId(accountId);
        } else {
            loan.setAutoDebit(false);
            loan.setAutoDebitAccountId(null);
        }
        return loanRepository.save(loan);
    }

    // ----------------------------------------------------
    // HELPERS
    // ----------------------------------------------------

    private Loan getLoanAndValidateAccess(Long loanId, String username, boolean isAdmin) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Loan not found with ID: " + loanId));

        if (!isAdmin && username != null) {
            Customer customer = getCustomerForUsername(username);
            if (!loan.getCustomer().getId().equals(customer.getId())) {
                throw new IllegalArgumentException("Access Denied: You can view only your own loans");
            }
        }
        return loan;
    }

    private Customer getCustomerForUsername(String username) {
        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        if (user.getCustomer() == null) {
            throw new IllegalArgumentException("Logged-in user is not associated with a customer account");
        }
        return user.getCustomer();
    }

    private InstallmentDto mapToDto(LoanInstallment item) {
        InstallmentDto dto = new InstallmentDto();
        dto.setId(item.getId());
        dto.setInstallmentNo(item.getInstallmentNo());
        dto.setDueDate(item.getDueDate());
        dto.setOpeningBalance(item.getOpeningBalance());
        dto.setEmiAmount(item.getEmiAmount());
        dto.setPrincipalComponent(item.getPrincipalComponent());
        dto.setInterestComponent(item.getInterestComponent());
        dto.setClosingBalance(item.getClosingBalance());
        dto.setStatus(item.getStatus());
        dto.setPaidAmount(item.getPaidAmount());
        dto.setPaidDate(item.getPaidDate());
        dto.setPenaltyAmount(item.getPenaltyAmount());
        dto.setTotalDue(item.getEmiAmount().subtract(item.getPaidAmount()).add(item.getPenaltyAmount()));
        return dto;
    }

    private void logAudit(String username, String role, String action, String resource, String details) {
        AuditLog log = new AuditLog(username, role, action, resource, details);
        auditLogRepository.save(log);
    }

    private void sendNotification(String recipient, String title, String message, String type) {
        Notification notif = new Notification(recipient, title, message, type);
        notificationRepository.save(notif);
    }
}
