package com.amcbank.simple.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.DepositRequest;

import jakarta.persistence.LockModeType;

@Repository
public interface DepositRequestRepository extends JpaRepository<DepositRequest, Long> {

    /** Customer's own requests, newest first */
    Page<DepositRequest> findByCustomerIdOrderByRequestedAtDesc(Long customerId, Pageable pageable);

    /** Customer's requests filtered by status */
    Page<DepositRequest> findByCustomerIdAndStatusOrderByRequestedAtDesc(
            Long customerId, String status, Pageable pageable);

    /** Admin: all requests, newest first */
    Page<DepositRequest> findAllByOrderByRequestedAtDesc(Pageable pageable);

    /** Admin: filter by status */
    Page<DepositRequest> findByStatusOrderByRequestedAtDesc(String status, Pageable pageable);

    /** Count pending for admin dashboard KPI */
    long countByStatus(String status);

    /** For double-approval guard: pessimistic lock on the request row */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT dr FROM DepositRequest dr WHERE dr.id = :id")
    Optional<DepositRequest> findByIdForUpdate(@Param("id") Long id);

    /** Admin: filter by status and account or customer name search */
    @Query("""
        SELECT dr FROM DepositRequest dr
        WHERE (:status IS NULL OR dr.status = :status)
          AND (
               LOWER(dr.customer.name) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(dr.account.accountNumber) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(dr.referenceNo) LIKE LOWER(CONCAT('%', :search, '%'))
          )
        ORDER BY dr.requestedAt DESC
        """)
    Page<DepositRequest> searchByStatusAndKeyword(
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable);
}
