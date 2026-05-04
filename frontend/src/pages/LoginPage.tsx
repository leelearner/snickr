import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/format";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      setAuthUser(user);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? "/app/workspaces", { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setValidation("Username and password are required.");
      return;
    }
    setValidation("");
    mutation.mutate({ username: trimmedUsername, password });
  }

  return (
    <AuthLayout title="Log in to Snickr" subtitle="Welcome back.">
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Username" value={username} maxLength={30} onChange={(event) => setUsername(event.target.value)} />
        <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {validation ? <p className="text-sm text-red-600">{validation}</p> : null}
        {mutation.error ? <p className="text-sm text-red-600">{errorMessage(mutation.error)}</p> : null}
        <Button className="w-full" type="submit" isLoading={mutation.isPending}>
          Log in
        </Button>
        <p className="text-center text-sm text-slate-500">
          New to Snickr?{" "}
          <Link className="font-medium text-slate-950 underline" to="/register">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
