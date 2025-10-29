import { PassThrough } from 'stream';

const resolveLogger = (logger) => {
  if (!logger) return null;

  if (typeof logger === 'function') {
    return {
      info: (message, meta) => logger('info', { message, ...(meta || {}) }),
      warn: (message, meta) => logger('warn', { message, ...(meta || {}) }),
      error: (message, meta) => logger('error', { message, ...(meta || {}) }),
    };
  }

  return logger;
};

export const pipeStreamingResponse = ({
  req,
  res,
  upstream,
  corsHeaders = {},
  logger,
  onMetadata,
  onComplete,
  heartbeatIntervalMs = 15000,
  idleTimeoutMs,
  traceId,
}) => {
  const resolvedLogger = resolveLogger(logger);
  const emit = (level, message, meta) => {
    if (resolvedLogger && typeof resolvedLogger[level] === 'function') {
      resolvedLogger[level](message, { traceId, ...(meta || {}) });
    }
  };

  const passThrough = new PassThrough();
  const upstreamStream = upstream?.data ?? upstream;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...corsHeaders,
  });

  passThrough.pipe(res);
  emit('info', 'stream.start', {
    corsApplied: Object.keys(corsHeaders).length > 0,
  });

  let buffer = '';
  let heartbeatTimer = null;
  let idleTimer = null;

  const clearTimers = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const sendHeartbeat = () => {
    if (passThrough.writableEnded) return;
    passThrough.write(`: heartbeat ${Date.now()}\n\n`);
    emit('debug', 'stream.heartbeat');
  };

  if (heartbeatIntervalMs && heartbeatIntervalMs > 0) {
    heartbeatTimer = setInterval(sendHeartbeat, heartbeatIntervalMs);
  }

  const scheduleIdleTimeout = () => {
    if (!idleTimeoutMs) return;
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      emit('error', 'stream.idleTimeout', { idleTimeoutMs });
      upstreamStream?.destroy?.(new Error('Stream exceeded idle timeout'));
      passThrough.end();
      if (typeof res.end === 'function' && !res.writableEnded) {
        res.end();
      }
      clearTimers();
    }, idleTimeoutMs);
  };

  scheduleIdleTimeout();

  upstreamStream.on('data', (chunk) => {
    scheduleIdleTimeout();

    const fragment = chunk.toString();
    passThrough.write(fragment);
    buffer += fragment;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const event = JSON.parse(data);
        if (event.type === 'metadata' && typeof onMetadata === 'function') {
          onMetadata(event);
        }
      } catch (error) {
        emit('warn', 'stream.metadataParseError', {
          error,
          sample: data.substring(0, 100),
        });
      }
    }
  });

  upstreamStream.on('end', () => {
    clearTimers();
    passThrough.end();
    emit('info', 'stream.complete');
    onComplete?.();
  });

  upstreamStream.on('error', (error) => {
    clearTimers();
    emit('error', 'stream.upstreamError', { error });
    passThrough.end();
    res.end();
  });

  req.on('close', () => {
    clearTimers();
    emit('warn', 'stream.clientDisconnected');
    upstreamStream?.destroy?.();
    passThrough.end();
  });

  return passThrough;
};
