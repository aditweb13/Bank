package com.arbcbank.simple.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.arbcbank.simple.model.LoanInstallment;

@Repository
public interface LoanInstallmentRepository extends JpaRepository<LoanInstallment, Long> {

    List<LoanInstallment> findByLoanIdOrderByInstallmentNoAsc(Long loanId);

    Page<LoanInstallment> findByLoanIdOrderByInstallmentNoAsc(Long loanId, Pageable pageable);

    Optional<LoanInstallment> findFirstByLoanIdAndStatusInOrderByInstallmentNoAsc(Long loanId, List<String> statuses);

    Optional<LoanInstallment> findByLoanIdAndInstallmentNo(Long loanId, int installmentNo);

    List<LoanInstallment> findByLoanIdAndStatusIn(Long loanId, List<String> statuses);

    long countByLoanIdAndStatus(Long loanId, String status);

    @Query("SELECT i FROM LoanInstallment i WHERE i.dueDate < :today AND i.status IN ('PENDING', 'PARTIALLY_PAID')")
    List<LoanInstallment> findOverdueInstallments(@Param("today") LocalDate today);

    @Query("SELECT DISTINCT i.loan.id FROM LoanInstallment i WHERE i.status = 'OVERDUE'")
    List<Long> findLoanIdsWithOverdueInstallments();

    void deleteByLoanIdAndInstallmentNoGreaterThanEqual(Long loanId, int installmentNo);
}
