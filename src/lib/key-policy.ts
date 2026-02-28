import { prisma } from "@/lib/prisma";
import { cchClient, type CCHQuotaUsage } from "@/lib/cch-client";

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

const DEFAULT_DAILY_QUOTA_LIMIT = 100;
const DEFAULT_DAILY_REACTIVATE_HOUR_BJT = 8;
const DEFAULT_DAILY_REACTIVATE_MINUTE_BJT = 0;

const MIN_DAILY_QUOTA_LIMIT = 1;
const MAX_DAILY_QUOTA_LIMIT = 100000;

const SYSTEM_STATE_ID = 1;

export interface PolicyTrackedUser {
  id: string;
  cchKeyId: number | null;
  isBanned: boolean;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  lastKnownUsage: number;
  quotaWindowStartAt: Date | null;
  quotaWindowBaseUsage: number;
  keyAutoDisabled: boolean;
  autoDisabledAt: Date | null;
}

export interface KeyPolicyConfig {
  dailyQuotaLimit: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
  dailyReactivateAtLabel: string;
}

export interface UpdateKeyPolicyInput {
  dailyQuotaLimit: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
}

export interface UserPolicyState {
  usage: CCHQuotaUsage | null;
  keyStatus: "active" | "quota_exhausted";
  autoDisabledAt: Date | null;
  todayUsed: number;
  todayRemaining: number;
  nextDailyReactivateAt: Date;
  policyConfig: KeyPolicyConfig;
}

