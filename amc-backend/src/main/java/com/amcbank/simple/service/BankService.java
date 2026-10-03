package com.amcbank.simple.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amcbank.simple.dto.*;
import com.amcbank.simple.model.*;
import com.amcbank.simple.repository.*;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;

@Service
public class BankService {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final BeneficiaryRepository beneficiaryRepository;
    private final EmiScheduleRepository emiScheduleRepository;
    private final FixedDepositRepository fixedDepositRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoanService loanService;

    public BankService(CustomerRepository customerRepository,
                       AccountRepository accountRepository,
                       LoanRepository loanRepository,
                       UserRepository userRepository,
                       TransactionRepository transactionRepository,
                       BeneficiaryRepository beneficiaryRepository,
                       EmiScheduleRepository emiScheduleRepository,
                       FixedDepositRepository fixedDepositRepository,
                       NotificationRepository notificationRepository,
                       AuditLogRepository auditLogRepository,
                       PasswordEncoder passwordEncoder,
                       LoanService loanService) {
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.loanRepository = loanRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.beneficiaryRepository = beneficiaryRepository;
        this.emiScheduleRepository = emiScheduleRepository;
        this.fixedDepositRepository = fixedDepositRepository;
        this.notificationRepository = notificationRepository;
        this.auditLogRepository = auditLogRepository;
        this.passwordEncoder = passwordEncoder;
        this.loanService = loanService;
    }

    // -------------------- CUSTOMER MANAGEMENT --------------------

    public List<Customer> getCustomers(String search) {
        if (search == null || search.isBlank()) {
            return customerRepository.findAll();
        }
        return customerRepository
                .findByNameContainingIgnoreCaseOrCityContainingIgnoreCase(search.trim(), search.trim());
    }

    public PagedResponse<Customer> getCustomersPaged(String search, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        String query = search == null ? "" : search.trim();
        Page<Customer> p = customerRepository
                .findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrPanNumberContainingIgnoreCase(query, query, query, pageable);
        return new PagedResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    public Customer getCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with ID: " + id));
    }

    @Transactional
    public Customer addCustomer(Customer customer) {
        normalizeCustomer(customer);
        validateCustomer(customer, null);
        validateNewPassword(customer.getInitialPassword());

        if (userRepository.existsByUsernameIgnoreCase(customer.getEmail())) {
            throw new IllegalArgumentException("A login already exists for email: " + customer.getEmail());
        }

        Customer saved = customerRepository.save(customer);

        AppUser login = new AppUser(
                saved.getEmail(),
                passwordEncoder.encode(customer.getInitialPassword()),
                "ROLE_CUSTOMER",
                saved);
        userRepository.save(login);

        logAudit("ADMIN", "ROLE_ADMIN", "CREATE_CUSTOMER", "Customer ID: " + saved.getId(), "Created customer " + saved.getName());
        return saved;
    }

    @Transactional
    public Customer updateCustomer(Long id, Customer input) {
        Customer customer = getCustomer(id);
        normalizeCustomer(input);
        validateCustomer(input, customer);

        String oldEmail = customer.getEmail();
        boolean emailChanged = !input.getEmail().equalsIgnoreCase(oldEmail);

        if (emailChanged && userRepository.existsByUsernameIgnoreCase(input.getEmail())) {
            throw new IllegalArgumentException("A login already exists for email: " + input.getEmail());
        }

        customer.setName(input.getName());
        customer.setEmail(input.getEmail());
        customer.setCity(input.getCity());
        customer.setPanNumber(input.getPanNumber());
        if (input.getPhoneNumber() != null) customer.setPhoneNumber(input.getPhoneNumber());
        if (input.getAddress() != null) customer.setAddress(input.getAddress());
        if (input.getDateOfBirth() != null) customer.setDateOfBirth(input.getDateOfBirth());

        Customer saved = customerRepository.save(customer);

        if (emailChanged) {
            AppUser login = userRepository.findByCustomerId(id)
                    .orElseThrow(() -> new IllegalArgumentException("Customer login account not found"));
            login.setUsername(saved.getEmail());
            userRepository.save(login);
        }

        logAudit("ADMIN", "ROLE_ADMIN", "UPDATE_CUSTOMER", "Customer ID: " + id, "Updated customer details");
        return saved;
    }

