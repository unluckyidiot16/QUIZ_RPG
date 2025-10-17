export declare function bootstrapFromToken(): Promise<{
    consumed: boolean;
    gate: "ok";
    message: string;
    userId: string | null;
} | {
    consumed: boolean;
    gate: "maintenance" | "blocked" | "out_of_window" | "ok";
    message: string;
    userId: string;
} | {
    consumed: boolean;
    gate: "blocked";
    message: any;
    userId: null;
}>;
