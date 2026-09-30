package com.amcbank.simple.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.Account;
import com.amcbank.simple.model.Transfer;

import jakarta.persistence.LockModeType;

@Repository
public interface TransferRepository extends JpaRepository<Transfer, Long> {

    /** Idempotency check — return existing transfer if key was already used */
    Optional<Transfer> findByIdempotencyKey(String idempotencyKey);

    /** Customer's own outgoing or incoming transfers, newest first */
    @Query("""
        SELECT t FROM Transfer t
        WHERE t.fromAccount.id = :accountId OR t.toAccount.id = :accountId
        ORDER BY t.createdAt DESC
        """)
    Page<Transfer> findByAccountId(@Param("accountId") Long accountId, Pageable pageable);

    /** All transfers for a customer (across all their accounts) */
    @Query("""
        SELECT t FROM Transfer t
        WHERE t.fromAccount.customer.id = :customerId
           OR t.toAccount.customer.id   = :customerId
        ORDER BY t.createdAt DESC
        """)
    Page<Transfer> findByCustomerId(@Param("customerId") Long customerId, Pageable pageable);

    /** Sum of successful outbound transfers from an account since a point in time (daily limit check) */
    @Query("""
        SELECT COALESCE(SUM(t.amount), 0)
        FROM Transfer t
        WHERE t.fromAccount.id = :accountId
          AND t.status = 'SUCCESS'
          AND t.createdAt >= :since
        """)
    java.math.BigDecimal sumSuccessfulOutboundSince(
            @Param("accountId") Long accountId,
            @Param("since") LocalDateTime since);

    /** Admin: paginated list of ALL transfers, newest first */
    Page<Transfer> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Pessimistic-write lock by ID — used when we need to ensure idempotency without a race */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Transfer t WHERE t.idempotencyKey = :key")
    Optional<Transfer> findByIdempotencyKeyForUpdate(@Param("key") String key);
}
