"use client";

import { useEffect, useState } from "react";
import { Settings, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PolicyConfig {
  inactivityHours: number;
  dailyReactivateHourBjt: number;
  dailyReactivateMinuteBjt: number;
  dailyReactivateAtLabel: string;
  nextDailyReactivateAt: string;
}

interface PolicyResponse {
  policy: PolicyConfig;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);

  const [inactivityHours, setInactivityHours] = useState("5");
  const [dailyHour, setDailyHour] = useState("8");
  const [dailyMinute, setDailyMinute] = useState("0");

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("获取策略配置失败");
      const data: PolicyResponse = await res.json();
      setPolicy(data.policy);
      setInactivityHours(String(data.policy.inactivityHours));
      setDailyHour(String(data.policy.dailyReactivateHourBjt));
      setDailyMinute(String(data.policy.dailyReactivateMinuteBjt));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取策略配置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSave = async () => {
    const inactivity = Number(inactivityHours);
    const hour = Number(dailyHour);
    const minute = Number(dailyMinute);

    if (!Number.isInteger(inactivity) || inactivity < 1 || inactivity > 168) {
      toast.error("停用时长必须是 1 到 168 之间的整数");
      return;
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      toast.error("恢复小时必须是 0 到 23 之间的整数");
      return;
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast.error("恢复分钟必须是 0 到 59 之间的整数");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inactivityHours: inactivity,
          dailyReactivateHourBjt: hour,
          dailyReactivateMinuteBjt: minute,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存策略失败");
      }

      setPolicy(data.policy as PolicyConfig);
      toast.success("策略配置已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存策略失败");
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">策略配置</h1>
        <p className="mt-1 text-sm text-gray-500">
          配置密钥自动停用与每日统一恢复规则
        </p>
      </div>

      <Card className="rounded-2xl border border-[#E8E8E0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4 text-[#D2691E]" />
            密钥策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                无活跃自动停用时长（小时）
              </label>
              <Input
                type="number"
                min={1}
                max={168}
                value={inactivityHours}
                onChange={(e) => setInactivityHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                每日恢复时间（小时，北京时间）
              </label>
              <Input
                type="number"
                min={0}
                max={23}
                value={dailyHour}
                onChange={(e) => setDailyHour(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                每日恢复时间（分钟，北京时间）
              </label>
              <Input
                type="number"
                min={0}
                max={59}
                value={dailyMinute}
                onChange={(e) => setDailyMinute(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E8E0] bg-[#FAFAF5] p-4 text-sm text-gray-700">
            <p>
              当前策略：连续{" "}
              <span className="font-semibold">{policy?.inactivityHours ?? "-"}</span>{" "}
              小时无登录且无 API 调用则自动停用密钥；
              <span className="font-semibold">
                {" "}
                {policy?.dailyReactivateAtLabel ?? "-"}
              </span>{" "}
              统一恢复。
            </p>
            <p className="mt-2 flex items-center gap-1 text-gray-500">
              <Clock3 className="size-4" />
              下一次统一恢复：{formatDateTime(policy?.nextDailyReactivateAt)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="bg-[#D2691E] text-white hover:bg-[#BF5F1A]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存配置"}
            </Button>
            <Button variant="outline" onClick={fetchPolicy} disabled={saving}>
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
