import {
  PublicClientApplication,
  type Configuration,
  type AccountInfo,
} from '@azure/msal-node';
import { BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const GRAPH_SCOPES = ['Chat.ReadWrite', 'ChatMessage.Send', 'User.Read'];
const REDIRECT_URI = 'http://localhost';

export class TeamsService {
  private msalApp: PublicClientApplication | null = null;
  private account: AccountInfo | null = null;
  private clientId = '';
  private cachePath: string;

  constructor() {
    this.cachePath = path.join(app.getPath('userData'), 'teams-token-cache.json');
  }

  /** Configure MSAL with a client ID. Must be called before login/send. */
  configure(clientId: string): void {
    if (!clientId || this.clientId === clientId) return;

    this.clientId = clientId;
    const config: Configuration = {
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
      },
    };
    this.msalApp = new PublicClientApplication(config);

    // Restore cached tokens
    this.loadCache();
  }

  /** Interactive login via Azure AD in a BrowserWindow. */
  async login(): Promise<{ success: boolean; email?: string; error?: string }> {
    if (!this.msalApp) {
      return { success: false, error: 'Teams not configured. Set Client ID in Settings.' };
    }

    try {
      // Generate PKCE codes manually
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

      const authCodeUrl = await this.msalApp.getAuthCodeUrl({
        scopes: GRAPH_SCOPES,
        redirectUri: REDIRECT_URI,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      });

      const authCode = await this.openAuthWindow(authCodeUrl);

      const result = await this.msalApp.acquireTokenByCode({
        code: authCode,
        scopes: GRAPH_SCOPES,
        redirectUri: REDIRECT_URI,
        codeVerifier: verifier,
      });

      this.account = result.account;
      this.saveCache();

      return { success: true, email: result.account?.username };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** Send a chat message to a user via Microsoft Graph API. */
  async sendMessage(
    recipientEmail: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.msalApp) {
      return { success: false, error: 'Teams not configured' };
    }
    if (!this.account) {
      return { success: false, error: 'Not signed in to Teams' };
    }

    try {
      const token = await this.getAccessToken();

      // Create or get 1:1 chat
      const chatId = await this.findOrCreateChat(token, recipientEmail);

      // Send the message
      await this.postChatMessage(token, chatId, message);

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** Get current auth status. */
  getStatus(): { configured: boolean; loggedIn: boolean; email: string | null } {
    return {
      configured: !!this.msalApp,
      loggedIn: !!this.account,
      email: this.account?.username || null,
    };
  }

  /** Sign out and clear tokens. */
  logout(): void {
    this.account = null;
    try {
      if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
    } catch { /* ignore */ }
  }

  // ─── Private helpers ──────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (!this.msalApp || !this.account) throw new Error('Not signed in');

    try {
      const result = await this.msalApp.acquireTokenSilent({
        account: this.account,
        scopes: GRAPH_SCOPES,
      });
      return result.accessToken;
    } catch {
      // Silent acquisition failed — try interactive re-auth
      const loginResult = await this.login();
      if (!loginResult.success) throw new Error(loginResult.error || 'Re-authentication failed');

      const result = await this.msalApp!.acquireTokenSilent({
        account: this.account!,
        scopes: GRAPH_SCOPES,
      });
      return result.accessToken;
    }
  }

  private async findOrCreateChat(token: string, recipientEmail: string): Promise<string> {
    const res = await fetch('https://graph.microsoft.com/v1.0/chats', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatType: 'oneOnOne',
        members: [
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recipientEmail}')`,
          },
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': 'https://graph.microsoft.com/v1.0/me',
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to create chat (${res.status})`);
    }

    const chat = await res.json();
    return (chat as any).id;
  }

  private async postChatMessage(token: string, chatId: string, message: string): Promise<void> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: { content: message },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `Failed to send message (${res.status})`);
    }
  }

  /** Open a BrowserWindow for Azure AD interactive login, return auth code. */
  private openAuthWindow(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        title: 'Sign in to Microsoft Teams',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const handleUrl = (url: string) => {
        if (resolved) return;
        if (!url.startsWith(REDIRECT_URI)) return;

        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (code) {
            resolved = true;
            authWindow.close();
            resolve(code);
          } else if (error) {
            resolved = true;
            authWindow.close();
            reject(new Error(urlObj.searchParams.get('error_description') || error));
          }
        } catch { /* ignore parse errors */ }
      };

      // Catch server-side redirects
      authWindow.webContents.on('will-redirect', (_event, url) => handleUrl(url));

      // Catch client-side navigation
      authWindow.webContents.on('did-navigate', (_event, url) => handleUrl(url));

      authWindow.on('closed', () => {
        if (!resolved) {
          reject(new Error('Authentication cancelled'));
        }
      });

      authWindow.loadURL(authUrl);
    });
  }

  /** Persist MSAL token cache + account info to disk. */
  private saveCache(): void {
    try {
      if (!this.msalApp) return;
      const cacheData = this.msalApp.getTokenCache().serialize();
      const data = JSON.stringify({
        cache: cacheData,
        account: this.account,
        clientId: this.clientId,
      });
      fs.writeFileSync(this.cachePath, data, 'utf-8');
    } catch (err) {
      console.error('Failed to save Teams token cache:', err);
    }
  }

  /** Restore MSAL token cache + account from disk. */
  private loadCache(): void {
    try {
      if (!this.msalApp || !fs.existsSync(this.cachePath)) return;
      const raw = fs.readFileSync(this.cachePath, 'utf-8');
      const data = JSON.parse(raw);

      // Only restore if same client ID
      if (data.clientId !== this.clientId) return;

      if (data.cache) {
        this.msalApp.getTokenCache().deserialize(data.cache);
      }
      if (data.account) {
        this.account = data.account;
      }
    } catch (err) {
      console.error('Failed to load Teams token cache:', err);
    }
  }
}
