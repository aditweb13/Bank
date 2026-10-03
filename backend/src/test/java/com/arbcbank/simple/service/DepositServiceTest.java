package com.arbcbank.simple.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.arbcbank.simple.dto.CreateDepositRequest;
import com.arbcbank.simple.dto.DepositRequestResponse;
import com.arbcbank.simple.dto.ReconciliationResponse;
import com.arbcbank.simple.exception.ResourceNotFoundException;
import com.arbcbank.simple.model.*;
import com.arbcbank.simple.repository.*;

@ExtendWith(MockitoExtension.class)
public class DepositServiceTest {

    @Mock
    private DepositRequestRepository depositRequestRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @InjectMocks
    private DepositService depositService;

    private Customer testCustomer;
    private AppUser testUser;
    private Account testAccount;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(depositService, "minDepositAmount", new BigDecimal("100.00"));
        ReflectionTestUtils.setField(depositService, "maxDepositAmount", new BigDecimal("10000000.00"));
        ReflectionTestUtils.setField(depositService, "largeDepositThreshold", new BigDecimal("1000000.00"));
        ReflectionTestUtils.setField(depositService, "separationOfDuties", true);

        testCustomer = new Customer();
        testCustomer.setId(10L);
        testCustomer.setFullName("Khushi Sharma");
        testCustomer.setEmail("Khushi@example.com");

        testUser = new AppUser();
        testUser.setId(100L);
        testUser.setUsername("Khushi@example.com");
        testUser.setCustomer(testCustomer);