    @Transactional
    public void deleteCustomer(Long id) {
        getCustomer(id);
        if (!accountRepository.findByCustomerId(id).isEmpty()
                || !loanRepository.findByCustomerId(id).isEmpty()) {
            throw new IllegalArgumentException("Customer cannot be deleted while active accounts or loans exist");
        }

        userRepository.findByCustomerId(id).ifPresent(user -> {
            userRepository.delete(user);
            userRepository.flush();
        });
        customerRepository.deleteById(id);
        logAudit("ADMIN", "ROLE_ADMIN", "DELETE_CUSTOMER", "Customer ID: " + id, "Deleted customer");
    }

    private void normalizeCustomer(Customer customer) {
        if (customer.getName() != null) customer.setName(customer.getName().trim());
        if (customer.getEmail() != null) customer.setEmail(customer.getEmail().trim().toLowerCase(Locale.ROOT));
        if (customer.getCity() != null) customer.setCity(customer.getCity().trim());
        if (customer.getPanNumber() != null) customer.setPanNumber(customer.getPanNumber().trim().toUpperCase(Locale.ROOT));
    }

    private void validateCustomer(Customer input, Customer existing) {
        if (input.getName() == null || input.getName().isBlank()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (input.getEmail() == null || !input.getEmail().contains("@")) {
            throw new IllegalArgumentException("Valid email address is required");
        }
        if (input.getPanNumber() == null || input.getPanNumber().isBlank()) {
            throw new IllegalArgumentException("PAN number is required");
        }

        boolean emailChanged = existing == null || !input.getEmail().equalsIgnoreCase(existing.getEmail());
        boolean panChanged = existing == null || !input.getPanNumber().equalsIgnoreCase(existing.getPanNumber());

        if (emailChanged && customerRepository.existsByEmail(input.getEmail())) {
            throw new IllegalArgumentException("Email already registered: " + input.getEmail());
        }
        if (panChanged && customerRepository.existsByPanNumber(input.getPanNumber())) {
            throw new IllegalArgumentException("PAN already registered: " + input.getPanNumber());
        }
    }

    private void validateNewPassword(String password) {
        if (password == null || password.length() < 6) {
            throw new IllegalArgumentException("Password must contain at least 6 characters");
        }
    }

    // -------------------- ACCOUNTS & MONEY ACTIONS --------------------

    public List<Account> getAccounts(Long customerId) {
        getCustomer(customerId);
        return accountRepository.findByCustomerId(customerId);
    }

    public PagedResponse<com.amcbank.simple.dto.AccountResponse> getAccountsPaged(String search, String status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        String query = search == null ? "" : search.trim();
        String st = (status == null || status.isBlank() || status.equalsIgnoreCase("ALL")) ? null : status.trim().toUpperCase();
        Page<Account> p = accountRepository.findAccountsWithCustomer(query, st, pageable);
        
        List<com.amcbank.simple.dto.AccountResponse> content = p.getContent().stream().map(a -> {
            Customer c = a.getCustomer();
            if (c == null) {
                return new com.amcbank.simple.dto.AccountResponse(a.getId(), a.getAccountNumber(), a.getType(), a.getBalance(), a.getStatus(), a.getCreatedAt(),
                        null, "Unassigned / Orphaned", "N/A", null);
            }
            return new com.amcbank.simple.dto.AccountResponse(a.getId(), a.getAccountNumber(), a.getType(), a.getBalance(), a.getStatus(), a.getCreatedAt(),
                    c.getId(), c.getName(), c.getEmail(), c.getPhoneNumber());
        }).toList();

        return new PagedResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    @Transactional
    public Account openAccount(Long customerId, Account input) {
        Customer customer = getCustomer(customerId);

        String type = input.getType() == null ? "SAVINGS" : input.getType().toUpperCase();
        if (!type.equals("SAVINGS") && !type.equals("CURRENT")) {
            throw new IllegalArgumentException("Account type must be SAVINGS or CURRENT");
        }

        BigDecimal openingBalance = input.getBalance() == null ? BigDecimal.ZERO : input.getBalance();
        BigDecimal minBalance = type.equals("SAVINGS") ? new BigDecimal("1000.00") : new BigDecimal("5000.00");
        if (openingBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Opening balance cannot be negative");
        }

        Account account = new Account();
        account.setAccountNumber("AC" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase());
        account.setType(type);
        account.setBalance(openingBalance);
        account.setMinimumBalance(minBalance);
        account.setDailyTransferLimit(type.equals("SAVINGS") ? new BigDecimal("100000.00") : new BigDecimal("500000.00"));
        account.setStatus("ACTIVE");
        account.setCustomer(customer);
        Account saved = accountRepository.save(account);

        if (openingBalance.compareTo(BigDecimal.ZERO) > 0) {
            recordTransaction(saved, null, "DEPOSIT", openingBalance, openingBalance, "Initial Account Opening Deposit");
        }

        logAudit("ADMIN", "ROLE_ADMIN", "OPEN_ACCOUNT", "Account: " + saved.getAccountNumber(), "Opened " + type + " account");
        return saved;
    }

    @Transactional
    public Account deposit(Long accountId, BigDecimal amount) {
        Account account = getActiveAccount(accountId);
        validatePositiveAmount(amount);
        account.setBalance(account.getBalance().add(amount));
        Account saved = accountRepository.save(account);

        recordTransaction(saved, null, "DEPOSIT", amount, saved.getBalance(), "Deposit into account");
        return saved;
    }

    @Transactional
    public Account withdraw(Long accountId, BigDecimal amount) {
        Account account = getActiveAccount(accountId);
        validatePositiveAmount(amount);

        if (amount.compareTo(account.getBalance()) > 0) {
            throw new IllegalArgumentException("Withdrawal amount cannot exceed available balance of ₹" + account.getBalance());
        }

        account.setBalance(account.getBalance().subtract(amount));
        Account saved = accountRepository.save(account);

        recordTransaction(saved, null, "WITHDRAWAL", amount, saved.getBalance(), "Withdrawal from account");
        return saved;
    }

    @Transactional
    public Account updateAccountStatus(Long accountId, String newStatus) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        String status = newStatus == null ? "" : newStatus.trim().toUpperCase();
        if (!status.equals("ACTIVE") && !status.equals("FROZEN") && !status.equals("CLOSED")) {
            throw new IllegalArgumentException("Status must be ACTIVE, FROZEN, or CLOSED");
        }
        account.setStatus(status);
        Account saved = accountRepository.save(account);
        logAudit("ADMIN", "ROLE_ADMIN", "UPDATE_ACCOUNT_STATUS", "Account: " + account.getAccountNumber(), "Status changed to " + status);
        return saved;
    }

    // -------------------- FUND TRANSFERS --------------------

    @Transactional
    public Transaction executeTransfer(String username, TransferRequest request) {
        validatePositiveAmount(request.getAmount());

        Account source = accountRepository.findByAccountNumber(request.getSourceAccountNumber())
                .orElseThrow(() -> new IllegalArgumentException("Source account not found"));
        Account target = accountRepository.findByAccountNumber(request.getTargetAccountNumber())
                .orElseThrow(() -> new IllegalArgumentException("Target account not found"));

        if (!"ACTIVE".equalsIgnoreCase(source.getStatus())) {
            throw new IllegalArgumentException("Source account is not active");
        }
        if (!"ACTIVE".equalsIgnoreCase(target.getStatus())) {
            throw new IllegalArgumentException("Target account is not active");
        }

        Customer customer = getCustomerForUsername(username);
        if (!source.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("You can transfer funds only from your own accounts");
        }

        if (source.getId().equals(target.getId())) {
            throw new IllegalArgumentException("Source and target accounts cannot be the same");
        }

        if (request.getAmount().compareTo(source.getBalance()) > 0) {
            throw new IllegalArgumentException("Insufficient funds. Available balance: ₹" + source.getBalance());
        }

        // Check daily transfer limit
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        BigDecimal dailySum = transactionRepository.sumDailyTransferAmount(source.getId(), startOfDay);
        BigDecimal totalTransferToday = dailySum.add(request.getAmount());
        if (totalTransferToday.compareTo(source.getDailyTransferLimit()) > 0) {
            throw new IllegalArgumentException("Transfer exceeds daily transfer limit of ₹" + source.getDailyTransferLimit());
        }

        // Execute balance transfer atomically
        source.setBalance(source.getBalance().subtract(request.getAmount()));
        target.setBalance(target.getBalance().add(request.getAmount()));

        accountRepository.save(source);
        accountRepository.save(target);

        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        String desc = request.getDescription() != null && !request.getDescription().isBlank()
                ? request.getDescription() : "Transfer to " + target.getAccountNumber();

        // Source transaction (TRANSFER_OUT)
        Transaction sourceTxn = new Transaction(refId, source, target, "TRANSFER_OUT", request.getAmount(), source.getBalance(), desc);
        transactionRepository.save(sourceTxn);

        // Target transaction (TRANSFER_IN)
        String targetRefId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        Transaction targetTxn = new Transaction(targetRefId, target, source, "TRANSFER_IN", request.getAmount(), target.getBalance(), "Transfer from " + source.getAccountNumber());
        transactionRepository.save(targetTxn);

        sendNotification(customer.getEmail(), "Fund Transfer Successful", "Transferred ₹" + request.getAmount() + " to account " + target.getAccountNumber(), "TRANSACTION");
        logAudit(username, "ROLE_CUSTOMER", "FUND_TRANSFER", "Ref: " + refId, "Transferred ₹" + request.getAmount());

        return sourceTxn;
    }

    // -------------------- TRANSACTIONS & STATEMENTS --------------------

    public PagedResponse<Transaction> getAccountTransactions(Long accountId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Transaction> p = transactionRepository.findByAccountIdOrTargetAccountId(accountId, pageable);
        return new PagedResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    public PagedResponse<Transaction> getCustomerTransactions(String username, int page, int size) {
        Customer customer = getCustomerForUsername(username);
        Pageable pageable = PageRequest.of(page, size);
        Page<Transaction> p = transactionRepository.findByCustomerId(customer.getId(), pageable);
        return new PagedResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    public ByteArrayInputStream exportTransactionsCsv(String username, Long accountId) {
        List<Transaction> list = accountId != null
                ? transactionRepository.findByAccountIdOrderByTimestampDesc(accountId)
                : transactionRepository.findAllByCustomerId(getCustomerForUsername(username).getId());

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out);
             CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                     .setHeader("Reference ID", "Account Number", "Type", "Amount (INR)", "Balance After (INR)", "Description", "Timestamp").build())) {
            for (Transaction t : list) {
                csvPrinter.printRecord(
                        t.getReferenceId(),
                        t.getAccount().getAccountNumber(),
                        t.getTransactionType(),
                        t.getAmount(),
                        t.getBalanceAfter(),
                        t.getDescription(),
                        t.getTimestamp()
                );
            }
            csvPrinter.flush();
        } catch (Exception e) {
            throw new RuntimeException("CSV Export Error: " + e.getMessage());
        }
        return new ByteArrayInputStream(out.toByteArray());
    }

