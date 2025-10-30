import { randomUUID } from 'crypto';

const serializeCause = (cause) => {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  if (!cause || typeof cause !== 'object') {
    return cause ?? null;
  }

  return Object.fromEntries(
    Object.entries(cause).map(([key, value]) => [key, serializeCause(value)]),
  );
};

export const createErrorResponse = ({
  status = 500,
  error = status >= 500 ? 'InternalServerError' : 'BadRequest',
  message = status >= 500 ? 'An unexpected error occurred.' : 'Invalid request.',
  logger,
  cause,
  details,
  level,
}) => {
  const traceId = randomUUID();
  const logLevel = level ?? (status >= 500 ? 'error' : 'warn');

  if (logger?.[logLevel]) {
    logger[logLevel](message, {
      traceId,
      status,
      errorCode: error,
      cause: serializeCause(cause),
      details: serializeCause(details),
    });
  }

  const body = {
    error,
    message,
    traceId,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return { status, body, traceId };
};

export const respondWithError = (res, options) => {
  const { status, body } = createErrorResponse(options);
  return res.status(status).json(body);
};
