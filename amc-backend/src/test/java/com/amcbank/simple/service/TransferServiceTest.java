package com.amcbank.simple.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.amcbank.simple.dto.NewTransferRequest;
import com.amcbank.simple.dto.TransferResponse;
import com.amcbank.simple.exception.ResourceNotFoundException;
import com.amcbank.simple.model.*;
import com.amcbank.simple.repository.*;

@ExtendWith(MockitoExtension.class)
public class TransferServiceTest {

    @Mock
    private TransferRepository transferRepository;

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
    private TransferService transferService;

    private Customer senderCust;
    private Customer receiverCust;
    private AppUser senderUser;
    private Account sourceAccount;
    private Account destAccount;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(transferService, "perTransactionLimit", new BigDecimal("50000.00"));
        ReflectionTestUtils.setField(transferService, "dailyLimit", new BigDecimal("200000.00"));

        senderCust = new Customer();
        senderCust.setId(1L);
        senderCust.setName("Khushi Sharma");
        senderCust.setEmail("Khushi@example.com");

        senderUser = new AppUser();
        senderUser.setId(10L);
        senderUser.setUsername("Khushi@example.com");
        senderUser.setCustomer(senderCust);

        receiverCust = new Customer();
        receiverCust.setId(2L);
        receiverCust.setName("Priya Patel");
        receiverCust.setEmail("priya@example.com");

        sourceAccount = new Account();
        sourceAccount.setId(100L);
        sourceAccount.setAccountNumber("AC1002003001");
        sourceAccount.setBalance(new BigDecimal("50000.00"));
        sourceAccount.setMinimumBalance(new BigDecimal("1000.00"));
        sourceAccount.setStatus("ACTIVE");
        sourceAccount.setCustomer(senderCust);

        destAccount = new Account();
        destAccount.setId(200L);
        destAccount.setAccountNumber("AC1002003002");
        destAccount.setBalance(new BigDecimal("20000.00"));
        destAccount.setMinimumBalance(new BigDecimal("1000.00"));
        destAccount.setStatus("ACTIVE");
        destAccount.setCustomer(receiverCust);
    }

    @Test
    @DisplayName("Successful fund transfer: debits sender, credits receiver, writes two ledger entries linked by same ref")
    void testSuccessfulTransfer() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("5000.00"));
        req.setRemarks("Rent Payment");
        req.setIdempotencyKey("550e8400-e29b-41d4-a716-446655440000");

        when(transferRepository.findByIdempotencyKey(req.getIdempotencyKey())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC1002003002")).thenReturn(Optional.of(destAccount));
        when(transferRepository.sumSuccessfulOutboundSince(eq(100L), any(LocalDateTime.class))).thenReturn(BigDecimal.ZERO);

        when(accountRepository.findByIdForUpdate(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByIdForUpdate(200L)).thenReturn(Optional.of(destAccount));
        when(transferRepository.save(any(Transfer.class))).thenAnswer(i -> {
            Transfer t = i.getArgument(0);
            t.setId(1L);
            return t;
        });

        TransferResponse response = transferService.executeTransfer(req, "Khushi@example.com");

        assertNotNull(response);
        assertEquals("SUCCESS", response.getStatus());
        assertEquals(new BigDecimal("5000.00"), response.getAmount());
        assertEquals(new BigDecimal("45000.00"), sourceAccount.getBalance());
        assertEquals(new BigDecimal("25000.00"), destAccount.getBalance());

        // Verifies TWO ledger transactions saved
        verify(transactionRepository, times(2)).save(any(Transaction.class));
        verify(accountRepository, times(2)).save(any(Account.class));
    }

    @Test
    @DisplayName("Idempotent retry returns original transfer without double debiting")
    void testIdempotentRetry() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("5000.00"));
        req.setIdempotencyKey("repeat-key-1234");

        Transfer existing = new Transfer();
        existing.setId(99L);
        existing.setReferenceNo("TRF999999");
        existing.setIdempotencyKey("repeat-key-1234");
        existing.setFromAccount(sourceAccount);
        existing.setToAccount(destAccount);
        existing.setAmount(new BigDecimal("5000.00"));
        existing.setStatus("SUCCESS");

        when(transferRepository.findByIdempotencyKey("repeat-key-1234")).thenReturn(Optional.of(existing));

        TransferResponse response = transferService.executeTransfer(req, "Khushi@example.com");

        assertEquals("TRF999999", response.getReferenceNo());
        // Verify balance was NOT mutated and no new ledger transactions were written
        assertEquals(new BigDecimal("50000.00"), sourceAccount.getBalance());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Fails when transfer amount violates minimum balance requirement")
    void testInsufficientBalanceWithMinBalance() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("49500.00")); // Leaves only â‚¹500, below min balance â‚¹1000
        req.setIdempotencyKey("insufficient-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC1002003002")).thenReturn(Optional.of(destAccount));
        when(transferRepository.sumSuccessfulOutboundSince(eq(100L), any(LocalDateTime.class))).thenReturn(BigDecimal.ZERO);
        when(accountRepository.findByIdForUpdate(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByIdForUpdate(200L)).thenReturn(Optional.of(destAccount));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("Insufficient funds"));
        assertEquals(new BigDecimal("50000.00"), sourceAccount.getBalance());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Fails when source and destination are the same account")
    void testSameAccountTransferFails() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003001"); // same account number
        req.setAmount(new BigDecimal("1000.00"));
        req.setIdempotencyKey("same-account-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC1002003001")).thenReturn(Optional.of(sourceAccount));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("Source and destination cannot be the same"));
    }

    @Test
    @DisplayName("Fails when source or destination account is FROZEN or INACTIVE")
    void testFrozenAccountFails() {
        sourceAccount.setStatus("FROZEN");

        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("1000.00"));
        req.setIdempotencyKey("frozen-account-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("FROZEN"));
    }

    @Test
    @DisplayName("Fails when single transaction amount exceeds per-transaction limit")
    void testPerTransactionLimitEnforced() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("55000.00")); // exceeds 50,000 limit
        req.setIdempotencyKey("limit-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("exceeds maximum per-transaction limit"));
    }

    @Test
    @DisplayName("Fails when daily cumulative transfer limit would be exceeded")
    void testDailyLimitEnforced() {
        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("30000.00"));
        req.setIdempotencyKey("daily-limit-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC1002003002")).thenReturn(Optional.of(destAccount));
        // Already transferred 180,000 today; 180,000 + 30,000 = 210,000 > 200,000
        when(transferRepository.sumSuccessfulOutboundSince(eq(100L), any(LocalDateTime.class)))
                .thenReturn(new BigDecimal("180000.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("Daily transfer limit"));
    }

    @Test
    @DisplayName("Fails when customer attempts to transfer from an account they do not own")
    void testUnauthorizedAccountAccessBlocked() {
        Customer otherCustomer = new Customer();
        otherCustomer.setId(999L);
        sourceAccount.setCustomer(otherCustomer); // account belongs to someone else

        NewTransferRequest req = new NewTransferRequest();
        req.setFromAccountId(100L);
        req.setToAccountNumber("AC1002003002");
        req.setAmount(new BigDecimal("1000.00"));
        req.setIdempotencyKey("unauthorized-key");

        when(transferRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("Khushi@example.com")).thenReturn(Optional.of(senderUser));
        when(accountRepository.findById(100L)).thenReturn(Optional.of(sourceAccount));

        SecurityException ex = assertThrows(SecurityException.class, () ->
            transferService.executeTransfer(req, "Khushi@example.com")
        );

        assertTrue(ex.getMessage().contains("Unauthorized"));
    }
}
