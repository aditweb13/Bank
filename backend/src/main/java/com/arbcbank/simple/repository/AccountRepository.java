package com.arbcbank.simple.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.arbcbank.simple.model.Account;

import jakarta.persistence.LockModeType;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByCustomerId(Long customerId);
    Optional<Account> findByAccountNumber(String accountNumber);
    boolean existsByAccountNumber(String accountNumber);
    long countByStatus(String status);
    @Query(value = "SELECT a FROM Account a LEFT JOIN FETCH a.customer c WHERE " +
           "(:status IS NULL OR :status = '' OR a.status = :status) AND (" +
           "LOWER(a.accountNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "(c.name IS NOT NULL AND LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(c.email IS NOT NULL AND LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))))",
           countQuery = "SELECT count(a) FROM Account a LEFT JOIN a.customer c WHERE " +
           "(:status IS NULL OR :status = '' OR a.status = :status) AND (" +
           "LOWER(a.accountNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "(c.name IS NOT NULL AND LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(c.email IS NOT NULL AND LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))))")
    Page<Account> findAccountsWithCustomer(@Param("search") String search, @Param("status") String status, Pageable pageable);

    /** Pessimistic write lock for transfer — prevents concurrent double-spend */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    /** Lookup by account number — masked name only; never return balance */
    @Query("SELECT a FROM Account a WHERE a.accountNumber = :accountNumber")
    Optional<Account> findByAccountNumberReadOnly(@Param("accountNumber") String accountNumber);
}

