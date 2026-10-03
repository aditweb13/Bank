package com.arbcbank.simple.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.arbcbank.simple.model.EmiSchedule;

@Repository
public interface EmiScheduleRepository extends JpaRepository<EmiSchedule, Long> {
    List<EmiSchedule> findByLoanIdOrderByInstallmentNumberAsc(Long loanId);
    Optional<EmiSchedule> findFirstByLoanIdAndStatusOrderByInstallmentNumberAsc(Long loanId, String status);
}
