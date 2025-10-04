import { existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';

const SECURE_ENV_PATH = '/etc/cbthis/env';
let hasLoaded = false;

const loadSecureEnvFile = (secureEnvPath = SECURE_ENV_PATH) => {
  if (!existsSync(secureEnvPath)) {
    console.warn('Secure environment file not found at', secureEnvPath);
    return;
  }

  try {
    const secureEnv = readFileSync(secureEnvPath, 'utf8');
    secureEnv.split('\n').forEach((line) => {
      if (line.startsWith('#') || !line.trim()) return;

      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
    console.log('Loaded secure environment variables from', secureEnvPath);
  } catch (error) {
    console.error('Failed to load secure environment variables:', error.message);
  }
};

export const loadEnvironment = () => {
  if (hasLoaded) {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  hasLoaded = true;

  if (process.env.SKIP_SECURE_ENV === 'true') {
    console.warn('SKIP_SECURE_ENV is set. Secure environment file loading is disabled for this process.');
  } else {
    loadSecureEnvFile();
  }

  const nodeEnv = process.env.NODE_ENV || 'development';

  dotenv.config({ path: `.env.${nodeEnv}` });
  dotenv.config();

  return { nodeEnv };
};

export const __internal = {
  loadSecureEnvFile,
  reset: () => {
    hasLoaded = false;
  },
};