        testAccount = new Account();
        testAccount.setId(1L);
        testAccount.setAccountNumber("AC1002003001");
        testAccount.setAccountType("SAVINGS");
        testAccount.setBalance(new BigDecimal("50000.00"));
        testAccount.setStatus("ACTIVE");
        testAccount.setCustomer(testCustomer);
    }

    @Test
    @DisplayName("Create deposit request: leaves account balance unchanged and marks PENDING")
    void testCreateDepositRequest_Success() {
        CreateDepositRequest req = new CreateDepositRequest();
        req.setAccountId(1L);
        req.setAmount(new BigDecimal("5000.00"));
        req.setMode("CASH");
        req.setRemarks("Counter cash deposit");

        when(accountRepository.findById(1L)).thenReturn(Optional.of(testAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(testUser));
        when(depositRequestRepository.save(any(DepositRequest.class))).thenAnswer(invocation -> {
            DepositRequest saved = invocation.getArgument(0);
            saved.setId(50L);
            return saved;
        });

        DepositRequestResponse response = depositService.createDepositRequest(req, "Khushi@example.com", false);

        assertNotNull(response);
        assertEquals("PENDING", response.getStatus());
        assertEquals(new BigDecimal("5000.00"), response.getAmount());
        assertEquals("AC1002003001", response.getAccountNumber());
        // Verify account balance was NOT modified
        assertEquals(new BigDecimal("50000.00"), testAccount.getBalance());
        verify(accountRepository, never()).save(any(Account.class));
        verify(transactionRepository, never()).save(any(Transaction.class));
        verify(notificationRepository, times(1)).save(any(Notification.class));
    }

    @Test
    @DisplayName("Create deposit request: rejects below minimum or negative amount")
    void testCreateDepositRequest_InvalidAmount() {
        CreateDepositRequest zeroReq = new CreateDepositRequest();
        zeroReq.setAccountId(1L);
        zeroReq.setAmount(new BigDecimal("0.00"));

        IllegalArgumentException ex1 = assertThrows(IllegalArgumentException.class, () ->
                depositService.createDepositRequest(zeroReq, "Khushi@example.com", false));
        assertTrue(ex1.getMessage().contains("greater than zero"));

        CreateDepositRequest belowMinReq = new CreateDepositRequest();
        belowMinReq.setAccountId(1L);
        belowMinReq.setAmount(new BigDecimal("50.00")); // min is 100

        IllegalArgumentException ex2 = assertThrows(IllegalArgumentException.class, () ->
                depositService.createDepositRequest(belowMinReq, "Khushi@example.com", false));
        assertTrue(ex2.getMessage().contains("below minimum allowed deposit"));
    }

    @Test
    @DisplayName("Create deposit request: rejects non-active accounts")
    void testCreateDepositRequest_AccountFrozen() {
        testAccount.setStatus("FROZEN");
        when(accountRepository.findById(1L)).thenReturn(Optional.of(testAccount));

        CreateDepositRequest req = new CreateDepositRequest();
        req.setAccountId(1L);
        req.setAmount(new BigDecimal("500.00"));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                depositService.createDepositRequest(req, "Khushi@example.com", false));
        assertTrue(ex.getMessage().contains("Account is not active"));
    }

    @Test
    @DisplayName("Create deposit request: blocks customer attempting to deposit into unowned account")
    void testCreateDepositRequest_UnauthorizedCustomer() {
        Customer otherCustomer = new Customer();
        otherCustomer.setId(99L);
        testAccount.setCustomer(otherCustomer);

        when(accountRepository.findById(1L)).thenReturn(Optional.of(testAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(testUser));

        CreateDepositRequest req = new CreateDepositRequest();
        req.setAccountId(1L);
        req.setAmount(new BigDecimal("500.00"));

        SecurityException ex = assertThrows(SecurityException.class, () ->
                depositService.createDepositRequest(req, "Khushi@example.com", false));
        assertTrue(ex.getMessage().contains("Unauthorized: account does not belong to you"));
    }

    @Test
    @DisplayName("Approve deposit request: credits balance, writes ledger transaction, sends notification")
    void testApproveDepositRequest_Success() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setReferenceNo("DEP-998877");
        dr.setAccount(testAccount);
        dr.setCustomer(testCustomer);
        dr.setAmount(new BigDecimal("15000.00"));
        dr.setMode("CHEQUE");
        dr.setPaymentReference("CHQ123456");
        dr.setStatus("PENDING");
        dr.setRequestedAt(LocalDateTime.now().minusHours(1));

        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));
        when(accountRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testAccount));
        when(depositRequestRepository.save(any(DepositRequest.class))).thenAnswer(i -> i.getArgument(0));

        DepositRequestResponse response = depositService.approveDepositRequest(50L, "bank_admin", "Verified cheque clearance");

        assertNotNull(response);
        assertEquals("APPROVED", response.getStatus());
        assertEquals("bank_admin", response.getReviewedBy());

        // Balance must increase: 50,000 + 15,000 = 65,000
        assertEquals(new BigDecimal("65000.00"), testAccount.getBalance());
        verify(accountRepository, times(1)).save(testAccount);

        // Transaction ledger record must be written
        verify(transactionRepository, times(1)).save(argThat(tx ->
                tx.getTransactionType().equals("DEPOSIT") &&
                tx.getAmount().compareTo(new BigDecimal("15000.00")) == 0 &&
                tx.getBalanceAfter().compareTo(new BigDecimal("65000.00")) == 0 &&
                tx.getReferenceId().equals("DEP-998877")
        ));

        // Customer notification must be created
        verify(notificationRepository, times(1)).save(any(Notification.class));
    }

    @Test
    @DisplayName("Approve deposit request: blocks double-approval")
    void testApproveDepositRequest_DoubleApprovalBlocked() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setStatus("APPROVED");

        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                depositService.approveDepositRequest(50L, "admin", "Again"));
        assertTrue(ex.getMessage().contains("already been processed"));
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    @DisplayName("Approve deposit request: enforces separation of duties when requested by admin")
    void testApproveDepositRequest_SeparationOfDutiesViolation() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setStatus("PENDING");
        dr.setRequestedByAdmin("maker_admin");

        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));

        SecurityException ex = assertThrows(SecurityException.class, () ->
                depositService.approveDepositRequest(50L, "maker_admin", "Self approve"));
        assertTrue(ex.getMessage().contains("maker admin cannot approve their own deposit request"));
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    @DisplayName("Approve deposit request: allows approval by different admin")
    void testApproveDepositRequest_SeparationOfDutiesAllowedDifferentAdmin() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setReferenceNo("DEP-112233");
        dr.setAccount(testAccount);
        dr.setCustomer(testCustomer);
        dr.setAmount(new BigDecimal("2000.00"));
        dr.setStatus("PENDING");
        dr.setRequestedByAdmin("maker_admin");

        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));
        when(accountRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(testAccount));
        when(depositRequestRepository.save(any(DepositRequest.class))).thenAnswer(i -> i.getArgument(0));

        DepositRequestResponse resp = depositService.approveDepositRequest(50L, "checker_admin", "Approved by checker");
        assertEquals("APPROVED", resp.getStatus());
        assertEquals("checker_admin", resp.getReviewedBy());
        assertEquals(new BigDecimal("52000.00"), testAccount.getBalance());
    }

    @Test
    @DisplayName("Reject deposit request: requires mandatory reason and does not touch balance")
    void testRejectDepositRequest_Success() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setReferenceNo("DEP-778899");
        dr.setAccount(testAccount);
        dr.setCustomer(testCustomer);
        dr.setAmount(new BigDecimal("10000.00"));
        dr.setStatus("PENDING");

        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));
        when(depositRequestRepository.save(any(DepositRequest.class))).thenAnswer(i -> i.getArgument(0));

        // Missing reason should fail
        assertThrows(IllegalArgumentException.class, () ->
                depositService.rejectDepositRequest(50L, "admin", ""));

        DepositRequestResponse resp = depositService.rejectDepositRequest(50L, "admin", "Cheque bounced");

        assertEquals("REJECTED", resp.getStatus());
        assertEquals("Cheque bounced", resp.getReviewRemarks());
        // Balance remains unchanged
        assertEquals(new BigDecimal("50000.00"), testAccount.getBalance());
        verify(accountRepository, never()).save(any(Account.class));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Cancel deposit request: customer cancels own pending request")
    void testCancelDepositRequest_Success() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        dr.setAccount(testAccount);
        dr.setCustomer(testCustomer);
        dr.setAmount(new BigDecimal("3000.00"));
        dr.setStatus("PENDING");

        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(testUser));
        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));
        when(depositRequestRepository.save(any(DepositRequest.class))).thenAnswer(i -> i.getArgument(0));

        DepositRequestResponse resp = depositService.cancelDepositRequest(50L, "Khushi@example.com");

        assertEquals("CANCELLED", resp.getStatus());
        assertEquals(new BigDecimal("50000.00"), testAccount.getBalance());
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    @DisplayName("Cancel deposit request: blocks cancellation if not pending or not owner")
    void testCancelDepositRequest_UnauthorizedOrNotPending() {
        DepositRequest dr = new DepositRequest();
        dr.setId(50L);
        Customer otherCustomer = new Customer();
        otherCustomer.setId(99L);
        dr.setCustomer(otherCustomer);
        dr.setStatus("PENDING");

        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(testUser));
        when(depositRequestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(dr));

        SecurityException ex1 = assertThrows(SecurityException.class, () ->
                depositService.cancelDepositRequest(50L, "Khushi@example.com"));
        assertTrue(ex1.getMessage().contains("Unauthorized: deposit request does not belong to you"));

        // Now test already approved
        dr.setCustomer(testCustomer);
        dr.setStatus("APPROVED");

        IllegalStateException ex2 = assertThrows(IllegalStateException.class, () ->
                depositService.cancelDepositRequest(50L, "Khushi@example.com"));
        assertTrue(ex2.getMessage().contains("Only PENDING deposit requests can be cancelled"));
    }

    @Test
    @DisplayName("Ledger Reconciliation: computes net ledger sum vs account balance")
    void testReconcileAccount_Matched() {
        when(accountRepository.findById(1L)).thenReturn(Optional.of(testAccount));

        // Create transactions: Opening/Deposit: 40000, Transfer Credit: 15000, Transfer Debit: 5000 -> Total = 50000
        Transaction tx1 = new Transaction();
        tx1.setTransactionType("DEPOSIT");
        tx1.setAmount(new BigDecimal("40000.00"));

        Transaction tx2 = new Transaction();
        tx2.setTransactionType("TRANSFER_CREDIT");
        tx2.setAmount(new BigDecimal("15000.00"));

        Transaction tx3 = new Transaction();
        tx3.setTransactionType("TRANSFER_DEBIT");
        tx3.setAmount(new BigDecimal("5000.00"));

        when(transactionRepository.findByAccountIdOrderByTransactionDateAsc(1L))
                .thenReturn(List.of(tx1, tx2, tx3));

        ReconciliationResponse recon = depositService.reconcileAccount(1L);

        assertNotNull(recon);
        assertEquals(new BigDecimal("50000.00"), recon.getAccountBalance());
        assertEquals(new BigDecimal("50000.00"), recon.getCalculatedLedgerBalance());
        assertEquals(new BigDecimal("0.00"), recon.getDiscrepancy());
        assertTrue(recon.isBalanced());
        assertEquals(3, recon.getTransactionCount());
    }
}
