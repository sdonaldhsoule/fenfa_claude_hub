import { prisma } from "@/lib/prisma";
import { cchClient, type CCHQuotaUsage } from "@/lib/cch-client";

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8
const DEFAULT_INACTIVITY_HOURS = 5;
const DEFAULT_DAILY_REACTIVATE_HOUR_BJT = 8;
const DEFAULT_DAILY_REACTIVATE_MINUTE_BJT = 0;

const MIN_INACTIVITY_HOURS = 1;
const MAX_INACTIVITY_HOURS = 168;

const SYSTEM_STATE_ID = 1;

export interface PolicyTrackedUser {
  id: string;
  cchKeyId: number | null;
  isBanned: boolean;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  lastKnownUsage: number;
  keyAutoDisabled: boolean;
  autoDisabledAt: Date | null;
}

export interface KeyPolicyConfig {
  inactivityHours: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
  dailyReactivateAtLabel: string;
}

export interface UpdateKeyPolicyInput {
  inactivityHours: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
}

export interface UserPolicyState {
  usage: CCHQuotaUsage | null;
  keyStatus: "active" | "auto_disabled";
  autoDisabledAt: Date | null;
  lastActivityAt: Date;
  nextDailyReactivateAt: Date;
  policyConfig: KeyPolicyConfig;
}

interface SystemStateRow {
  inactivityHours: number;
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
    "inactivityHours" | "dailyReactivateHourBjt" | "dailyReactivateMinuteBjt"
  >
): Omit<KeyPolicyConfig, "dailyReactivateAtLabel"> {
  return {
    inactivityHours: clampInteger(
      raw.inactivityHours,
      MIN_INACTIVITY_HOURS,
      MAX_INACTIVITY_HOURS
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
      inactivityHours: DEFAULT_INACTIVITY_HOURS,
      dailyReactivateHourBjt: DEFAULT_DAILY_REACTIVATE_HOUR_BJT,
      dailyReactivateMinuteBjt: DEFAULT_DAILY_REACTIVATE_MINUTE_BJT,
      lastDailyReactivateAt: null,
    },
    update: {},
    select: {
      inactivityHours: true,
      dailyReactivateHourBjt: true,
      dailyReactivateMinuteBjt: true,
      lastDailyReactivateAt: true,
    },
  });
}

export async function getKeyPolicyConfig(): Promise<KeyPolicyConfig> {
  const state = await getOrCreateSystemState();
  const normalized = normalizePolicyConfig(state);

  // 自动修正越界配置，避免策略异常
  if (
    normalized.inactivityHours !== state.inactivityHours ||
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

function getLastActivityAt(user: PolicyTrackedUser): Date {
  return user.lastActivityAt ?? user.lastLoginAt ?? user.createdAt;
}

export async function ensureDailyKeyReactivation(
  now: Date = new Date(),
  policyConfig?: KeyPolicyConfig
): Promise<void> {
  const config = policyConfig ?? (await getKeyPolicyConfig());
  const latestReactivateAt = getLatestDailyReactivateAt(
    now,
    config.dailyReactivateHourBjt,
    config.dailyReactivateMinuteBjt
  );

  const state = await getOrCreateSystemState();
  if (
    state.lastDailyReactivateAt &&
    state.lastDailyReactivateAt >= latestReactivateAt
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

  const successIds: string[] = [];
  await Promise.all(
    users.map(async (user) => {
      if (!user.cchKeyId) return;
      try {
        await cchClient.toggleKeyEnabled(user.cchKeyId, true);
        successIds.push(user.id);
      } catch (error) {
        console.error(
          `Daily key reactivation failed for user ${user.id}:`,
          error
        );
      }
    })
  );

  if (successIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: successIds },
        keyAutoDisabled: true,
      },
      data: {
        keyAutoDisabled: false,
        autoDisabledAt: null,
      },
    });
  }

  await prisma.systemState.update({
    where: { id: SYSTEM_STATE_ID },
    data: {
      lastDailyReactivateAt: latestReactivateAt,
    },
  });
}

export async function evaluateUserKeyPolicy(
  user: PolicyTrackedUser,
  now: Date = new Date()
): Promise<UserPolicyState> {
  const policyConfig = await getKeyPolicyConfig();
  await ensureDailyKeyReactivation(now, policyConfig);

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
        keyAutoDisabled: latestUser.keyAutoDisabled,
        autoDisabledAt: latestUser.autoDisabledAt,
      }
    : user;

  let usage: CCHQuotaUsage | null = null;
  let keyAutoDisabled = currentUser.keyAutoDisabled;
  let autoDisabledAt = currentUser.autoDisabledAt;
  let lastActivityAt = getLastActivityAt(currentUser);
  let lastKnownUsage = currentUser.lastKnownUsage ?? 0;

  if (currentUser.cchKeyId) {
    usage = await cchClient.getKeyQuotaUsage(currentUser.cchKeyId);
    const used = Number.isFinite(usage.used) ? usage.used : 0;

    if (used > lastKnownUsage) {
      lastKnownUsage = used;
      lastActivityAt = now;
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          lastKnownUsage,
          lastActivityAt,
        },
      });
    } else if (used !== lastKnownUsage) {
      lastKnownUsage = used;
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          lastKnownUsage,
        },
      });
    }

    const inactivityLimitMs = policyConfig.inactivityHours * 60 * 60 * 1000;
    const inactiveTooLong =
      now.getTime() - lastActivityAt.getTime() >= inactivityLimitMs;
    if (!keyAutoDisabled && !currentUser.isBanned && inactiveTooLong) {
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
          `Auto disable key failed for user ${currentUser.id}:`,
          error
        );
      }
    }
  }

  return {
    usage,
    keyStatus: keyAutoDisabled ? "auto_disabled" : "active",
    autoDisabledAt,
    lastActivityAt,
    nextDailyReactivateAt: getNextDailyReactivateAt(
      now,
      policyConfig.dailyReactivateHourBjt,
      policyConfig.dailyReactivateMinuteBjt
    ),
    policyConfig,
  };
}

export async function reactivateUserKeyOnLogin(
  user: Pick<
    PolicyTrackedUser,
    "id" | "cchKeyId" | "keyAutoDisabled" | "lastKnownUsage"
  >
): Promise<number> {
  let usageUsed = user.lastKnownUsage ?? 0;

  if (user.cchKeyId) {
    if (user.keyAutoDisabled) {
      await cchClient.toggleKeyEnabled(user.cchKeyId, true);
    }

    const usage = await cchClient.getKeyQuotaUsage(user.cchKeyId);
    usageUsed = Number.isFinite(usage.used) ? usage.used : usageUsed;
  }

  return usageUsed;
}
