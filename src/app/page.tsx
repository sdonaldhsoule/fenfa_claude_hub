import { Terminal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  missing_params: "缺少必要参数",
  invalid_state: "安全验证失败，请重试",
  trust_level_too_low: "LinuxDO 信任等级不足，需要等级 1 及以上",
  account_restricted: "您的 LinuxDO 账号受限",
  banned: "您已被封禁",
  cch_creation_failed: "API Key 创建失败，请稍后重试",
  cch_reactivate_failed: "密钥重新激活失败，请稍后重试",
  auth_failed: "登录失败，请重试",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const reason = params.reason;

  let errorMessage = "";
  if (error) {
    errorMessage = errorMessages[error] || "发生未知错误，请重试";
    if (error === "banned" && reason) {
      errorMessage = `${errorMessage}：${reason}`;
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF5] flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-sm border bg-white">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D2691E] to-[#E8913A] flex items-center justify-center shadow-md">
              <Terminal className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
            CCH Distributor
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Codex CLI GPT 模型 API Key 分发站
          </p>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Login Button */}
          <a href="/api/auth/login" className="block mb-8">
            <Button className="w-full h-11 bg-gradient-to-r from-[#D2691E] to-[#E8913A] hover:from-[#C05E1A] hover:to-[#D68032] text-white font-medium rounded-lg text-sm cursor-pointer transition-all">
              LinuxDO 账号登录
            </Button>
          </a>

          {/* Instructions */}
          <div className="space-y-1 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              使用说明
            </h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#D2691E] to-[#E8913A] text-white text-xs flex items-center justify-center font-medium">
                  1
                </span>
                <span>使用 LinuxDO 账号登录（需信任等级 &gt;= 1）</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#D2691E] to-[#E8913A] text-white text-xs flex items-center justify-center font-medium">
                  2
                </span>
                <span>登录后自动获取 API Key</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#D2691E] to-[#E8913A] text-white text-xs flex items-center justify-center font-medium">
                  3
                </span>
                <span>将 API Key 配置到 Codex CLI</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-[#D2691E] to-[#E8913A] text-white text-xs flex items-center justify-center font-medium">
                  4
                </span>
                <span>使用 GPT 模型开始开发</span>
              </li>
            </ol>
          </div>

          {/* Key Policy */}
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <h3 className="mb-2 text-sm font-medium text-amber-900">
              Key 使用限制
            </h3>
            <ol className="space-y-1 text-xs text-amber-800">
              <li>1. 连续无登录且无 API 调用达到策略阈值，密钥会自动停用</li>
              <li>2. 每天固定时刻统一重新激活所有密钥</li>
              <li>3. 若被停用，重新访问登录页面并登录即可恢复</li>
              <li>4. 以上阈值由管理员在后台“策略配置”页面管理</li>
            </ol>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-gray-400 text-center">
            需要 LinuxDO 信任等级 1 及以上
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
