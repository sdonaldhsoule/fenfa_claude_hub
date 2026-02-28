"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Ban,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface User {
  id: string;
  username: string;
  avatarTemplate: string;
  trustLevel: number;
  role: "admin" | "user";
  status: "normal" | "banned";
  createdAt: string;
  banReason?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "banned">(
    "all"
  );

  // 封禁弹窗状态
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  // 解封弹窗状态
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<User | null>(null);
  const [unbanLoading, setUnbanLoading] = useState(false);

  // 防抖定时器
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("获取用户列表失败");
      const data: UsersResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取用户列表失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 搜索防抖
  const handleSearchChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  // 获取头像 URL
  const getAvatarUrl = (avatarTemplate: string) => {
    if (!avatarTemplate) return "";
    const url = avatarTemplate.replace("{size}", "80");
    if (url.startsWith("http")) return url;
    return `https://linux.do${url}`;
  };

  // 封禁用户
  const handleBan = async () => {
    if (!banTarget || !banReason.trim()) {
      toast.error("请填写封禁原因");
      return;
    }
    try {
      setBanLoading(true);
      const res = await fetch(`/api/admin/users/${banTarget.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      if (!res.ok) throw new Error("封禁操作失败");
      toast.success(`已封禁用户 ${banTarget.username}`);
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "封禁操作失败");
    } finally {
      setBanLoading(false);
    }
  };

  // 解封用户
  const handleUnban = async () => {
    if (!unbanTarget) return;
    try {
      setUnbanLoading(true);
      const res = await fetch(`/api/admin/users/${unbanTarget.id}/ban`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("解封操作失败");
      toast.success(`已解封用户 ${unbanTarget.username}`);
      setUnbanDialogOpen(false);
      setUnbanTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "解封操作失败");
    } finally {
      setUnbanLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 格式化日期
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <p className="mt-1 text-sm text-gray-500">管理系统用户和权限</p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索框 */}
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜索用户名..."
            className="pl-9 bg-white border-[#E8E8E0]"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* 角色筛选 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white border-[#E8E8E0]">
              角色：{roleFilter === "all" ? "全部" : roleFilter === "admin" ? "管理员" : "用户"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setRoleFilter("all"); setPage(1); }}>
              全部
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setRoleFilter("user"); setPage(1); }}>
              用户
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setRoleFilter("admin"); setPage(1); }}>
              管理员
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 状态筛选 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white border-[#E8E8E0]">
              状态：{statusFilter === "all" ? "全部" : statusFilter === "normal" ? "正常" : "已封禁"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setStatusFilter("all"); setPage(1); }}>
              全部
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setStatusFilter("normal"); setPage(1); }}>
              正常
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setStatusFilter("banned"); setPage(1); }}>
              已封禁
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 用户表格 */}
      <div className="rounded-2xl border border-[#E8E8E0] bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAFAF5] hover:bg-[#FAFAF5]">
              <TableHead className="pl-4">用户</TableHead>
              <TableHead>信任等级</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right pr-4">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-10 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                  暂无用户数据
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  {/* 头像 + 用户名 */}
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={getAvatarUrl(user.avatarTemplate)}
                          alt={user.username}
                        />
                        <AvatarFallback className="bg-[#D2691E]/10 text-[#D2691E] text-xs font-medium">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-gray-900">
                        {user.username}
                      </span>
                    </div>
                  </TableCell>

                  {/* 信任等级 */}
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      Lv.{user.trustLevel}
                    </span>
                  </TableCell>

                  {/* 角色 */}
                  <TableCell>
                    {user.role === "admin" ? (
                      <Badge className="bg-[#D2691E] text-white hover:bg-[#D2691E]/90 border-none">
                        管理员
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-gray-600">
                        用户
                      </Badge>
                    )}
                  </TableCell>

                  {/* 状态 */}
                  <TableCell>
                    {user.status === "normal" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border hover:bg-emerald-50">
                        正常
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-200 border hover:bg-red-50">
                        已封禁
                      </Badge>
                    )}
                  </TableCell>

                  {/* 注册时间 */}
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </span>
                  </TableCell>

                  {/* 操作 */}
                  <TableCell className="text-right pr-4">
                    {user.status === "normal" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setBanTarget(user);
                          setBanReason("");
                          setBanDialogOpen(true);
                        }}
                      >
                        <Ban className="size-3.5" />
                        封禁
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => {
                          setUnbanTarget(user);
                          setUnbanDialogOpen(true);
                        }}
                      >
                        <ShieldCheck className="size-3.5" />
                        解封
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          共 <span className="font-medium text-gray-700">{total}</span> 个用户
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-[#E8E8E0]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <span className="px-3 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-[#E8E8E0]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* 封禁弹窗 */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>封禁用户</DialogTitle>
            <DialogDescription>
              确定要封禁用户{" "}
              <span className="font-semibold text-gray-900">
                {banTarget?.username}
              </span>{" "}
              吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              封禁原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-[#E8E8E0] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#D2691E] focus:ring-2 focus:ring-[#D2691E]/20 resize-none"
              rows={3}
              placeholder="请输入封禁原因..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
              disabled={banLoading}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleBan}
              disabled={banLoading || !banReason.trim()}
            >
              {banLoading ? "处理中..." : "确认封禁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 解封弹窗 */}
      <Dialog open={unbanDialogOpen} onOpenChange={setUnbanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解封用户</DialogTitle>
            <DialogDescription>
              确定要解封用户{" "}
              <span className="font-semibold text-gray-900">
                {unbanTarget?.username}
              </span>{" "}
              吗？解封后该用户将恢复正常使用权限。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnbanDialogOpen(false)}
              disabled={unbanLoading}
            >
              取消
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleUnban}
              disabled={unbanLoading}
            >
              {unbanLoading ? "处理中..." : "确认解封"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
