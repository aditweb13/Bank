package com.arbcbank.simple.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.arbcbank.simple.model.Beneficiary;

@Repository
public interface BeneficiaryRepository extends JpaRepository<Beneficiary, Long> {
    List<Beneficiary> findByCustomerId(Long customerId);
    Optional<Beneficiary> findByCustomerIdAndAccountNumber(Long customerId, String accountNumber);
    boolean existsByCustomerIdAndAccountNumber(Long customerId, String accountNumber);
}
