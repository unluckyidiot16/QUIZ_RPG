export declare class Proof {
    private h;
    turns: number;
    start: number;
    static create(): Promise<Proof>;
    log(ev: Record<string, unknown>): Promise<void>;
    summary(cleared: boolean): Promise<{
        finalHash: string;
        turns: number;
        durationSec: number;
        cleared: boolean;
    }>;
}
