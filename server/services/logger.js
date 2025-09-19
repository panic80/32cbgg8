import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const toBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value === 1 || value === 0) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return 1;
    }
    if (normalized === 'false' || normalized === '0') {
      return 0;
    }
  }
  return null;
};

const toMetadataString = (metadata) => {
  if (!metadata) return null;
  try {
    return typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  } catch (error) {
    console.warn('Failed to serialise metadata for chat log entry', error);
    return null;
  }
};

class ChatLogger {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.dbPath = path.join(this.dataDir, 'analytics.sqlite');

    ensureDirectory(this.dataDir);

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initialiseSchema();
    this.prepareStatements();

    process.on('exit', () => {
      try {
        this.db.close();
      } catch (error) {
        console.error('Failed to close analytics database on exit:', error);
      }
    });
  }

  initialiseSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asked_at INTEGER NOT NULL,
        asked_at_iso TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        conversation_id TEXT,
        model TEXT,
        provider TEXT,
        rag_enabled INTEGER,
        short_answer_mode INTEGER,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_chat_logs_asked_at ON chat_logs (asked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation ON chat_logs (conversation_id);

      CREATE TABLE IF NOT EXISTS event_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at INTEGER NOT NULL,
        recorded_at_iso TEXT NOT NULL,
        type TEXT,
        message TEXT,
        payload TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_event_logs_recorded_at ON event_logs (recorded_at DESC);
    `);
  }

  prepareStatements() {
    this.insertChatStmt = this.db.prepare(`
      INSERT INTO chat_logs (
        asked_at,
        asked_at_iso,
        question,
        answer,
        conversation_id,
        model,
        provider,
        rag_enabled,
        short_answer_mode,
        metadata
      ) VALUES (@asked_at, @asked_at_iso, @question, @answer, @conversation_id, @model, @provider, @rag_enabled, @short_answer_mode, @metadata)
    `);

    this.insertEventStmt = this.db.prepare(`
      INSERT INTO event_logs (
        recorded_at,
        recorded_at_iso,
        type,
        message,
        payload
      ) VALUES (@recorded_at, @recorded_at_iso, @type, @message, @payload)
    `);
  }

  logChat(_req, chatData) {
    if (!chatData || !chatData.question) {
      console.warn('logChat called without a question payload');
      return;
    }

    const askedAt = chatData.timestamp ? Date.parse(chatData.timestamp) : Date.now();
    const askedAtIso = new Date(askedAt).toISOString();

    const record = {
      asked_at: askedAt,
      asked_at_iso: askedAtIso,
      question: chatData.question,
      answer: chatData.answer ?? null,
      conversation_id: chatData.conversationId ?? chatData.conversation_id ?? null,
      model: chatData.model ?? null,
      provider: chatData.provider ?? null,
      rag_enabled: toBooleanFlag(chatData.ragEnabled ?? chatData.useRAG),
      short_answer_mode: toBooleanFlag(chatData.shortAnswerMode),
      metadata: toMetadataString(chatData.metadata),
    };

    try {
      this.insertChatStmt.run(record);
    } catch (error) {
      console.error('Failed to persist chat log entry:', error, record);
    }
  }

  log(data) {
    const now = Date.now();
    const payload = toMetadataString(data);

    const record = {
      recorded_at: now,
      recorded_at_iso: new Date(now).toISOString(),
      type: typeof data?.type === 'string' ? data.type : null,
      message: typeof data?.message === 'string' ? data.message : null,
      payload,
    };

    try {
      this.insertEventStmt.run(record);
    } catch (error) {
      console.error('Failed to persist event log entry:', error, record);
    }
  }

  getChatLogs({
    limit = 50,
    offset = 0,
    startAt,
    endAt,
    conversationId,
    model,
    provider,
    ragEnabled,
    shortAnswerMode,
    search,
  } = {}) {
    const conditions = [];
    const params = { limit, offset };

    if (startAt) {
      const parsed = Date.parse(startAt);
      if (!Number.isNaN(parsed)) {
        conditions.push('asked_at >= @startAt');
        params.startAt = parsed;
      }
    }

    if (endAt) {
      const parsed = Date.parse(endAt);
      if (!Number.isNaN(parsed)) {
        conditions.push('asked_at <= @endAt');
        params.endAt = parsed;
      }
    }

    if (conversationId) {
      conditions.push('conversation_id = @conversationId');
      params.conversationId = conversationId;
    }

    if (model) {
      conditions.push('model = @model');
      params.model = model;
    }

    if (provider) {
      conditions.push('provider = @provider');
      params.provider = provider;
    }

    const ragFlag = toBooleanFlag(ragEnabled);
    if (ragFlag !== null) {
      conditions.push('rag_enabled = @ragEnabled');
      params.ragEnabled = ragFlag;
    }

    const shortAnswerFlag = toBooleanFlag(shortAnswerMode);
    if (shortAnswerFlag !== null) {
      conditions.push('short_answer_mode = @shortAnswerMode');
      params.shortAnswerMode = shortAnswerFlag;
    }

    if (search && typeof search === 'string') {
      conditions.push('question LIKE @search');
      params.search = `%${search.trim()}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const statement = this.db.prepare(`
        SELECT
          id,
          asked_at_iso as askedAt,
          question,
          answer,
          conversation_id as conversationId,
          model,
          provider,
          rag_enabled as ragEnabled,
          short_answer_mode as shortAnswerMode,
          metadata
        FROM chat_logs
        ${whereClause}
        ORDER BY asked_at DESC
        LIMIT @limit OFFSET @offset
      `);

      return statement.all(params).map((row) => {
        let parsedMetadata = null;
        if (row.metadata) {
          try {
            parsedMetadata = JSON.parse(row.metadata);
          } catch (error) {
            console.warn('Failed to parse metadata for chat log row', row.id, error);
            parsedMetadata = row.metadata;
          }
        }

        return {
          ...row,
          ragEnabled: row.ragEnabled === null ? null : row.ragEnabled === 1,
          shortAnswerMode: row.shortAnswerMode === null ? null : row.shortAnswerMode === 1,
          metadata: parsedMetadata,
        };
      });
    } catch (error) {
      console.error('Failed to read chat logs:', error);
      return [];
    }
  }

  clearAllLogs() {
    try {
      this.db.exec('DELETE FROM chat_logs; DELETE FROM event_logs;');
    } catch (error) {
      console.error('Failed to clear analytics logs:', error);
    }
  }
}

const chatLogger = new ChatLogger();
export default chatLogger;
