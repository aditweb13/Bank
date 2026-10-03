package com.arbcbank.simple.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.arbcbank.simple.dto.TransferRequest;
import com.arbcbank.simple.model.*;
import com.arbcbank.simple.repository.*;

@ExtendWith(MockitoExtension.class)
public class BankServiceTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private LoanRepository loanRepository;
    @Mock private UserRepository userRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private BeneficiaryRepository beneficiaryRepository;
    @Mock private EmiScheduleRepository emiScheduleRepository;
    @Mock private FixedDepositRepository fixedDepositRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private PasswordEncoder passwordEncoder;

    private BankService bankService;

    private Customer demoCustomer;
    private AppUser demoUser;
    private Account sourceAccount;
    private Account targetAccount;

    @BeforeEach
    void setUp() {
        bankService = new BankService(
                customerRepository, accountRepository, loanRepository, userRepository,
                transactionRepository, beneficiaryRepository, emiScheduleRepository,
                fixedDepositRepository, notificationRepository, auditLogRepository,
                passwordEncoder
        );

        demoCustomer = new Customer();
        demoCustomer.setId(1L);
        demoCustomer.setName("Khushi Sharma");
        demoCustomer.setEmail("Khushi@example.com");
        demoCustomer.setPanNumber("ABCDE1234F");
        demoCustomer.setPhoneNumber("+919876543210");

        demoUser = new AppUser("Khushi@example.com", "hash", "ROLE_CUSTOMER", demoCustomer);

        sourceAccount = new Account();
        sourceAccount.setId(10L);
        sourceAccount.setAccountNumber("AC1000000001");
        sourceAccount.setType("SAVINGS");
        sourceAccount.setBalance(new BigDecimal("50000.00"));
        sourceAccount.setMinimumBalance(new BigDecimal("1000.00"));
        sourceAccount.setDailyTransferLimit(new BigDecimal("100000.00"));
        sourceAccount.setStatus("ACTIVE");
        sourceAccount.setCustomer(demoCustomer);

        targetAccount = new Account();
        targetAccount.setId(20L);
        targetAccount.setAccountNumber("AC2000000002");
        targetAccount.setType("SAVINGS");
        targetAccount.setBalance(new BigDecimal("10000.00"));
        targetAccount.setStatus("ACTIVE");
    }

    @Test
    @DisplayName("Fund Transfer - Success")
    void testExecuteTransfer_Success() {
        TransferRequest req = new TransferRequest();
        req.setSourceAccountNumber("AC1000000001");
        req.setTargetAccountNumber("AC2000000002");
        req.setAmount(new BigDecimal("5000.00"));
        req.setDescription("Rent payment");

        when(accountRepository.findByAccountNumber("AC1000000001")).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC2000000002")).thenReturn(Optional.of(targetAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));
        when(transactionRepository.sumDailyTransferAmount(eq(10L), any(LocalDateTime.class))).thenReturn(BigDecimal.ZERO);

        Transaction txn = bankService.executeTransfer("Khushi@example.com", req);

        assertNotNull(txn);
        assertEquals(new BigDecimal("45000.00"), sourceAccount.getBalance());
        assertEquals(new BigDecimal("15000.00"), targetAccount.getBalance());
        verify(transactionRepository, times(2)).save(any(Transaction.class));
        verify(accountRepository, times(1)).save(sourceAccount);
        verify(accountRepository, times(1)).save(targetAccount);
    }

    @Test
    @DisplayName("Fund Transfer - Rejects when insufficient funds")
    void testExecuteTransfer_InsufficientFunds() {
        TransferRequest req = new TransferRequest();
        req.setSourceAccountNumber("AC1000000001");
        req.setTargetAccountNumber("AC2000000002");
        req.setAmount(new BigDecimal("60000.00"));

        when(accountRepository.findByAccountNumber("AC1000000001")).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC2000000002")).thenReturn(Optional.of(targetAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            bankService.executeTransfer("Khushi@example.com", req);
        });

        assertTrue(ex.getMessage().contains("Insufficient funds"));
    }

    @Test
    @DisplayName("Fund Transfer - Rejects same account transfer")
    void testExecuteTransfer_SameAccount() {
        TransferRequest req = new TransferRequest();
        req.setSourceAccountNumber("AC1000000001");
        req.setTargetAccountNumber("AC1000000001");
        req.setAmount(new BigDecimal("1000.00"));

        when(accountRepository.findByAccountNumber("AC1000000001")).thenReturn(Optional.of(sourceAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            bankService.executeTransfer("Khushi@example.com", req);
        });

        assertTrue(ex.getMessage().contains("cannot be the same"));
    }

    @Test
    @DisplayName("Fund Transfer - Rejects when daily limit exceeded")
    void testExecuteTransfer_ExceedsDailyLimit() {
        TransferRequest req = new TransferRequest();
        req.setSourceAccountNumber("AC1000000001");
        req.setTargetAccountNumber("AC2000000002");
        req.setAmount(new BigDecimal("30000.00"));

        when(accountRepository.findByAccountNumber("AC1000000001")).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findByAccountNumber("AC2000000002")).thenReturn(Optional.of(targetAccount));
        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));
        when(transactionRepository.sumDailyTransferAmount(eq(10L), any(LocalDateTime.class)))
                .thenReturn(new BigDecimal("80000.00")); // 80k already transferred today out of 100k limit

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            bankService.executeTransfer("Khushi@example.com", req);
        });

        assertTrue(ex.getMessage().contains("daily transfer limit"));
    }

    @Test
    @DisplayName("Loan Application - Success")
    void testApplyLoan_Success() {
        Loan loan = new Loan();
        loan.setType("PERSONAL");
        loan.setPrincipal(new BigDecimal("50000.00"));
        loan.setInterestRate(10.5);
        loan.setTenureMonths(24);

        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));
        when(loanRepository.countByCustomerIdAndStatus(1L, "ACTIVE")).thenReturn(0L);
        when(accountRepository.findByCustomerId(1L)).thenReturn(List.of(sourceAccount)); // has 50k balance >= 10% of 50k (5k)
        when(loanRepository.save(any(Loan.class))).thenAnswer(i -> {
            Loan l = i.getArgument(0);
            l.setId(100L);
            return l;
        });

        Loan applied = bankService.applyForLoan("Khushi@example.com", loan);

        assertNotNull(applied);
        assertEquals("APPLIED", applied.getStatus());
        assertNotNull(applied.getMonthlyEmi());
        assertTrue(applied.getMonthlyEmi().compareTo(BigDecimal.ZERO) > 0);
        verify(emiScheduleRepository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("Loan Application - Fails when active balance < 10% principal")
    void testApplyLoan_InsufficientBalance() {
        Loan loan = new Loan();
        loan.setType("HOME");
        loan.setPrincipal(new BigDecimal("1000000.00")); // Requires 100,000 active balance
        loan.setInterestRate(8.5);
        loan.setTenureMonths(120);

        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));
        when(loanRepository.countByCustomerIdAndStatus(1L, "ACTIVE")).thenReturn(0L);
        when(accountRepository.findByCustomerId(1L)).thenReturn(List.of(sourceAccount)); // only has 50,000 balance

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            bankService.applyForLoan("Khushi@example.com", loan);
        });

        assertTrue(ex.getMessage().contains("at least 10% of loan principal"));
    }

    @Test
    @DisplayName("Loan Application - Fails when customer already has 3 active loans")
    void testApplyLoan_ExceedsMaxActiveLoans() {
        Loan loan = new Loan();
        loan.setType("AUTO");
        loan.setPrincipal(new BigDecimal("50000.00"));
        loan.setInterestRate(9.0);
        loan.setTenureMonths(36);

        when(userRepository.findByUsername("Khushi@example.com")).thenReturn(Optional.of(demoUser));
        when(loanRepository.countByCustomerIdAndStatus(1L, "ACTIVE")).thenReturn(3L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            bankService.applyForLoan("Khushi@example.com", loan);
        });

        assertTrue(ex.getMessage().contains("already has 3 active loans"));
    }

    @Test
    @DisplayName("Loan EMI Calculation Verification")
    void testCalculateEmi() {
        Loan loan = new Loan();
        loan.setPrincipal(new BigDecimal("100000.00"));
        loan.setInterestRate(12.0); // 1% per month
        loan.setTenureMonths(12);

        loan.calculateEmi();

        assertNotNull(loan.getMonthlyEmi());
        // For P=100,000, r=0.01, n=12 -> EMI approx 8884.88
        assertEquals(new BigDecimal("8884.88"), loan.getMonthlyEmi());
    }
}
