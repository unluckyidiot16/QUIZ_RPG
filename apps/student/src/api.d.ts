export type RunSummary = {
    finalHash: string;
    turns: number;
    durationSec: number;
    cleared: boolean;
    runToken: string;
};
export declare const SUPABASE_READY: boolean;
export declare function authLogin(nickname?: string): Promise<string>;
export declare function getUserId(): Promise<string>;
export declare function enterDungeon(): Promise<string>;
export declare function ensureRunToken(): Promise<string>;
export declare function finishDungeon(s: RunSummary): Promise<{
    ok: true;
    idempotent: boolean;
}>;
export declare function newRunToken(): Promise<string>;
export declare function resetLocalRunState(): void;
export declare function guestLogin(token: string): Promise<string>;
