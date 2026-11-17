package com.helpdesk.service;

import com.helpdesk.dto.response.TicketActivityDto;
import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.TicketActivity;
import com.helpdesk.entity.User;
import com.helpdesk.repository.TicketActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityService {

    private final TicketActivityRepository activityRepository;

    @Transactional
    public void recordActivity(Ticket ticket, User actor, String actionType, String oldValue, String newValue, String description) {
        TicketActivity activity = TicketActivity.builder()
                .ticket(ticket)
                .actor(actor)
                .actionType(actionType)
                .oldValue(oldValue)
                .newValue(newValue)
                .description(description)
                .build();

        activityRepository.save(activity);
        log.debug("Recorded activity '{}' on ticket ID {}", actionType, ticket.getId());
    }

    @Transactional(readOnly = true)
    public List<TicketActivityDto> getActivitiesForTicket(Long ticketId) {
        return activityRepository.findByTicketIdOrderByCreatedAtDesc(ticketId).stream()
                .map(TicketActivityDto::fromEntity)
                .toList();
    }
}