    public ByteArrayInputStream exportTransactionsPdf(String username, Long accountId) {
        List<Transaction> list = accountId != null
                ? transactionRepository.findByAccountIdOrderByTimestampDesc(accountId)
                : transactionRepository.findAllByCustomerId(getCustomerForUsername(username).getId());

        Document document = new Document(PageSize.A4.rotate());
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
            Paragraph title = new Paragraph("ARBC Bank - Account Statement", headerFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);
            document.add(new Paragraph("Generated on: " + LocalDateTime.now().toString()));
            document.add(new Paragraph("Customer: " + username));
            document.add(Chunk.NEWLINE);

            PdfPTable table = new PdfPTable(6);
            table.setWidthPercentage(100);
            table.addCell("Reference ID");
            table.addCell("Account");
            table.addCell("Type");
            table.addCell("Amount (INR)");
            table.addCell("Balance After");
            table.addCell("Timestamp");

            for (Transaction t : list) {
                table.addCell(t.getReferenceId());
                table.addCell(t.getAccount().getAccountNumber());
                table.addCell(t.getTransactionType());
                table.addCell("₹" + t.getAmount());
                table.addCell("₹" + t.getBalanceAfter());
                table.addCell(t.getTimestamp().toString());
            }

            document.add(table);
            document.close();
        } catch (Exception e) {
            throw new RuntimeException("PDF Export Error: " + e.getMessage());
        }
        return new ByteArrayInputStream(out.toByteArray());
    }

    // -------------------- LOANS & EMI SCHEDULE --------------------

    public List<Loan> getAllLoans() {
        return loanRepository.findAll();
    }

    public List<Loan> getLoans(Long customerId) {
        getCustomer(customerId);
        return loanRepository.findByCustomerId(customerId);
    }

    @Transactional
    public Loan applyForLoan(String username, Loan input) {
        Customer customer = getCustomerForUsername(username);
        return sanctionOrApplyLoan(customer, input, "APPLIED");
    }

    @Transactional
    public Loan sanctionLoan(Long customerId, Loan input) {
        Customer customer = getCustomer(customerId);
        return sanctionOrApplyLoan(customer, input, "ACTIVE");
    }

    private Loan sanctionOrApplyLoan(Customer customer, Loan input, String initialStatus) {
        if (input.getPrincipal() == null || input.getPrincipal().compareTo(new BigDecimal("10000")) < 0) {
            throw new IllegalArgumentException("Loan principal must be at least ₹10,000");
        }
        if (input.getType() == null || input.getType().isBlank()) {
            throw new IllegalArgumentException("Loan type is required");
        }
        if (input.getTenureMonths() <= 0 || input.getTenureMonths() > 480) {
            throw new IllegalArgumentException("Tenure must be between 1 and 480 months");
        }
        if (input.getInterestRate() <= 0 || input.getInterestRate() > 50) {
            throw new IllegalArgumentException("Interest rate must be between 0.1% and 50%");
        }
        if (loanRepository.countByCustomerIdAndStatus(customer.getId(), "ACTIVE") >= 3) {
            throw new IllegalArgumentException("Customer already has 3 active loans");
        }

        BigDecimal totalBalance = accountRepository.findByCustomerId(customer.getId())
                .stream()
                .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal requiredBalance = input.getPrincipal().multiply(new BigDecimal("0.10"));
        if (totalBalance.compareTo(requiredBalance) < 0) {
            throw new IllegalArgumentException("Customer balance must be at least 10% of loan principal (Required: ₹" + requiredBalance + ")");
        }

        input.setCustomer(customer);
        input.setStatus(initialStatus);
        input.calculateEmi();

        Loan saved = loanRepository.save(input);
        generateEmiSchedule(saved);

        if ("ACTIVE".equalsIgnoreCase(initialStatus)) {
            saved.setApprovedAt(LocalDateTime.now());
            saved.setDisbursedAt(LocalDateTime.now());
            disburseLoanToAccount(saved);
        }

        logAudit(customer.getEmail(), "ROLE_CUSTOMER", "APPLY_LOAN", "Loan ID: " + saved.getId(), "Loan applied: " + saved.getType());
        return saved;
    }

    @Transactional
    public Loan updateLoanDecision(Long loanId, String decision, String remarks) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("Loan not found"));

        String status = decision == null ? "" : decision.trim().toUpperCase();
        if (!status.equals("APPROVED") && !status.equals("REJECTED")) {
            throw new IllegalArgumentException("Decision must be APPROVED or REJECTED");
        }

        loan.setStatus(status);
        loan.setRemarks(remarks);
        if (status.equals("APPROVED")) {
            loan.setApprovedAt(LocalDateTime.now());
            loan.setDisbursedAt(LocalDateTime.now());
            loan.setStatus("ACTIVE");
            disburseLoanToAccount(loan);
        }

        Loan saved = loanRepository.save(loan);
        logAudit("ADMIN", "ROLE_ADMIN", "LOAN_DECISION", "Loan ID: " + loanId, "Loan " + status);
        return saved;
    }

    private void disburseLoanToAccount(Loan loan) {
        List<Account> custAccounts = accountRepository.findByCustomerId(loan.getCustomerId());
        if (!custAccounts.isEmpty()) {
            Account target = custAccounts.get(0);
            target.setBalance(target.getBalance().add(loan.getPrincipal()));
            accountRepository.save(target);
            recordTransaction(target, null, "DEPOSIT", loan.getPrincipal(), target.getBalance(), "Loan Disbursal - " + loan.getType() + " Loan");
        }
    }

    private void generateEmiSchedule(Loan loan) {
        LocalDate startDate = loan.getDisbursedAt() != null
                ? loan.getDisbursedAt().toLocalDate().plusMonths(1)
                : LocalDate.now().plusMonths(1);
        loanService.generateAndSaveSchedule(loan, startDate);
    }

    public List<EmiSchedule> getLoanAmortizationSchedule(Long loanId) {
        return emiScheduleRepository.findByLoanIdOrderByInstallmentNumberAsc(loanId);
    }

    // -------------------- BENEFICIARY MANAGEMENT --------------------

    public List<Beneficiary> getBeneficiaries(String username) {
        Customer customer = getCustomerForUsername(username);
        return beneficiaryRepository.findByCustomerId(customer.getId());
    }

    @Transactional
    public Beneficiary addBeneficiary(String username, Beneficiary beneficiary) {
        Customer customer = getCustomerForUsername(username);
        if (beneficiary.getAccountNumber() == null || beneficiary.getAccountNumber().isBlank()) {
            throw new IllegalArgumentException("Beneficiary account number is required");
        }
        if (beneficiary.getBeneficiaryName() == null || beneficiary.getBeneficiaryName().isBlank()) {
            throw new IllegalArgumentException("Beneficiary name is required");
        }

        if (beneficiaryRepository.existsByCustomerIdAndAccountNumber(customer.getId(), beneficiary.getAccountNumber())) {
            throw new IllegalArgumentException("Beneficiary already added for this account");
        }

        beneficiary.setCustomer(customer);
        beneficiary.setStatus("VERIFIED");
        return beneficiaryRepository.save(beneficiary);
    }

    @Transactional
    public void deleteBeneficiary(String username, Long beneficiaryId) {
        Customer customer = getCustomerForUsername(username);
        Beneficiary b = beneficiaryRepository.findById(beneficiaryId)
                .orElseThrow(() -> new IllegalArgumentException("Beneficiary not found"));
        if (!b.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("Beneficiary does not belong to you");
        }
        beneficiaryRepository.delete(b);
    }

    // -------------------- FIXED DEPOSITS --------------------

    public static double getFdInterestRateForTenure(int tenureMonths) {
        if (tenureMonths < 6) return 5.0;
        if (tenureMonths < 12) return 5.5;
        if (tenureMonths < 24) return 6.5;
        if (tenureMonths < 36) return 7.0;
        if (tenureMonths < 60) return 7.5;
        return 8.0;
    }

    /**
     * Calculates Fixed Deposit maturity amount using quarterly compounding:
     * A = P * (1 + r / (4 * 100)) ^ (4 * (tenureMonths / 12.0))
     * Formula:
     * P = principal amount
     * r = annual interest rate in percent
     * n = 4 (quarterly compounding per year)
     * t = tenure in years (tenureMonths / 12.0)
     */
    public static BigDecimal calculateFdMaturityAmount(BigDecimal principal, double annualRate, int tenureMonths) {
        double p = principal.doubleValue();
        double r = annualRate / 100.0;
        double t = tenureMonths / 12.0;
        double n = 4.0; // quarterly compounding
        double maturity = p * Math.pow(1.0 + (r / n), n * t);
        return BigDecimal.valueOf(maturity).setScale(2, RoundingMode.HALF_UP);
    }

    public List<FixedDepositResponse> getFixedDeposits(String username) {
        Customer customer = getCustomerForUsername(username);
        return fixedDepositRepository.findByCustomerId(customer.getId())
                .stream()
                .map(this::mapToFdResponse)
                .toList();
    }

    public FixedDepositResponse getFixedDepositById(String username, Long id) {
        Customer customer = getCustomerForUsername(username);
        FixedDeposit fd = fixedDepositRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fixed Deposit not found with ID: " + id));
        if (!fd.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("You can only view your own Fixed Deposits");
        }
        return mapToFdResponse(fd);
    }

    public List<FixedDepositResponse> getAllFixedDeposits() {
        return fixedDepositRepository.findAll()
                .stream()
                .map(this::mapToFdResponse)
                .toList();
    }

    @Transactional
    public FixedDepositResponse createFixedDeposit(String username, OpenFdRequest req) {
        Customer customer = getCustomerForUsername(username);
        Account source = getOwnedActiveAccount(username, req.getSourceAccountId());
        BigDecimal amount = req.getAmount();
        validatePositiveAmount(amount);

        if (amount.compareTo(new BigDecimal("5000.00")) < 0) {
            throw new IllegalArgumentException("Minimum Fixed Deposit opening amount is ₹5,000");
        }

        int tenure = req.getTenureMonths() == null ? 12 : req.getTenureMonths();
        if (tenure < 1 || tenure > 120) {
            throw new IllegalArgumentException("Tenure must be between 1 and 120 months (10 years)");
        }

        BigDecimal minBal = source.getMinimumBalance() != null ? source.getMinimumBalance() : BigDecimal.ZERO;
        if (source.getBalance().subtract(amount).compareTo(minBal) < 0) {
            throw new IllegalArgumentException("Opening this FD would breach the minimum required balance of ₹" + minBal);
        }

        double rate = getFdInterestRateForTenure(tenure);
        BigDecimal maturityAmount = calculateFdMaturityAmount(amount, rate, tenure);

        // Debit source account
        source.setBalance(source.getBalance().subtract(amount));
        accountRepository.save(source);

        String fdNum = "FD" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();

        // Ledger entry: FD_OPEN
        recordTransaction(source, null, "FD_OPEN", amount, source.getBalance(),
                "Fixed Deposit Created: " + fdNum + " (Tenure: " + tenure + " mos @ " + rate + "%)");

        FixedDeposit fd = new FixedDeposit();
        fd.setDepositNumber(fdNum);
        fd.setCustomer(customer);
        fd.setSourceAccount(source);
        fd.setPrincipalAmount(amount);
        fd.setInterestRate(rate);
        fd.setTenureMonths(tenure);
        fd.setMaturityAmount(maturityAmount);
        fd.setStartDate(LocalDate.now());
        fd.setMaturityDate(LocalDate.now().plusMonths(tenure));
        fd.setStatus("ACTIVE");

        FixedDeposit saved = fixedDepositRepository.save(fd);
        recordAudit("OPEN_FIXED_DEPOSIT", username, "Opened FD " + fdNum + " for ₹" + amount);
        return mapToFdResponse(saved);
    }

    @Transactional
    public FixedDepositResponse closeFixedDeposit(String username, Long fdId) {
        Customer customer = getCustomerForUsername(username);
        FixedDeposit fd = fixedDepositRepository.findById(fdId)
                .orElseThrow(() -> new IllegalArgumentException("Fixed Deposit not found with ID: " + fdId));

        if (!fd.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("You can only close your own Fixed Deposits");
        }

        if (!"ACTIVE".equalsIgnoreCase(fd.getStatus())) {
            throw new IllegalArgumentException("Fixed Deposit cannot be closed because its status is " + fd.getStatus());
        }

        // Calculate premature closure payout:
        // Interest penalty of 1.0% per annum from original rate
        double penalizedRate = Math.max(0.5, fd.getInterestRate() - 1.0);
        long daysElapsed = java.time.temporal.ChronoUnit.DAYS.between(fd.getStartDate(), LocalDate.now());

        BigDecimal payout;
        if (daysElapsed < 7) {
            // Under 7 days, no interest is payable per RBI regulations
            payout = fd.getPrincipalAmount();
        } else {
            // Quarterly compounding for the elapsed period
            double yearsElapsed = daysElapsed / 365.25;
            double p = fd.getPrincipalAmount().doubleValue();
            double r = penalizedRate / 100.0;
            double amountWithPenalizedInterest = p * Math.pow(1.0 + (r / 4.0), 4.0 * yearsElapsed);
            payout = BigDecimal.valueOf(amountWithPenalizedInterest).setScale(2, RoundingMode.HALF_UP);
        }

        // Credit to source account
        Account source = fd.getSourceAccount();
        if (source == null || !"ACTIVE".equalsIgnoreCase(source.getStatus())) {
            List<Account> activeAccs = accountRepository.findByCustomerId(customer.getId()).stream()
                    .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                    .toList();
            if (activeAccs.isEmpty()) {
                throw new IllegalStateException("No active account available to credit the FD closure proceeds");
            }
            source = activeAccs.get(0);
        }

        source.setBalance(source.getBalance().add(payout));
        accountRepository.save(source);

        // Ledger entry: FD_CLOSE
        recordTransaction(source, null, "FD_CLOSE", payout, source.getBalance(),
                "Premature FD Closure: " + fd.getDepositNumber() + " (Principal: ₹" + fd.getPrincipalAmount() + ", Payout: ₹" + payout + ")");

        fd.setStatus("PREMATURELY_CLOSED");
        FixedDeposit updated = fixedDepositRepository.save(fd);
        recordAudit("CLOSE_FIXED_DEPOSIT", username, "Closed FD " + fd.getDepositNumber() + " with payout of ₹" + payout);

        FixedDepositResponse resp = mapToFdResponse(updated);
        resp.setPrematurePayout(payout);
        return resp;
    }

    @Transactional
    public int processMaturedFixedDeposits() {
        LocalDate today = LocalDate.now();
        List<FixedDeposit> matured = fixedDepositRepository.findByStatusAndMaturityDateLessThanEqual("ACTIVE", today);
        int count = 0;
        for (FixedDeposit fd : matured) {
            Account target = fd.getSourceAccount();
            if (target == null || !"ACTIVE".equalsIgnoreCase(target.getStatus())) {
                List<Account> activeAccs = accountRepository.findByCustomerId(fd.getCustomer().getId()).stream()
                        .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                        .toList();
                if (!activeAccs.isEmpty()) target = activeAccs.get(0);
            }
            if (target != null) {
                target.setBalance(target.getBalance().add(fd.getMaturityAmount()));
                accountRepository.save(target);
                recordTransaction(target, null, "FD_MATURITY", fd.getMaturityAmount(), target.getBalance(),
                        "Fixed Deposit Maturity Payout: " + fd.getDepositNumber());
            }
            fd.setStatus("MATURED");
            fixedDepositRepository.save(fd);
            count++;
        }
        return count;
    }

    private FixedDepositResponse mapToFdResponse(FixedDeposit fd) {
        Customer c = fd.getCustomer();
        Account src = fd.getSourceAccount();
        return new FixedDepositResponse(
                fd.getId(),
                fd.getDepositNumber(),
                c != null ? c.getId() : null,
                c != null ? c.getName() : "Unknown",
                src != null ? src.getId() : null,
                src != null ? src.getAccountNumber() : null,
                fd.getPrincipalAmount(),
                fd.getInterestRate(),
                fd.getTenureMonths(),
                fd.getMaturityAmount(),
                fd.getStartDate(),
                fd.getMaturityDate(),
                fd.getStatus(),
                null,
                fd.getCreatedAt()
        );
    }

    // -------------------- HELPERS & UTILITIES --------------------

    public Customer getCustomerForUsername(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("User account not found"));
        if (user.getCustomer() == null) {
            throw new IllegalArgumentException("No customer linked to username: " + username);
        }
        return user.getCustomer();
    }

    public List<Account> getMyAccounts(String username) {
        return accountRepository.findByCustomerId(getCustomerForUsername(username).getId());
    }

    public List<CustomerAccountResponse> getActiveCustomerAccounts(String username) {
        Customer customer = getCustomerForUsername(username);
        List<Account> accounts = accountRepository.findByCustomerId(customer.getId());
        return accounts.stream()
                .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                .map(a -> {
                    String num = a.getAccountNumber();
                    String masked = num;
                    if (num != null && num.length() > 4) {
                        masked = "•••• " + num.substring(num.length() - 4);
                    }
                    return new CustomerAccountResponse(
                            a.getId(),
                            a.getAccountNumber(),
                            masked,
                            a.getType(),
                            a.getBalance(),
                            a.getMinimumBalance(),
                            a.getDailyTransferLimit(),
                            a.getStatus()
                    );
                }).toList();
    }

    public List<Loan> getMyLoans(String username) {
        return loanRepository.findByCustomerId(getCustomerForUsername(username).getId());
    }

    private Account getOwnedActiveAccount(String username, Long accountId) {
        Customer customer = getCustomerForUsername(username);
        Account account = getActiveAccount(accountId);
        if (!account.getCustomer().getId().equals(customer.getId())) {
            throw new IllegalArgumentException("You can perform transactions only on your own account");
        }
        return account;
    }

    private Account getActiveAccount(Long id) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Account not found with ID: " + id));
        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalArgumentException("Account is not active (" + account.getStatus() + ")");
        }
        return account;
    }

    private void validatePositiveAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
    }

    private void recordTransaction(Account account, Account targetAccount, String type, BigDecimal amount, BigDecimal balanceAfter, String desc) {
        String refId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        Transaction t = new Transaction(refId, account, targetAccount, type, amount, balanceAfter, desc);
        transactionRepository.save(t);
    }

    private void logAudit(String username, String role, String action, String resource, String details) {
        AuditLog log = new AuditLog(username, role, action, resource, details, "127.0.0.1");
        auditLogRepository.save(log);
    }

    private void sendNotification(String username, String title, String message, String type) {
        userRepository.findByUsernameIgnoreCase(username).ifPresent(user -> {
            Notification notification = new Notification(user, title, message, type);
            notificationRepository.save(notification);
        });
    }

    // -------------------- DASHBOARD & AUDIT --------------------

    public long customerCount() {
        return customerRepository.count();
    }

    public long activeAccountCount() {
        return accountRepository.countByStatus("ACTIVE");
    }

    public long activeLoanCount() {
        return loanRepository.countByStatus("ACTIVE");
    }

    public PagedResponse<AuditLog> getAuditLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> p = auditLogRepository.findAllByOrderByTimestampDesc(pageable);
        return new PagedResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }

    public List<Notification> getMyNotifications(String username) {
        AppUser user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return notificationRepository.findByUserIdOrderByTimestampDesc(user.getId());
    }
}
