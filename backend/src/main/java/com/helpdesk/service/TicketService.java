package com.helpdesk.service;

import com.helpdesk.dto.request.*;
import com.helpdesk.dto.response.PagedResponse;
import com.helpdesk.dto.response.TicketActivityDto;
import com.helpdesk.dto.response.TicketDto;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.entity.enums.Role;
import com.helpdesk.entity.enums.TicketCategory;
import com.helpdesk.entity.enums.TicketPriority;
import com.helpdesk.entity.enums.TicketStatus;
import com.helpdesk.exception.BadRequestException;
import com.helpdesk.exception.ResourceNotFoundException;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private static final Set<String> ALLOWED_SORT_PROPERTIES = Set.of(
            "id", "title", "status", "priority", "category",
            "createdAt", "updatedAt", "resolvedAt", "closedAt"
    );

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final ActivityService activityService;

    @Transactional
    public TicketDto createTicket(CreateTicketRequest request, UserPrincipal currentUser) {
        User creator = loadUser(currentUser.getId());

        TicketPriority priority = request.getPriority() != null ? request.getPriority() : TicketPriority.MEDIUM;

        Ticket ticket = Ticket.builder()
                .title(request.getTitle().trim())
                .description(request.getDescription().trim())
                .category(request.getCategory())
                .priority(priority)
                .status(TicketStatus.OPEN)
                .createdBy(creator)
                .deleted(false)
                .build();

        Ticket saved = ticketRepository.save(ticket);

        activityService.recordActivity(
                saved,
                creator,
                "TICKET_CREATED",
                null,
                saved.getStatus().name(),
                "Ticket created with title: '" + saved.getTitle() + "'"
        );

        log.info("Ticket #{} created by user '{}'", saved.getId(), creator.getUsername());
        return TicketDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public TicketDto getTicketById(Long id, UserPrincipal currentUser) {
        Ticket ticket = findActiveTicketById(id);
        verifyTicketViewPermission(ticket, currentUser);
        return TicketDto.fromEntity(ticket);
    }

    @Transactional(readOnly = true)
    public PagedResponse<TicketDto> getAllTickets(
            TicketStatus status,
            TicketPriority priority,
            TicketCategory category,
            Long assignedToId,
            Boolean assignedToMe,
            String keyword,
            Pageable pageable,
            UserPrincipal currentUser
    ) {
        Specification<Ticket> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Always exclude soft-deleted records
            predicates.add(cb.isFalse(root.get("deleted")));

            // Role-based visibility
            if (currentUser.getRole() == Role.USER) {
                // Regular users can only see their own tickets
                predicates.add(cb.equal(root.get("createdBy").get("id"), currentUser.getId()));
            } else {
                // AGENT filters
                if (Boolean.TRUE.equals(assignedToMe)) {
                    predicates.add(cb.equal(root.get("assignedTo").get("id"), currentUser.getId()));
                } else if (assignedToId != null) {
                    predicates.add(cb.equal(root.get("assignedTo").get("id"), assignedToId));
                }
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (priority != null) {
                predicates.add(cb.equal(root.get("priority"), priority));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (StringUtils.hasText(keyword)) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + keyword.trim().toLowerCase() + "%"));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Pageable safePageable = sanitizePageable(pageable);
        Page<TicketDto> page = ticketRepository.findAll(spec, safePageable).map(TicketDto::fromEntity);
        return PagedResponse.fromPage(page);
    }

    private Pageable sanitizePageable(Pageable pageable) {
        if (pageable == null || pageable.isUnpaged()) {
            return PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        int pageNumber = Math.max(0, pageable.getPageNumber());
        int pageSize = pageable.getPageSize() > 0 ? pageable.getPageSize() : 10;

        Sort safeSort = sanitizeSort(pageable.getSort());
        return PageRequest.of(pageNumber, pageSize, safeSort);
    }

    private Sort sanitizeSort(Sort sort) {
        if (sort == null || sort.isUnsorted()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        List<Sort.Order> safeOrders = new ArrayList<>();
        for (Sort.Order order : sort) {
            if (order == null || order.getProperty() == null) {
                continue;
            }

            String property = order.getProperty().trim();

            // Strip enclosing brackets and quotes if passed (e.g. "[]", "[createdAt]", "[\"createdAt\"]", etc.)
            while ((property.startsWith("[") && property.endsWith("]")) ||
                    (property.startsWith("\"") && property.endsWith("\"") && property.length() >= 2) ||
                    (property.startsWith("'") && property.endsWith("'") && property.length() >= 2)) {
                property = property.substring(1, property.length() - 1).trim();
            }

            // Skip empty, blank, or literal array indicators
            if (property.isEmpty() || property.equalsIgnoreCase("[]") || property.equals(",")) {
                continue;
            }

            // Handle composite strings like "createdAt,desc" if not split by resolver
            Sort.Direction direction = order.getDirection();
            if (property.contains(",")) {
                String[] parts = property.split(",", 2);
                property = parts[0].trim();
                if (parts.length > 1) {
                    String dirStr = parts[1].trim();
                    if (dirStr.equalsIgnoreCase("asc")) {
                        direction = Sort.Direction.ASC;
                    } else if (dirStr.equalsIgnoreCase("desc")) {
                        direction = Sort.Direction.DESC;
                    }
                }
            }

            if (ALLOWED_SORT_PROPERTIES.contains(property)) {
                safeOrders.add(new Sort.Order(direction != null ? direction : Sort.Direction.DESC, property));
            }
        }

        if (safeOrders.isEmpty()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }

        return Sort.by(safeOrders);
    }

    @Transactional
    public TicketDto updateTicket(Long id, UpdateTicketRequest request, UserPrincipal currentUser) {
        Ticket ticket = findActiveTicketById(id);
        User actor = loadUser(currentUser.getId());

        if (currentUser.getRole() == Role.USER) {
            // Must be ticket owner
            if (!ticket.getCreatedBy().getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("You do not have permission to edit this ticket.");
            }
            // User can only edit if status is OPEN
            if (ticket.getStatus() != TicketStatus.OPEN) {
                throw new BadRequestException("Tickets can only be updated while in OPEN status.");
            }
        }

        String oldDetails = "Title: " + ticket.getTitle() + ", Category: " + ticket.getCategory();
        ticket.setTitle(request.getTitle().trim());
        ticket.setDescription(request.getDescription().trim());
        ticket.setCategory(request.getCategory());

        Ticket updated = ticketRepository.save(ticket);
        String newDetails = "Title: " + updated.getTitle() + ", Category: " + updated.getCategory();

        activityService.recordActivity(
                updated,
                actor,
                "TICKET_UPDATED",
                oldDetails,
                newDetails,
                "Ticket details updated by " + actor.getUsername()
        );

        return TicketDto.fromEntity(updated);
    }

    @Transactional
    public void softDeleteTicket(Long id, UserPrincipal currentUser) {
        Ticket ticket = findActiveTicketById(id);
        User actor = loadUser(currentUser.getId());

        if (currentUser.getRole() == Role.USER) {
            // Must be ticket owner
            if (!ticket.getCreatedBy().getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("You do not have permission to delete this ticket.");
            }
            // Can only delete if OPEN
            if (ticket.getStatus() != TicketStatus.OPEN) {
                throw new BadRequestException("Only tickets in OPEN status can be deleted.");
            }
        }

        ticket.setDeleted(true);
        ticket.setDeletedAt(LocalDateTime.now());
        ticketRepository.save(ticket);

        activityService.recordActivity(
                ticket,
                actor,
                "TICKET_DELETED",
                "active",
                "deleted",
                "Ticket soft-deleted by " + actor.getUsername()
        );

        log.info("Ticket #{} soft-deleted by user '{}'", id, actor.getUsername());
    }

    @Transactional
    public TicketDto updateStatus(Long id, UpdateStatusRequest request, UserPrincipal currentUser) {
        ensureAgent(currentUser);
        Ticket ticket = findActiveTicketById(id);
        User actor = loadUser(currentUser.getId());

        TicketStatus oldStatus = ticket.getStatus();
        TicketStatus newStatus = request.getStatus();

        if (oldStatus == newStatus) {
            return TicketDto.fromEntity(ticket);
        }

        ticket.setStatus(newStatus);
        if (newStatus == TicketStatus.RESOLVED && ticket.getResolvedAt() == null) {
            ticket.setResolvedAt(LocalDateTime.now());
        } else if (newStatus == TicketStatus.CLOSED && ticket.getClosedAt() == null) {
            ticket.setClosedAt(LocalDateTime.now());
        }

        Ticket saved = ticketRepository.save(ticket);

        activityService.recordActivity(
                saved,
                actor,
                "STATUS_CHANGED",
                oldStatus.name(),
                newStatus.name(),
                "Status changed from " + oldStatus + " to " + newStatus
        );

        return TicketDto.fromEntity(saved);
    }

    @Transactional
    public TicketDto updatePriority(Long id, UpdatePriorityRequest request, UserPrincipal currentUser) {
        ensureAgent(currentUser);
        Ticket ticket = findActiveTicketById(id);
        User actor = loadUser(currentUser.getId());

        TicketPriority oldPriority = ticket.getPriority();
        TicketPriority newPriority = request.getPriority();

        if (oldPriority == newPriority) {
            return TicketDto.fromEntity(ticket);
        }

        ticket.setPriority(newPriority);
        Ticket saved = ticketRepository.save(ticket);

        activityService.recordActivity(
                saved,
                actor,
                "PRIORITY_CHANGED",
                oldPriority.name(),
                newPriority.name(),
                "Priority changed from " + oldPriority + " to " + newPriority
        );

        return TicketDto.fromEntity(saved);
    }

    @Transactional
    public TicketDto assignTicket(Long id, AssignTicketRequest request, UserPrincipal currentUser) {
        ensureAgent(currentUser);
        Ticket ticket = findActiveTicketById(id);
        User actor = loadUser(currentUser.getId());

        User oldAssignee = ticket.getAssignedTo();
        String oldAssigneeName = oldAssignee != null ? oldAssignee.getUsername() : "Unassigned";

        if (request.getAgentId() == null) {
            // Unassign
            ticket.setAssignedTo(null);
            Ticket saved = ticketRepository.save(ticket);

            activityService.recordActivity(
                    saved,
                    actor,
                    "UNASSIGNED",
                    oldAssigneeName,
                    "Unassigned",
                    "Ticket unassigned by " + actor.getUsername()
            );
            return TicketDto.fromEntity(saved);
        }

        User newAssignee = loadUser(request.getAgentId());
        if (newAssignee.getRole() != Role.AGENT || !newAssignee.isActive()) {
            throw new BadRequestException("Ticket can only be assigned to an active AGENT.");
        }

        ticket.setAssignedTo(newAssignee);
        Ticket saved = ticketRepository.save(ticket);

        activityService.recordActivity(
                saved,
                actor,
                "ASSIGNED",
                oldAssigneeName,
                newAssignee.getUsername(),
                "Ticket assigned to " + newAssignee.getUsername() + " by " + actor.getUsername()
        );

        return TicketDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<TicketActivityDto> getTicketActivities(Long id, UserPrincipal currentUser) {
        Ticket ticket = findActiveTicketById(id);
        verifyTicketViewPermission(ticket, currentUser);
        return activityService.getActivitiesForTicket(id);
    }

    public Ticket findActiveTicketById(Long id) {
        return ticketRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
    }

    public void verifyTicketViewPermission(Ticket ticket, UserPrincipal currentUser) {
        if (currentUser.getRole() == Role.USER) {
            if (!ticket.getCreatedBy().getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("You do not have permission to access this ticket.");
            }
        }
    }

    private User loadUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }

    private void ensureAgent(UserPrincipal currentUser) {
        if (currentUser.getRole() != Role.AGENT) {
            throw new AccessDeniedException("Only agents can perform this operation.");
        }
    }
}
