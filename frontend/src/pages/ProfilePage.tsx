import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common/Avatar";
import { Button } from "../components/common/Button";
import { ErrorState } from "../components/common/ErrorState";
import { Input } from "../components/common/Input";
import { MainContent } from "../components/layout/MainContent";
import { errorMessage } from "../utils/format";
import { queryKeys } from "../utils/queryKeys";

export function ProfilePage() {
  const { user, setAuthUser } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user?.email ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const profileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async (updated) => {
      setAuthUser(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setMessage("Profile updated.");
    },
  });
  const passwordMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async (updated) => {
      setAuthUser(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    },
  });

  function updateProfile(event: FormEvent) {
    event.preventDefault();
    const payload = { email: email.trim(), nickname: nickname.trim() || null };
    if (!payload.email || (payload.nickname?.length ?? 0) > 30) {
      setMessage("Email is required and nickname must be 30 characters or fewer.");
      return;
    }
    setMessage("");
    profileMutation.mutate(payload);
  }

  function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setMessage("Current password and new password are required.");
      return;
    }
    setMessage("");
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  const displayName = user?.nickname ?? user?.username ?? "";

  return (
    <MainContent>
      <div className="flex items-center gap-4">
        <Avatar name={displayName} className="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-slate-950">{displayName}</h1>
          <p className="truncate text-sm text-slate-500">@{user?.username}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-5" onSubmit={updateProfile}>
          <h2 className="text-base font-semibold text-slate-950">Account details</h2>
          <Input label="Username" value={user?.username ?? ""} disabled />
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Nickname" value={nickname} maxLength={30} onChange={(event) => setNickname(event.target.value)} />
          {profileMutation.error ? <ErrorState error={profileMutation.error} /> : null}
          <Button type="submit" isLoading={profileMutation.isPending}>Save profile</Button>
        </form>
        <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-5" onSubmit={updatePassword}>
          <h2 className="text-base font-semibold text-slate-950">Change password</h2>
          <Input label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <Input label="New password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          {passwordMutation.error ? <ErrorState error={passwordMutation.error} /> : null}
          <Button type="submit" isLoading={passwordMutation.isPending}>Change password</Button>
        </form>
      </div>
      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      {(profileMutation.error || passwordMutation.error) ? (
        <p className="mt-2 text-sm text-red-600">{errorMessage(profileMutation.error ?? passwordMutation.error)}</p>
      ) : null}
    </MainContent>
  );
}
