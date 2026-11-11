SELECT credited.website_id, credited.department_id, credited.department_name,
       COUNT(DISTINCT credited.ticket_id) AS closed_count
FROM (
 SELECT CASE WHEN e.uid_type='S' AND e.uid>0 THEN native_actor.id ELSE dev_actor.id END AS website_id,
        e.dept_id AS department_id, department.name AS department_name, ticket.ticket_id
 FROM drsupport_thread_event e
 JOIN drsupport_event event_type ON event_type.id=e.event_id AND event_type.name='closed'
 JOIN drsupport_thread thread ON thread.id=e.thread_id AND thread.object_type='T'
 JOIN drsupport_ticket ticket ON ticket.ticket_id=thread.object_id
 JOIN drsupport_ticket_status status ON status.id=ticket.status_id AND status.state='closed'
 JOIN drsupport_department department ON department.id=e.dept_id
 LEFT JOIN drsupport_staff actor_staff ON e.uid_type='S' AND actor_staff.staff_id=e.uid
      AND actor_staff.backend='dunerealms-staff'
 LEFT JOIN site_accounts native_actor ON REPLACE(native_actor.id,'-','')=actor_staff.username
 LEFT JOIN dune_dev_tasks dev_task ON dev_task.ticket_id=ticket.ticket_id
 LEFT JOIN dune_dev_task_events dev_event ON dev_event.ticket_id=dev_task.ticket_id
      AND dev_event.action IN ('completed','denied')
      AND dev_event.id=(SELECT MAX(last_event.id) FROM dune_dev_task_events last_event
                       WHERE last_event.ticket_id=dev_task.ticket_id
                         AND last_event.action IN ('completed','denied'))
 LEFT JOIN site_accounts dev_actor ON dev_actor.id=dev_event.actor_id
      AND dev_task.approval IN ('completed','denied')
 WHERE e.annulled=0
   AND (dev_task.ticket_id IS NULL OR dev_task.approval IN ('completed','denied'))
   AND NOT EXISTS (SELECT 1 FROM drsupport_thread_event later
                   WHERE later.thread_id=e.thread_id AND later.event_id=e.event_id
                     AND later.annulled=0 AND later.id>e.id)
) credited
WHERE credited.website_id IS NOT NULL
GROUP BY credited.website_id, credited.department_id, credited.department_name
