package reviews

type idempotentResult struct {
	StatusCode int
	Body       map[string]interface{}
	Replay     bool
}

type domainEvent struct {
	ID          int64
	EventType   string
	AggregateID string
	Payload     map[string]interface{}
	Attempts    int
}

type domainInboxEvent struct {
	ID            int64
	OutboxEventID int64
	Consumer      string
	EventType     string
	AggregateID   string
	Payload       map[string]interface{}
	Attempts      int
}