interface SystemStateRow {
  dailyQuotaLimit: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
  lastDailyReactivateAt: Date | null;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function formatDailyReactivateAtLabel(hour: number, minute: number): string {
  return `每天北京时间 ${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;
}

function normalizePolicyConfig(
  raw: Pick<
    SystemStateRow,
    "dailyQuotaLimit" | "dailyReactivateHourBjt" | "dailyReactivateMinuteBjt"
  >
): Omit<KeyPolicyConfig, "dailyReactivateAtLabel"> {
  return {
    dailyQuotaLimit: clampInteger(
      raw.dailyQuotaLimit,
      MIN_DAILY_QUOTA_LIMIT,
      MAX_DAILY_QUOTA_LIMIT
    ),
    dailyReactivateHourBjt: clampInteger(raw.dailyReactivateHourBjt, 0, 23),
    dailyReactivateMinuteBjt: clampInteger(raw.dailyReactivateMinuteBjt, 0, 59),
  };
}

function withPolicyLabel(
  config: Omit<KeyPolicyConfig, "dailyReactivateAtLabel">
): KeyPolicyConfig {
  return {
    ...config,
    dailyReactivateAtLabel: formatDailyReactivateAtLabel(
      config.dailyReactivateHourBjt,
      config.dailyReactivateMinuteBjt
    ),
  };
}

async function getOrCreateSystemState(): Promise<SystemStateRow> {
  return prisma.systemState.upsert({
    where: { id: SYSTEM_STATE_ID },
    create: {
      id: SYSTEM_STATE_ID,
      dailyQuotaLimit: DEFAULT_DAILY_QUOTA_LIMIT,
      dailyReactivateHourBjt: DEFAULT_DAILY_REACTIVATE_HOUR_BJT,
      dailyReactivateMinuteBjt: DEFAULT_DAILY_REACTIVATE_MINUTE_BJT,
      lastDailyReactivateAt: null,
    },
    update: {},
    select: {
      dailyQuotaLimit: true,
      dailyReactivateHourBjt: true,
      dailyReactivateMinuteBjt: true,
      lastDailyReactivateAt: true,
    },
  });
}

export async function getKeyPolicyConfig(): Promise<KeyPolicyConfig> {
  const state = await getOrCreateSystemState();
  const normalized = normalizePolicyConfig(state);

  if (
    normalized.dailyQuotaLimit !== state.dailyQuotaLimit ||
    normalized.dailyReactivateHourBjt !== state.dailyReactivateHourBjt ||
    normalized.dailyReactivateMinuteBjt !== state.dailyReactivateMinuteBjt
  ) {
    await prisma.systemState.update({
      where: { id: SYSTEM_STATE_ID },
      data: normalized,
    });
  }

  return withPolicyLabel(normalized);
}

export async function updateKeyPolicyConfig(
  input: UpdateKeyPolicyInput
): Promise<KeyPolicyConfig> {
  const normalized = normalizePolicyConfig(input);

  await prisma.systemState.upsert({
    where: { id: SYSTEM_STATE_ID },
    create: {
      id: SYSTEM_STATE_ID,
      ...normalized,
      lastDailyReactivateAt: null,
    },
    update: normalized,
  });

  return withPolicyLabel(normalized);
}

function getBeijingCalendarDate(date: Date): Date {
  return new Date(date.getTime() + BEIJING_OFFSET_MS);
}

function getBeijingTodayReactivateAtUtc(
  date: Date,
  hour: number,
  minute: number
): Date {
  const beijingDate = getBeijingCalendarDate(date);
  const year = beijingDate.getUTCFullYear();
  const month = beijingDate.getUTCMonth();
  const day = beijingDate.getUTCDate();
  const beijingTargetUtcMs =
    Date.UTC(year, month, day, hour, minute, 0, 0) - BEIJING_OFFSET_MS;
  return new Date(beijingTargetUtcMs);
}

function getLatestDailyReactivateAt(
  date: Date,
  hour: number,
  minute: number
): Date {
  const todayTarget = getBeijingTodayReactivateAtUtc(date, hour, minute);
  if (date >= todayTarget) return todayTarget;
  return new Date(todayTarget.getTime() - 24 * 60 * 60 * 1000);
}

export function getNextDailyReactivateAt(
  date: Date,
  hour: number,
  minute: number
): Date {
  const latest = getLatestDailyReactivateAt(date, hour, minute);
  return new Date(latest.getTime() + 24 * 60 * 60 * 1000);
}

export async function ensureDailyQuotaRefresh(
  now: Date = new Date(),
  policyConfig?: KeyPolicyConfig
): Promise<void> {
  const config = policyConfig ?? (await getKeyPolicyConfig());
  const latestRefreshAt = getLatestDailyReactivateAt(
    now,
    config.dailyReactivateHourBjt,
    config.dailyReactivateMinuteBjt
  );

  const state = await getOrCreateSystemState();
  if (
    state.lastDailyReactivateAt &&
    state.lastDailyReactivateAt >= latestRefreshAt
  ) {
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      isBanned: false,
      cchKeyId: { not: null },
    },
    select: {
      id: true,
      cchKeyId: true,
    },
  });

  await Promise.all(
    users.map(async (user) => {
      if (!user.cchKeyId) return;

      try {
        const usage = await cchClient.getKeyQuotaUsage(user.cchKeyId);
        const used = Number.isFinite(usage.used) ? usage.used : 0;

        await cchClient.toggleKeyEnabled(user.cchKeyId, true);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastKnownUsage: used,
            quotaWindowStartAt: latestRefreshAt,
            quotaWindowBaseUsage: used,
            keyAutoDisabled: false,
            autoDisabledAt: null,
          },
        });
      } catch (error) {
        console.error(`Daily quota refresh failed for user ${user.id}:`, error);
      }
    })
  );

  await prisma.systemState.update({
    where: { id: SYSTEM_STATE_ID },
    data: {
      lastDailyReactivateAt: latestRefreshAt,
    },
  });
}

export async function evaluateUserKeyPolicy(
  user: PolicyTrackedUser,
  now: Date = new Date()
): Promise<UserPolicyState> {
  const policyConfig = await getKeyPolicyConfig();
  await ensureDailyQuotaRefresh(now, policyConfig);

  const latestUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      cchKeyId: true,
      isBanned: true,
      lastLoginAt: true,
      lastActivityAt: true,
      createdAt: true,
      lastKnownUsage: true,
      quotaWindowStartAt: true,
      quotaWindowBaseUsage: true,
      keyAutoDisabled: true,
      autoDisabledAt: true,
    },
  });

  const currentUser: PolicyTrackedUser = latestUser
    ? {
        id: latestUser.id,
        cchKeyId: latestUser.cchKeyId,
        isBanned: latestUser.isBanned,
        lastLoginAt: latestUser.lastLoginAt,
        lastActivityAt: latestUser.lastActivityAt,
        createdAt: latestUser.createdAt,
        lastKnownUsage: latestUser.lastKnownUsage,
        quotaWindowStartAt: latestUser.quotaWindowStartAt,
        quotaWindowBaseUsage: latestUser.quotaWindowBaseUsage,
        keyAutoDisabled: latestUser.keyAutoDisabled,
        autoDisabledAt: latestUser.autoDisabledAt,
      }
    : user;

  let usage: CCHQuotaUsage | null = null;
  let keyAutoDisabled = currentUser.keyAutoDisabled;
  let autoDisabledAt = currentUser.autoDisabledAt;

  let todayUsed = 0;
  let todayRemaining = policyConfig.dailyQuotaLimit;

  if (currentUser.cchKeyId) {
    usage = await cchClient.getKeyQuotaUsage(currentUser.cchKeyId);
    const used = Number.isFinite(usage.used) ? usage.used : 0;

    if (used !== currentUser.lastKnownUsage) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { lastKnownUsage: used },
      });
    }

    const latestRefreshAt = getLatestDailyReactivateAt(
      now,
      policyConfig.dailyReactivateHourBjt,
      policyConfig.dailyReactivateMinuteBjt
    );

    let quotaWindowStartAt = currentUser.quotaWindowStartAt ?? latestRefreshAt;
    let quotaWindowBaseUsage = currentUser.quotaWindowBaseUsage ?? used;

    if (quotaWindowStartAt < latestRefreshAt) {
      quotaWindowStartAt = latestRefreshAt;
      quotaWindowBaseUsage = used;

      try {
        await cchClient.toggleKeyEnabled(currentUser.cchKeyId, true);
      } catch (error) {
        console.error(
          `Re-enable key on stale quota window failed for user ${currentUser.id}:`,
          error
        );
      }

      keyAutoDisabled = false;
      autoDisabledAt = null;
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          quotaWindowStartAt,
          quotaWindowBaseUsage,
          keyAutoDisabled: false,
          autoDisabledAt: null,
        },
      });
    }

    todayUsed = Math.max(0, used - quotaWindowBaseUsage);
    todayRemaining = Math.max(0, policyConfig.dailyQuotaLimit - todayUsed);

    if (!keyAutoDisabled && !currentUser.isBanned && todayUsed >= policyConfig.dailyQuotaLimit) {
      try {
        await cchClient.toggleKeyEnabled(currentUser.cchKeyId, false);
        keyAutoDisabled = true;
        autoDisabledAt = now;
        await prisma.user.update({
          where: { id: currentUser.id },
          data: {
            keyAutoDisabled: true,
            autoDisabledAt: now,
          },
        });
      } catch (error) {
        console.error(
          `Disable key on daily quota exceeded failed for user ${currentUser.id}:`,
          error
        );
      }
    }
  }

  return {
    usage,
    keyStatus: keyAutoDisabled ? "quota_exhausted" : "active",
    autoDisabledAt,
    todayUsed,
    todayRemaining,
    nextDailyReactivateAt: getNextDailyReactivateAt(
      now,
      policyConfig.dailyReactivateHourBjt,
      policyConfig.dailyReactivateMinuteBjt
    ),
    policyConfig,
  };
}
