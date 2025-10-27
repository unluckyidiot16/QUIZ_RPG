export const MAX_HP = 100;

// 플레이어
export const PLAYER_BASE_DMG = 12;        // 정답 시 기본 피해
export const PLAYER_CRIT_CHANCE = 0.05;   // 선택 (원치 않으면 0)

// 적
export const ENEMY_WEAK_DMG = 5;
export const ENEMY_NORMAL_DMG = 8;
export const ENEMY_STRONG_DMG = 15;
export const ENEMY_CRIT_CHANCE = 0.10;

// 실드/반격
export const SHIELD_RATIO = 0.5;          // 실드가 있을 때 받는 피해 비율
export const SPIKE_RETALIATION = 4;       // Spiky 반격 고정 피해

// XP
export const PLAY_XP_PER_CORRECT = 5;
export const XP_ON_WRONG = 0;                 // 0(무변화) | 음수(감점)

// 보너스(초기 비활성)
export const STREAK_BONUS_ENABLED = false;
export const STREAK_BONUS_TABLE = [0, 0, 1, 2, 3]; // 연속 n회 정답 시 추가 XP(예시)

export const TIME_BONUS_ENABLED = false;
export const TIME_BONUS_THRESH_MS = 8000;     // 8초 이내 정답
export const TIME_BONUS_XP = 1;               // 추가 XP
