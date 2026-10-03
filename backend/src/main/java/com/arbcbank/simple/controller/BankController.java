package com.arbcbank.simple.controller;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import com.arbcbank.simple.dto.*;
import com.arbcbank.simple.model.*;
import com.arbcbank.simple.repository.UserRepository;
import com.arbcbank.simple.security.JwtService;
import com.arbcbank.simple.service.BankService;
import com.arbcbank.simple.service.LoanService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
@Tag(name = "ARBC Bank API", description = "Enterprise Banking REST Endpoints")
public class BankController {

    private final BankService service;
    private final LoanService loanService;
    private final TransferService transferService;
    private final DepositService depositService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public BankController(BankService service,
                          LoanService loanService,
                          TransferService transferService,
                          DepositService depositService,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.service = service;
        this.loanService = loanService;
        this.transferService = transferService;
        this.depositService = depositService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    // -------------------- AUTHENTICATION --------------------

    @PostMapping("/login")
    @Operation(summary = "User Login", description = "Authenticates user and returns JWT + Refresh Token")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        AppUser user = userRepository
                .findByUsernameIgnoreCase(username == null ? "" : username.trim())
                .orElse(null);

        if (user == null || password == null || !passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username/email or password"));
        }

        String role = user.getRole();
        String token = jwtService.generateToken(user.getUsername(), role);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "refreshToken", "REFRESH_" + token.substring(0, 20),
                "username", user.getUsername(),
                "role", role,
                "customerName", user.getCustomer() != null ? user.getCustomer().getName() : "Administrator",
                "customerId", user.getCustomer() != null ? user.getCustomer().getId() : 0));
    }

    @GetMapping("/auth/me")
    @Operation(summary = "Current Auth Info")
    public Map<String, Object> authenticatedUser(Authentication authentication) {
        return Map.of(
                "username", authentication.getName(),
                "authorities", authentication.getAuthorities().stream().map(a -> a.getAuthority()).toList());
    }

    // -------------------- ADMIN APIS --------------------

    @GetMapping("/dashboard")
    public Map<String, Long> dashboard() {
        return Map.of(
                "customers", service.customerCount(),
                "activeAccounts", service.activeAccountCount(),
                "activeLoans", service.activeLoanCount());
    }

    @GetMapping("/customers")
    public Object customers(@RequestParam(defaultValue = "") String search,
                            @RequestParam(required = false) Integer page,
                            @RequestParam(required = false) Integer size) {
        if (page != null && size != null) {
            return service.getCustomersPaged(search, page, size);
        }
        return service.getCustomers(search);
    }

    @GetMapping("/customers/{id}")
    public Customer customer(@PathVariable Long id) {
        return service.getCustomer(id);
    }

    @PostMapping("/customers")
    public ResponseEntity<Customer> addCustomer(@Valid @RequestBody Customer customer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addCustomer(customer));
    }

    @PutMapping("/customers/{id}")
    public Customer updateCustomer(@PathVariable Long id, @Valid @RequestBody Customer customer) {
        return service.updateCustomer(id, customer);
    }

    @DeleteMapping("/customers/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable Long id) {
        service.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/accounts")
    public PagedResponse<AccountResponse> getAllAccounts(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.getAccountsPaged(search, status, page, size);
    }

    @GetMapping("/customers/{customerId}/accounts")
    public Object accounts(@PathVariable Long customerId) {
        return service.getAccounts(customerId);
    }

    @PostMapping("/customers/{customerId}/accounts")
    public ResponseEntity<Account> openAccount(@PathVariable Long customerId, @RequestBody Account account) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.openAccount(customerId, account));
    }

    @PutMapping("/accounts/{accountId}/status")
    public Account updateAccountStatus(@PathVariable Long accountId, @RequestParam String status) {
        return service.updateAccountStatus(accountId, status);
    }

    @PostMapping("/accounts/{accountId}/deposit")
    public Account deposit(@PathVariable Long accountId, @RequestParam BigDecimal amount) {
        return service.deposit(accountId, amount);
    }

    @PostMapping("/accounts/{accountId}/withdraw")
    public Account withdraw(@PathVariable Long accountId, @RequestParam BigDecimal amount) {
        return service.withdraw(accountId, amount);
    }

    @GetMapping("/loans")
    public Object allLoans() {
        return service.getAllLoans();
    }

    @GetMapping("/customers/{customerId}/loans")
    public Object loans(@PathVariable Long customerId) {
        return service.getLoans(customerId);
    }

    @PostMapping("/customers/{customerId}/loans")
    public ResponseEntity<Loan> sanctionLoan(@PathVariable Long customerId, @RequestBody Loan loan) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.sanctionLoan(customerId, loan));
    }

    @PutMapping("/loans/{loanId}/decision")
    public Loan updateLoanDecision(@PathVariable Long loanId,
                                   @RequestParam String decision,
                                   @RequestParam(required = false) String remarks) {
        return service.updateLoanDecision(loanId, decision, remarks);
    }

    @GetMapping("/audit-logs")
    public PagedResponse<AuditLog> auditLogs(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "10") int size) {
        return service.getAuditLogs(page, size);
    }

    // -------------------- CUSTOMER SELF-SERVICE APIS --------------------

    @GetMapping("/customer/me")
    public Customer myProfile(Authentication authentication) {
        return service.getCustomerForUsername(authentication.getName());
    }

    @GetMapping(value = {"/customer/accounts", "/customer/me/accounts"})
    public List<CustomerAccountResponse> myAccounts(Authentication authentication) {
        return service.getActiveCustomerAccounts(authentication.getName());
    }

    @GetMapping("/customer/me/loans")
    public Object myLoans(Authentication authentication) {
        return service.getMyLoans(authentication.getName());
    }

    @PostMapping("/customer/me/loans/apply")
    public ResponseEntity<Loan> applyForLoan(Authentication authentication, @RequestBody Loan loan) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.applyForLoan(authentication.getName(), loan));
    }

    // -------------------- LOAN EMI & REPAYMENT SYSTEM --------------------

    @PostMapping("/loans/emi-preview")
    @Operation(summary = "EMI Schedule Preview", description = "Calculate monthly EMI and preview amortization schedule without saving")
    public ResponseEntity<EmiPreviewResponse> previewEmi(@RequestBody Map<String, Object> req) {
        BigDecimal principal = new BigDecimal(req.get("principal").toString());
        double interestRate = Double.parseDouble(req.get("interestRate").toString());
        int tenureMonths = Integer.parseInt(req.get("tenureMonths").toString());
        return ResponseEntity.ok(loanService.previewSchedule(principal, interestRate, tenureMonths));
    }

    @GetMapping({"/loans/{loanId}/schedule", "/customer/loans/{loanId}/schedule"})
    @Operation(summary = "Get Loan Schedule", description = "Get full installment schedule for a loan")
    public ResponseEntity<List<InstallmentDto>> getLoanSchedule(@PathVariable Long loanId, Authentication authentication) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        String username = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(loanService.getLoanSchedule(loanId, username, isAdmin));
    }

    @GetMapping({"/loans/{loanId}/summary", "/customer/loans/{loanId}/summary"})
    @Operation(summary = "Get Loan Summary", description = "Get outstanding principal, next due EMI, payment progress and overdue status")
    public ResponseEntity<LoanSummaryResponse> getLoanSummary(@PathVariable Long loanId, Authentication authentication) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        String username = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(loanService.getLoanSummary(loanId, username, isAdmin));
    }

    @PostMapping("/customer/loans/{loanId}/repay")
    @Operation(summary = "Repay Next EMI", description = "Pay next due installment from customer's active account")
    public ResponseEntity<InstallmentDto> repayLoan(@PathVariable Long loanId,
                                                   Authentication authentication,
                                                   @Valid @RequestBody RepayRequest request) {
        return ResponseEntity.ok(loanService.repayNextInstallment(loanId, authentication.getName(), request));
    }

    @PostMapping("/customer/loans/{loanId}/prepay")
    @Operation(summary = "Part Prepayment", description = "Prepay principal to reduce tenure or reduce EMI")
    public ResponseEntity<LoanSummaryResponse> prepayLoan(@PathVariable Long loanId,
                                                         Authentication authentication,
                                                         @Valid @RequestBody PrepayRequest request) {
        return ResponseEntity.ok(loanService.prepayLoan(loanId, authentication.getName(), request));
    }

    @GetMapping("/customer/loans/{loanId}/foreclosure-quote")
    @Operation(summary = "Foreclosure Quote", description = "Get full early loan payoff quote as of today")
    public ResponseEntity<ForeclosureQuoteResponse> getForeclosureQuote(@PathVariable Long loanId, Authentication authentication) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(loanService.getForeclosureQuote(loanId, authentication.getName(), isAdmin));
    }

    @PostMapping("/customer/loans/{loanId}/foreclose")
    @Operation(summary = "Execute Loan Foreclosure", description = "Pay total settlement and close loan")
    public ResponseEntity<LoanSummaryResponse> forecloseLoan(@PathVariable Long loanId,
                                                            Authentication authentication,
                                                            @Valid @RequestBody ForeclosureRequest request) {
        return ResponseEntity.ok(loanService.forecloseLoan(loanId, authentication.getName(), request));
    }

    @GetMapping({"/customer/loans/{loanId}/schedule/csv", "/loans/{loanId}/schedule/csv"})
    @Operation(summary = "Download Amortization Schedule CSV", description = "Export loan schedule to CSV")
    public ResponseEntity<InputStreamResource> downloadScheduleCsv(@PathVariable Long loanId, Authentication authentication) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        ByteArrayInputStream in = loanService.exportScheduleCsv(loanId, authentication.getName(), isAdmin);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=loan_schedule_" + loanId + ".csv");
        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(new InputStreamResource(in));
    }

    @PutMapping("/customer/loans/{loanId}/auto-debit")
    @Operation(summary = "Configure Auto-Debit", description = "Enable or disable automatic EMI deduction on due date")
    public ResponseEntity<Loan> configureAutoDebit(@PathVariable Long loanId,
                                                   Authentication authentication,
                                                   @RequestParam boolean enable,
                                                   @RequestParam(required = false) Long accountId) {
        return ResponseEntity.ok(loanService.toggleAutoDebit(loanId, authentication.getName(), enable, accountId));
    }

    @GetMapping("/loans/overdue")
    @Operation(summary = "List Overdue Loans", description = "Admin report of all delinquent loans with days past due")
    public ResponseEntity<List<OverdueLoanItemDto>> getOverdueLoans() {
        return ResponseEntity.ok(loanService.getOverdueLoansList());
    }

    @PostMapping("/loans/process-overdue")
    @Operation(summary = "Trigger Overdue Job", description = "Admin manual trigger for overdue penalty assessment and auto-debit cycle")
    public ResponseEntity<Map<String, String>> processOverdueJob() {
        loanService.processOverdueAndAutoDebit();
        return ResponseEntity.ok(Map.of("message", "Overdue assessment and auto-debit processing cycle completed successfully"));
    }

    @PostMapping("/customer/me/accounts/{accountId}/deposit")
    @Operation(summary = "Direct Deposit (Disabled)", description = "Direct customer deposit is disabled. Deposits require bank approval via maker-checker workflow.")
    public Account depositMyAccount(Authentication authentication,
                                    @PathVariable Long accountId,
                                    @RequestParam BigDecimal amount) {
        throw new IllegalStateException("Direct deposits are disabled. Deposits require bank approval via maker-checker workflow. Please submit a deposit request via /api/customer/deposit-requests.");
    }

    @PostMapping("/customer/me/accounts/{accountId}/withdraw")
    public Account withdrawMyAccount(Authentication authentication,
                                     @PathVariable Long accountId,
                                     @RequestParam BigDecimal amount) {
        return service.withdraw(accountId, amount);
    }

    @PostMapping("/customer/me/transfer")
    public ResponseEntity<Transaction> transferFunds(Authentication authentication,
                                                     @Valid @RequestBody TransferRequest request) {
        return ResponseEntity.ok(service.executeTransfer(authentication.getName(), request));
    }

    // ─────────────────────────────────────────────────────────────
    // PART A: FUNDS TRANSFER ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/customer/transfers")
    @Operation(summary = "Transfer Funds", description = "Executes atomic fund transfer with idempotency, consistent-order locking, and limit enforcement")
    public ResponseEntity<TransferResponse> createTransfer(@Valid @RequestBody NewTransferRequest request,
                                                           Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(transferService.executeTransfer(request, authentication.getName()));
    }

    @GetMapping("/customer/transfers")
    @Operation(summary = "Customer Transfer History", description = "Paginated transfer history for authenticated customer")
    public PagedResponse<TransferResponse> getCustomerTransfers(Authentication authentication,
                                                                @RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "10") int size,
                                                                @RequestParam(required = false) Long accountId,
                                                                @RequestParam(required = false) String status) {
        return transferService.getCustomerTransfers(authentication.getName(), page, size, accountId, status);
    }

    @GetMapping("/customer/transfers/{id}")
    @Operation(summary = "Transfer Receipt Details", description = "Receipt details for a specific transfer")
    public ResponseEntity<TransferResponse> getTransferDetails(@PathVariable Long id,
                                                               Authentication authentication) {
        return ResponseEntity.ok(transferService.getTransferDetails(id, authentication.getName()));
    }

    @GetMapping("/transfers")
    @Operation(summary = "All Bank Transfers (Admin)", description = "Admin view of all bank transfers paginated")
    public PagedResponse<TransferResponse> getAllTransfers(@RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "10") int size) {
        return transferService.getAllTransfers(page, size);
    }

    @GetMapping("/accounts/lookup/{accountNumber}")
    @Operation(summary = "Account Lookup", description = "Validates destination account and returns masked payee name without exposing balance")
    public ResponseEntity<AccountLookupResponse> lookupAccount(@PathVariable String accountNumber) {
        return ResponseEntity.ok(transferService.lookupAccount(accountNumber));
    }

    // ─────────────────────────────────────────────────────────────
    // PART B: DEPOSIT REQUESTS (MAKER-CHECKER) ENDPOINTS
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/customer/deposit-requests")
    @Operation(summary = "Request Deposit (Customer Maker)", description = "Customer submits a deposit request for bank admin approval")
    public ResponseEntity<DepositRequestResponse> createCustomerDepositRequest(
            @Valid @RequestBody CreateDepositRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(depositService.createDepositRequest(request, authentication.getName(), false));
    }

    @GetMapping("/customer/deposit-requests")
    @Operation(summary = "Customer Deposit Requests", description = "List of deposit requests submitted by authenticated customer")
    public PagedResponse<DepositRequestResponse> getCustomerDepositRequests(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return depositService.getCustomerDepositRequests(authentication.getName(), page, size, status);
    }

    @PostMapping("/customer/deposit-requests/{id}/cancel")
    @Operation(summary = "Cancel Deposit Request", description = "Customer cancels their own pending deposit request")
    public ResponseEntity<DepositRequestResponse> cancelDepositRequest(
            @PathVariable Long id,
            Authentication authentication) {
        return ResponseEntity.ok(depositService.cancelDepositRequest(id, authentication.getName()));
    }

    @PostMapping("/deposit-requests")
    @Operation(summary = "Admin Deposit Request", description = "Admin submits a deposit request on behalf of a customer")
    public ResponseEntity<DepositRequestResponse> createAdminDepositRequest(
            @Valid @RequestBody CreateDepositRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(depositService.createDepositRequest(request, authentication.getName(), true));
    }

    @GetMapping("/deposit-requests")
    @Operation(summary = "Admin Deposit Requests Queue", description = "Admin view of deposit requests with status and keyword filters")
    public PagedResponse<DepositRequestResponse> getAllDepositRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return depositService.getAllDepositRequests(page, size, status, search);
    }

    @GetMapping("/deposit-requests/{id}")
    @Operation(summary = "Deposit Request Details", description = "Admin view of single deposit request details")
    public ResponseEntity<DepositRequestResponse> getDepositRequestById(@PathVariable Long id) {
        return ResponseEntity.ok(depositService.getDepositRequestById(id));
    }

    @PostMapping("/deposit-requests/{id}/approve")
    @Operation(summary = "Approve Deposit Request (Checker)", description = "Admin checker approves deposit and credits account balance")
    public ResponseEntity<DepositRequestResponse> approveDepositRequest(
            @PathVariable Long id,
            Authentication authentication,
            @RequestParam(required = false) String reviewRemarks) {
        return ResponseEntity.ok(depositService.approveDepositRequest(id, authentication.getName(), reviewRemarks));
    }

    @PostMapping("/deposit-requests/{id}/reject")
    @Operation(summary = "Reject Deposit Request (Checker)", description = "Admin checker rejects deposit request with mandatory reason")
    public ResponseEntity<DepositRequestResponse> rejectDepositRequest(
            @PathVariable Long id,
            Authentication authentication,
            @Valid @RequestBody RejectDepositRequest request) {
        return ResponseEntity.ok(depositService.rejectDepositRequest(id, authentication.getName(), request.getReason()));
    }

    @GetMapping("/deposit-requests/pending-count")
    @Operation(summary = "Pending Approvals Count", description = "Count of pending deposit requests for admin dashboard KPI")
    public ResponseEntity<Map<String, Long>> getPendingDepositCount() {
        return ResponseEntity.ok(Map.of("pendingCount", depositService.countPending()));
    }

    @GetMapping("/admin/reconcile/{accountId}")
    @Operation(summary = "Ledger Reconciliation", description = "Admin check verifying account balance equals sum of ledger entries")
    public ResponseEntity<ReconciliationResponse> reconcileAccount(@PathVariable Long accountId) {
        return ResponseEntity.ok(depositService.reconcileAccount(accountId));
    }

    @GetMapping("/customer/me/transactions")
    public PagedResponse<Transaction> getMyTransactions(Authentication authentication,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "10") int size) {
        return service.getCustomerTransactions(authentication.getName(), page, size);
    }

    @GetMapping("/customer/me/transactions/csv")
    public ResponseEntity<InputStreamResource> downloadCsvStatement(Authentication authentication,
                                                                     @RequestParam(required = false) Long accountId) {
        ByteArrayInputStream in = service.exportTransactionsCsv(authentication.getName(), accountId);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=amc_statement.csv");

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(new InputStreamResource(in));
    }

    @GetMapping("/customer/me/transactions/pdf")
    public ResponseEntity<InputStreamResource> downloadPdfStatement(Authentication authentication,
                                                                     @RequestParam(required = false) Long accountId) {
        ByteArrayInputStream in = service.exportTransactionsPdf(authentication.getName(), accountId);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "attachment; filename=amc_statement.pdf");

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_PDF)
                .body(new InputStreamResource(in));
    }

    @GetMapping("/customer/me/beneficiaries")
    public List<Beneficiary> getMyBeneficiaries(Authentication authentication) {
        return service.getBeneficiaries(authentication.getName());
    }

    @PostMapping("/customer/me/beneficiaries")
    public ResponseEntity<Beneficiary> addBeneficiary(Authentication authentication, @RequestBody Beneficiary beneficiary) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addBeneficiary(authentication.getName(), beneficiary));
    }

    @DeleteMapping("/customer/me/beneficiaries/{id}")
    public ResponseEntity<Void> deleteBeneficiary(Authentication authentication, @PathVariable Long id) {
        service.deleteBeneficiary(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = {"/customer/fixed-deposits", "/customer/me/fixed-deposits"})
    public List<FixedDepositResponse> getMyFixedDeposits(Authentication authentication) {
        return service.getFixedDeposits(authentication.getName());
    }

    @GetMapping(value = {"/customer/fixed-deposits/{id}", "/customer/me/fixed-deposits/{id}"})
    public FixedDepositResponse getMyFixedDepositById(Authentication authentication, @PathVariable Long id) {
        return service.getFixedDepositById(authentication.getName(), id);
    }

    @PostMapping(value = {"/customer/fixed-deposits", "/customer/me/fixed-deposits"})
    public ResponseEntity<FixedDepositResponse> createFixedDeposit(
            Authentication authentication,
            @RequestBody(required = false) OpenFdRequest body,
            @RequestParam(required = false) Long sourceAccountId,
            @RequestParam(required = false) BigDecimal amount,
            @RequestParam(required = false) Integer tenureMonths) {

        OpenFdRequest req = body;
        if (req == null) {
            req = new OpenFdRequest(sourceAccountId, amount, tenureMonths);
        } else {
            if (req.getSourceAccountId() == null && sourceAccountId != null) req.setSourceAccountId(sourceAccountId);
            if (req.getAmount() == null && amount != null) req.setAmount(amount);
            if (req.getTenureMonths() == null && tenureMonths != null) req.setTenureMonths(tenureMonths);
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.createFixedDeposit(authentication.getName(), req));
    }

    @PostMapping(value = {"/customer/fixed-deposits/{id}/close", "/customer/me/fixed-deposits/{id}/close"})
    public ResponseEntity<FixedDepositResponse> closeFixedDeposit(Authentication authentication, @PathVariable Long id) {
        return ResponseEntity.ok(service.closeFixedDeposit(authentication.getName(), id));
    }

    @GetMapping("/fixed-deposits")
    public List<FixedDepositResponse> getAllFixedDeposits() {
        return service.getAllFixedDeposits();
    }

    @GetMapping("/customer/me/notifications")
    public List<Notification> getMyNotifications(Authentication authentication) {
        return service.getMyNotifications(authentication.getName());
    }
}
