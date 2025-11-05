/**
 * Question analysis and similarity detection using MERS-inspired approach.
 * Tracks frequently asked questions and groups similar queries together.
 */

import { initDB } from './db';

const STORE_NAME = 'questions';
const SIMILARITY_THRESHOLD = 0.8;

interface QuestionPattern {
  keywords: string[];
  timeWords?: string[];
  menuWords?: string[];
  category: string;
}

interface StoredQuestion {
  id?: number;
  text: string;
  canonicalId?: number;
  count: number;
  timestamp: number;
}

interface GroupedQuestion {
  id: number;
  text: string;
  count: number;
  timestamp: number;
  variants: string[];
}

// Question classification patterns
const PATTERNS: Record<string, QuestionPattern> = {
  LUNCH_TIME: {
    keywords: ['lunch', 'meal', 'food'],
    timeWords: ['when', 'time', 'schedule', 'what time'],
    category: 'meal_timing',
  },
  LUNCH_MENU: {
    keywords: ['lunch', 'meal', 'food'],
    menuWords: ['what', 'menu', 'eating', 'serve'],
    category: 'meal_content',
  },
};

// Utility functions for text processing
const processText = {
  removeStopWords: (text: string): string => {
    const stopWords = [
      'do',
      'i',
      'get',
      'the',
      'a',
      'an',
      'is',
      'are',
      'will',
      'can',
      'could',
      'would',
      'should',
    ];
    return text
      .toLowerCase()
      .split(' ')
      .filter((word) => !stopWords.includes(word))
      .join(' ');
  },

  normalize: (text: string): string => {
    return text.toLowerCase().replace(/[?.!]/g, '').replace(/\s+/g, ' ').trim();
  },

  extractKeywords: (text: string): string[] => {
    const processed = processText.removeStopWords(text);
    return processed.split(' ').filter((word) => word.length > 2);
  },
};

/**
 * Calculate similarity score between two questions
 */
const calculateSimilarity = (q1: string, q2: string): number => {
  const norm1 = processText.normalize(q1);
  const norm2 = processText.normalize(q2);

  // Direct match after normalization
  if (norm1 === norm2) return 1.0;

  // Extract keywords
  const keywords1 = processText.extractKeywords(q1);
  const keywords2 = processText.extractKeywords(q2);

  // Calculate keyword overlap
  const overlap = keywords1.filter((k) => keywords2.includes(k));
  const overlapScore = overlap.length / Math.max(keywords1.length, keywords2.length);

  // Determine question category
  const getCategory = (text: string): string | null => {
    for (const pattern of Object.values(PATTERNS)) {
      const hasKeyword = pattern.keywords.some((k) => text.includes(k));
      const hasTimeWord = pattern.timeWords?.some((t) => text.includes(t));
      const hasMenuWord = pattern.menuWords?.some((m) => text.includes(m));

      if (hasKeyword && (hasTimeWord || hasMenuWord)) {
        return pattern.category;
      }
    }
    return null;
  };

  // Category matching
  const cat1 = getCategory(norm1);
  const cat2 = getCategory(norm2);
  const categoryScore = cat1 && cat2 && cat1 === cat2 ? 0.5 : 0;

  // Combined similarity score
  return Math.max(overlapScore + categoryScore, overlapScore * 1.5);
};

/**
 * Initialize the questions store
 */
export const initQuestionStore = async (): Promise<IDBDatabase> => {
  const db = await initDB('faq-db', 1, (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      store.createIndex('text', 'text', { unique: false });
      store.createIndex('canonicalId', 'canonicalId', { unique: false });
      store.createIndex('count', 'count', { unique: false });
    }
  });
  return db;
};

/**
 * Find similar questions using MERS-inspired approach
 */
