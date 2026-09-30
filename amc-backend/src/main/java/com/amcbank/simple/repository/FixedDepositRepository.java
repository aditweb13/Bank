package com.amcbank.simple.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.FixedDeposit;

@Repository
public interface FixedDepositRepository extends JpaRepository<FixedDeposit, Long> {
    List<FixedDeposit> findByCustomerId(Long customerId);
    List<FixedDeposit> findByStatusAndMaturityDateLessThanEqual(String status, LocalDate maturityDate);
}
