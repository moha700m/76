declare module '@appdeploy/client' {
  export type AuthUser = { userId?: string; name?: string; email?: string };
  export type WsConnection = {
    connectionId?: string;
    ready: Promise<void>;
    onMessage(callback: (message: unknown) => void): void;
    disconnect(): void;
  };
  export const api: {
    get(path: string): Promise<{ data: any }>;
    post(path: string, body?: unknown): Promise<{ data: any }>;
    delete(path: string): Promise<{ data: any }>;
  };
  export const auth: {
    getUser(): Promise<AuthUser | null>;
    signIn(options?: unknown): Promise<{ user: AuthUser }>;
    signOut(): Promise<void>;
  };
  export const ws: { connect(): WsConnection };
}
