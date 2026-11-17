package com.helpdesk.repository;

import com.helpdesk.entity.Comment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    @EntityGraph(attributePaths = {"author", "ticket"})
    Optional<Comment> findByIdAndDeletedFalse(Long id);

    @EntityGraph(attributePaths = {"author"})
    List<Comment> findByTicketIdAndDeletedFalseOrderByCreatedAtAsc(Long ticketId);

    @EntityGraph(attributePaths = {"author"})
    List<Comment> findByTicketIdAndDeletedFalseAndInternalFalseOrderByCreatedAtAsc(Long ticketId);
}
