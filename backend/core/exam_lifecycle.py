"""Presentation of persisted server timing; never infer time from a heartbeat."""
def lifecycle(completed, deadline, current, reason=None, started=True):
    if completed:
        return 'expired' if reason == 'expired' else 'completed'
    if not started:
        return 'created'
    return 'expired' if deadline and deadline <= current else 'active'


def timing(started_at, deadline, current):
    return {'started_at': started_at, 'expires_at': deadline,
            'server_time': current,
            'remaining_seconds': max(0, int((deadline-current).total_seconds())) if deadline else None}