const findSimilarQuestion = (
  newQuestion: string,
  existingQuestions: StoredQuestion[],
): StoredQuestion | null => {
  if (existingQuestions.length === 0) return null;

  let mostSimilar: StoredQuestion | null = null;
  let highestScore = 0;

  for (const existingQuestion of existingQuestions) {
    const score = calculateSimilarity(newQuestion, existingQuestion.text);

    if (score >= SIMILARITY_THRESHOLD && score > highestScore) {
      highestScore = score;
      mostSimilar = existingQuestion;
    }

    // Early return for perfect matches
    if (score === 1.0) {
      return mostSimilar;
    }
  }

  return mostSimilar;
};

/**
 * Add a new question or increment count if similar exists
 */
export const addQuestion = async (questionText: string): Promise<void> => {
  const db = await initQuestionStore();

  // Get all questions in a separate transaction
  const getAllTransaction = db.transaction(STORE_NAME, 'readonly');
  const questions = await new Promise<StoredQuestion[]>((resolve, reject) => {
    const request = getAllTransaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Find similar questions using our MERS approach
  const similarQuestion = findSimilarQuestion(questionText, questions);

  // Start a new transaction for writing
  const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
  const store = writeTransaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    if (similarQuestion) {
      // Update count for canonical question
      const canonicalId = similarQuestion.canonicalId || similarQuestion.id!;

      const request = store.get(canonicalId);

      request.onsuccess = () => {
        const question = request.result as StoredQuestion;
        question.count = (question.count || 0) + 1;

        const putRequest = store.put(question);

        putRequest.onsuccess = () => {
          // Only add variant if text is different
          if (questionText !== question.text) {
            const addRequest = store.add({
              text: questionText,
              canonicalId: canonicalId,
              count: 0,
              timestamp: Date.now(),
            });

            addRequest.onerror = () => {
              console.error('Error adding variant:', addRequest.error);
              reject(addRequest.error);
            };
          }
        };

        putRequest.onerror = () => {
          console.error('Error updating count:', putRequest.error);
          reject(putRequest.error);
        };
      };

      request.onerror = () => {
        console.error('Error getting canonical question:', request.error);
        reject(request.error);
      };
    } else {
      // Add new canonical question
      const addRequest = store.add({
        text: questionText,
        count: 1,
        timestamp: Date.now(),
      });

      addRequest.onerror = () => {
        console.error('Error adding new question:', addRequest.error);
        reject(addRequest.error);
      };
    }

    writeTransaction.oncomplete = () => resolve();
    writeTransaction.onerror = () => {
      console.error('Transaction error:', writeTransaction.error);
      reject(writeTransaction.error);
    };
  });
};

/**
 * Get top N most frequently asked questions
 */
export const getTopQuestions = async (limit = 10): Promise<GroupedQuestion[]> => {
  const db = await initQuestionStore();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () => {
      const allQuestions = request.result as StoredQuestion[];

      // Group questions by canonical ID
      const groupedQuestions = new Map<number, GroupedQuestion>();

      allQuestions.forEach((question) => {
        const id = question.canonicalId || question.id!;
        if (!groupedQuestions.has(id)) {
          // Find the canonical question or use current as fallback
          const canonicalQuestion = allQuestions.find((q) => q.id === id) || question;
          groupedQuestions.set(id, {
            id: canonicalQuestion.id!,
            text: canonicalQuestion.text,
            count: canonicalQuestion.count || 0,
            timestamp: canonicalQuestion.timestamp,
            variants: [],
          });
        }

        // Only add as variant if it's not the canonical question
        if (question.canonicalId && question.id !== id) {
          const canonicalQuestion = groupedQuestions.get(id)!;
          if (!canonicalQuestion.variants.includes(question.text)) {
            canonicalQuestion.variants.push(question.text);
          }
        }
      });

      // Convert to array and sort by count and timestamp
      const results = Array.from(groupedQuestions.values())
        .filter((q) => q.count > 0)
        .sort((a, b) => {
          const countDiff = (b.count || 0) - (a.count || 0);
          return countDiff !== 0 ? countDiff : (b.timestamp || 0) - (a.timestamp || 0);
        })
        .slice(0, limit);

      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
};
