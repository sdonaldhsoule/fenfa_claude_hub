"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, Activity, Monitor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  activeSessions: number;
  [key: string]: unknown;
}

const statCards = [
  { key: "totalUsers" as const, label: "总用户数", icon: Users, color: "#D2691E" },
  { key: "activeUsers" as const, label: "活跃用户", icon: UserCheck, color: "#E8913A" },
  { key: "totalRequests" as const, label: "总请求", icon: Activity, color: "#D2691E" },
  { key: "activeSessions" as const, label: "当前会话", icon: Monitor, color: "#E8913A" },
];

function ExtraStatsSection({ stats }: { stats: StatsData }) {
  const trend24h = stats.trend24h;
  const topUsers = stats.topUsers;

  const hasTrend = Array.isArray(trend24h) && trend24h.length > 0;
  const hasTopUsers = Array.isArray(topUsers) && topUsers.length > 0;

  if (!hasTrend && !hasTopUsers) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {hasTrend && (
        <Card
          className="border-none bg-white shadow-sm"
          style={{ borderRadius: "16px" }}
        >
          <CardContent>
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              24小时趋势
            </h3>
            <div className="flex items-end gap-1 h-32">
              {(trend24h as number[]).map((value: number, index: number) => {
                const maxVal = Math.max(...(trend24h as number[]), 1);
                return (
                  <div
                    key={index}
                    className="flex-1 rounded-t"
                    style={{
                      backgroundColor: "#D2691E",
                      opacity: 0.4 + (value / maxVal) * 0.6,
                      height: `${Math.max(4, (value / maxVal) * 100)}%`,
                    }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {hasTopUsers && (
        <Card
          className="border-none bg-white shadow-sm"
          style={{ borderRadius: "16px" }}
        >
          <CardContent>
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              用量排行
            </h3>
            <div className="space-y-3">
              {(topUsers as Array<{ username: string; calls: number }>).map(
                (user, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: index < 3 ? "#D2691E" : "#ccc" }}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700">{user.username}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      {user.calls.toLocaleString()} 次
                    </span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("获取统计数据失败");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统概览</h1>
        <p className="mt-1 text-sm text-gray-500">查看系统运行状态和关键指标</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="border-none bg-white shadow-sm hover:shadow-md transition-shadow"
              style={{ borderRadius: "16px" }}
            >
              <CardContent className="flex items-center gap-4 pt-0">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="size-6" style={{ color: card.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {stats
                        ? (typeof stats[card.key] === "number"
                            ? (stats[card.key] as number).toLocaleString()
                            : "0")
                        : "0"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 额外数据展示区域 */}
      {stats && (
        <ExtraStatsSection stats={stats} />
      )}
    </div>
  );
}
