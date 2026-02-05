package auth

import (
	"sync"
	"time"
)

type RateLimiter struct {
	limit  int
	window time.Duration
	mu     sync.Mutex
	items  map[string]*rateItem
}

type rateItem struct {
	count     int
	windowEnd time.Time
	lastSeen  time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	if limit <= 0 || window <= 0 {
		return nil
	}
	return &RateLimiter{
		limit:  limit,
		window: window,
		items:  make(map[string]*rateItem),
	}
}

func (r *RateLimiter) Allow(key string) bool {
	now := time.Now()

	r.mu.Lock()
	defer r.mu.Unlock()

	item, ok := r.items[key]
	if !ok || now.After(item.windowEnd) {
		r.items[key] = &rateItem{count: 1, windowEnd: now.Add(r.window), lastSeen: now}
		return true
	}

	item.lastSeen = now
	if item.count >= r.limit {
		return false
	}
	item.count++
	return true
}

func (r *RateLimiter) Cleanup(ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	cutoff := time.Now().Add(-ttl)

	r.mu.Lock()
	defer r.mu.Unlock()

	for key, item := range r.items {
		if item.lastSeen.Before(cutoff) {
			delete(r.items, key)
		}
	}
}
