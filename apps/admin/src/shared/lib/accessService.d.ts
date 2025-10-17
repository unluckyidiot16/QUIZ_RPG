export type UUID = string;
export interface TempToken {
    token: UUID;
    userId: UUID;
    validFrom: string;
    validUntil: string;
    revoked?: boolean;
}
export interface AccessService {
    guestLogin(token: UUID): Promise<UUID>;
    issueTempId(opts: {
        userId?: UUID;
        nickname?: string;
        ttlMin?: number;
        validFrom?: Date;
    }): Promise<TempToken>;
    revoke(token: UUID): Promise<void>;
    extend(token: UUID, minutes: number): Promise<void>;
}
export declare const accessService: AccessService;
