import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN_PATH = path.join(process.cwd(), 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents',
];

function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function loadTokenFromFile(oAuth2Client: OAuth2Client): boolean {
  if (!fs.existsSync(TOKEN_PATH)) {
    return false;
  }
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    return true;
  } catch {
    return false;
  }
}

function saveTokenToFile(token: object): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export async function getAuthClient(): Promise<OAuth2Client> {
  const oAuth2Client = createOAuth2Client();

  // Try to load existing token
  if (loadTokenFromFile(oAuth2Client)) {
    // Set up auto-refresh: save new tokens when they are refreshed
    oAuth2Client.on('tokens', (tokens) => {
      const current = JSON.parse(
        fs.existsSync(TOKEN_PATH) ? fs.readFileSync(TOKEN_PATH, 'utf8') : '{}'
      );
      saveTokenToFile({ ...current, ...tokens });
    });
    return oAuth2Client;
  }

  // No token found — provide auth URL for the user to complete the flow manually
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  throw new Error(
    `Google OAuth2 authentication required.\n\n` +
    `1. Visit the following URL in your browser:\n   ${authUrl}\n\n` +
    `2. After authorizing, you will receive an authorization code.\n\n` +
    `3. Run the following command to exchange the code for a token:\n` +
    `   node -e "require('./build/auth').exchangeCodeForToken('<YOUR_CODE>')"\n\n` +
    `   Or set GOOGLE_OAUTH_CODE=<YOUR_CODE> in your environment and restart.`
  );
}

/**
 * Exchange an authorization code for tokens and save them to token.json.
 * This is a one-time setup step.
 */
export async function exchangeCodeForToken(code: string): Promise<void> {
  const oAuth2Client = createOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  saveTokenToFile(tokens);
  console.log('Token saved to', TOKEN_PATH);
}
