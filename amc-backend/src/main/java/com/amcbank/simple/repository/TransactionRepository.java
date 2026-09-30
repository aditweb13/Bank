package com.amcbank.simple.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.Transaction;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findByAccountIdOrderByTimestampDesc(Long accountId);

    @Query("SELECT t FROM Transaction t WHERE (t.account.id = :accountId OR t.targetAccount.id = :accountId) ORDER BY t.timestamp DESC")
    Page<Transaction> findByAccountIdOrTargetAccountId(@Param("accountId") Long accountId, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.account.customer.id = :customerId OR (t.targetAccount IS NOT NULL AND t.targetAccount.customer.id = :customerId) ORDER BY t.timestamp DESC")
    Page<Transaction> findByCustomerId(@Param("customerId") Long customerId, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.account.customer.id = :customerId OR (t.targetAccount IS NOT NULL AND t.targetAccount.customer.id = :customerId) ORDER BY t.timestamp DESC")
    List<Transaction> findAllByCustomerId(@Param("customerId") Long customerId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.account.id = :accountId AND t.transactionType = 'TRANSFER_OUT' AND t.timestamp >= :since")
    BigDecimal sumDailyTransferAmount(@Param("accountId") Long accountId, @Param("since") LocalDateTime since);

    Page<Transaction> findAllByOrderByTimestampDesc(Pageable pageable);
}
