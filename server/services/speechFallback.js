import fetch from 'node-fetch';

const AZURE_SPEECH_ENDPOINT = process.env.AZURE_SPEECH_ENDPOINT;
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

export async function createAzureSpeechToken() {
  if (!AZURE_SPEECH_ENDPOINT || !AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    throw new Error('Azure speech service is not configured.');
  }

  const response = await fetch(`${AZURE_SPEECH_ENDPOINT}/issueToken`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create Azure speech token (${response.status})`);
  }

  const token = await response.text();
  return {
    token,
    region: AZURE_SPEECH_REGION,
  };
}

export default {
  createAzureSpeechToken,
};
