package service

type ServiceError struct {
	Status  int
	Message string
}

func (e *ServiceError) Error() string {
	return e.Message
}

func badRequest(message string) error {
	return &ServiceError{Status: 400, Message: message}
}

func unauthorized(message string) error {
	return &ServiceError{Status: 401, Message: message}
}

func notFound(message string) error {
	return &ServiceError{Status: 404, Message: message}
}
