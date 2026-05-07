import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/format";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { PasswordStrength } from "../components/common/PasswordStrength";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      setAuthUser(user);
      navigate("/app/workspaces", { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      email: email.trim(),
      username: username.trim(),
      nickname: nickname.trim() || null,
      password,
    };
    if (!payload.email || !payload.username || !payload.password) {
      setValidation("Email, username, and password are required.");
      return;
    }
    if (!EMAIL_PATTERN.test(payload.email)) {
      setValidation("Please enter a valid email address.");
      return;
    }
    if (payload.username.length > 30 || (payload.nickname?.length ?? 0) > 30) {
      setValidation("Username and nickname must be 30 characters or fewer.");
      return;
    }
    if (password !== confirmPassword) {
      setValidation("Passwords do not match.");
      return;
    }
    setValidation("");
    mutation.mutate(payload);
  }

  return (
    <AuthLayout title="Create your account" subtitle="Sign up to start collaborating with your team.">
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Username" value={username} maxLength={30} onChange={(event) => setUsername(event.target.value)} />
        <Input label="Nickname" optional value={nickname} maxLength={30} onChange={(event) => setNickname(event.target.value)} />
        <div>
          <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordStrength password={password} />
        </div>
        <Input label="Confirm password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {validation ? <p className="text-sm text-red-600">{validation}</p> : null}
        {mutation.error ? <p className="text-sm text-red-600">{errorMessage(mutation.error)}</p> : null}
        <Button className="w-full" type="submit" isLoading={mutation.isPending}>
          Register
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link className="font-medium text-slate-950 underline" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
