package com.helpdesk.repository;

import com.helpdesk.entity.TicketActivity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketActivityRepository extends JpaRepository<TicketActivity, Long> {

    @EntityGraph(attributePaths = {"actor"})
    List<TicketActivity> findByTicketIdOrderByCreatedAtDesc(Long ticketId);
}
