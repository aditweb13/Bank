package com.amcbank.simple.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amcbank.simple.model.Customer;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findByNameContainingIgnoreCaseOrCityContainingIgnoreCase(String name, String city);
    Page<Customer> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrPanNumberContainingIgnoreCase(
            String name, String email, String panNumber, Pageable pageable);
    boolean existsByEmail(String email);
    boolean existsByPanNumber(String panNumber);
    Optional<Customer> findByEmailIgnoreCase(String email);
}
