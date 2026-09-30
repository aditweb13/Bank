package com.amcbank.simple.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.Loan;

@Repository
public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findByCustomerId(Long customerId);
    Page<Loan> findByCustomerId(Long customerId, Pageable pageable);
    long countByCustomerIdAndStatus(Long customerId, String status);
    long countByStatus(String status);
    Page<Loan> findByStatus(String status, Pageable pageable);
}
