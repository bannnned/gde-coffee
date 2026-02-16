package reviews

import "context"

func (s *Service) GetVersioningStatus(_ context.Context) map[string]interface{} {
	return s.versioningSnapshot()
}
