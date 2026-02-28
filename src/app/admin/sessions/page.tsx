"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, RefreshCw, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Session {
  id: string;
  username: string;
  model: string;
  startedAt: string;
  status: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/sessions");
      if (!res.ok) throw new Error("获取会话数据失败");
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : data.sessions ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取会话数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 每 30 秒自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // 计算持续时间
  const formatDuration = (dateStr: string) => {
    try {
      const start = new Date(dateStr).getTime();
      const now = Date.now();
      const diffMs = now - start;
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m`;
      return "刚刚";
    } catch {
      return "-";
    }
  };

  // 状态颜色
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 border";
      case "idle":
        return "bg-amber-50 text-amber-700 border-amber-200 border";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200 border";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "活跃";
      case "idle":
        return "空闲";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">活跃会话</h1>
          <p className="mt-1 text-sm text-gray-500">
            监控当前系统中的实时会话 · 每 30 秒自动刷新
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            上次刷新: {lastRefresh.toLocaleTimeString("zh-CN")}
          </span>
          <button
            onClick={fetchSessions}
            className="flex items-center gap-1.5 rounded-lg border border-[#E8E8E0] bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-[#FAFAF5]"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 会话统计 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-[#E8E8E0]">
          <Monitor className="size-4 text-[#D2691E]" />
          <span className="text-sm text-gray-600">当前会话数</span>
          <span className="text-lg font-bold text-gray-900">
            {loading ? <Skeleton className="inline-block h-6 w-6" /> : sessions.length}
          </span>
        </div>
      </div>

      {/* 会话列表 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="border-[#E8E8E0] bg-white shadow-sm"
              style={{ borderRadius: "16px" }}
            >
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E8E8E0] bg-white py-20">
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#D2691E15" }}
          >
            <Inbox className="size-8 text-[#D2691E]" />
          </div>
          <p className="text-lg font-medium text-gray-600">当前没有活跃会话</p>
          <p className="mt-1 text-sm text-gray-400">
            会话开始后将自动显示在这里
          </p>
        </div>
      ) : (
        /* 会话卡片列表 */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="border-[#E8E8E0] bg-white shadow-sm hover:shadow-md transition-shadow"
              style={{ borderRadius: "16px" }}
            >
              <CardContent className="space-y-3">
                {/* 用户名 + 状态 */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    {session.username}
                  </span>
                  <Badge className={getStatusStyle(session.status)}>
                    {getStatusLabel(session.status)}
                  </Badge>
                </div>

                {/* 模型 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">模型</span>
                  <span className="rounded-md bg-[#FAFAF5] px-2 py-0.5 text-xs font-medium text-gray-700">
                    {session.model}
                  </span>
                </div>

                {/* 开始时间 + 持续时长 */}
                <div className="flex items-center justify-between border-t border-[#E8E8E0] pt-3">
                  <span className="text-xs text-gray-400">
                    {formatTime(session.startedAt)}
                  </span>
                  <span className="text-xs font-medium text-[#D2691E]">
                    {formatDuration(session.startedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
