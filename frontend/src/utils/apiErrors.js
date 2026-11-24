// Helpers for turning backend / network errors into messages a person can act on.
//
// The backend replies with either:
//   { error: 'Some message' }                                   (AppError, rate limit)
//   { error: 'Validation failed', details: [{ field, message }] } (express-validator)

// Maps backend field names to the field names used by the forms.
const FIELD_ALIASES = { student_id: 'studentId' };

export function getFieldErrors(err) {
  const details = err?.response?.data?.details;
  if (!Array.isArray(details)) return {};

  const fieldErrors = {};
  details.forEach(({ field, message }) => {
    const key = FIELD_ALIASES[field] || field;
    // Keep the first message per field.
    if (key && message && !fieldErrors[key]) fieldErrors[key] = message;
  });
  return fieldErrors;
}

export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  // No response at all: server down, offline, CORS, or timeout.
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return 'The request took too long. Please check your connection and try again.';
    }
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }

  const { status, data } = err.response;

  if (status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }

  // Prefer the first specific validation message over the generic "Validation failed".
  const firstDetail = Array.isArray(data?.details) ? data.details[0]?.message : null;
  return firstDetail || data?.error || data?.message || fallback;
}
