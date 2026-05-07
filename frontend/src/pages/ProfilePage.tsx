import { FormEvent, useState } from 'react';
import { Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuth } from '../context/useAuth';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { PasswordStrength } from '../components/common/PasswordStrength';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { MainContent } from '../components/layout/MainContent';
import { errorMessage } from '../utils/format';
import { displayName as safeDisplayName } from '../utils/displayName';
import { queryKeys } from '../utils/queryKeys';

export function ProfilePage() {
  const { user, setAuthUser } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user?.email ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [accountFlash, setAccountFlash] = useState('');
  const [passwordFlash, setPasswordFlash] = useState('');
  const [accountValidation, setAccountValidation] = useState('');
  const [passwordValidation, setPasswordValidation] = useState('');

  const profileMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async (updated) => {
      setAuthUser(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setAccountFlash('Profile updated.');
    },
  });
  const passwordMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async (updated) => {
      setAuthUser(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordFlash('Password updated.');
    },
  });

  function updateProfile(event: FormEvent) {
    event.preventDefault();
    setAccountFlash('');
    const payload = { email: email.trim(), nickname: nickname.trim() || null };
    if (!payload.email) {
      setAccountValidation('Email is required.');
      return;
    }
    if (!EMAIL_PATTERN.test(payload.email)) {
      setAccountValidation('Please enter a valid email address.');
      return;
    }
    if ((payload.nickname?.length ?? 0) > 30) {
      setAccountValidation('Nickname must be 30 characters or fewer.');
      return;
    }
    setAccountValidation('');
    profileMutation.mutate(payload);
  }

  function updatePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordFlash('');
    if (!currentPassword || !newPassword) {
      setPasswordValidation('Both current and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordValidation('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordValidation('New passwords do not match.');
      return;
    }
    setPasswordValidation('');
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  const displayName = safeDisplayName(user?.nickname, user?.username);

  return (
    <MainContent>
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <Avatar name={displayName} className="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-slate-950">{displayName}</h1>
          <p className="truncate text-sm text-slate-500">@{user?.username}</p>
        </div>
      </div>

      <form className="border-b border-slate-200 py-6" onSubmit={updateProfile}>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-950">Account</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Update how teammates find you and where Snickr can reach you.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Username" value={user?.username ?? ''} disabled />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label="Nickname"
              optional
              value={nickname}
              maxLength={30}
              onChange={(event) => setNickname(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown next to your messages. Leave empty to use your username.
            </p>
          </div>
        </div>
        {accountValidation ? (
          <p className="mt-3 text-sm text-red-600">{accountValidation}</p>
        ) : null}
        {profileMutation.error ? (
          <p className="mt-3 text-sm text-red-600">{errorMessage(profileMutation.error)}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          {accountFlash ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              {accountFlash}
            </p>
          ) : (
            <span />
          )}
          <Button type="submit" isLoading={profileMutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>

      <form className="py-6" onSubmit={updatePassword}>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-950">Password</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Confirm your current password before setting a new one.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
          <div className="hidden sm:block" />
          <div>
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <PasswordStrength password={newPassword} />
          </div>
          <Input
            label="Confirm new password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        {passwordValidation ? (
          <p className="mt-3 text-sm text-red-600">{passwordValidation}</p>
        ) : null}
        {passwordMutation.error ? (
          <p className="mt-3 text-sm text-red-600">{errorMessage(passwordMutation.error)}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          {passwordFlash ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              {passwordFlash}
            </p>
          ) : (
            <span />
          )}
          <Button type="submit" isLoading={passwordMutation.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </MainContent>
  );
}
