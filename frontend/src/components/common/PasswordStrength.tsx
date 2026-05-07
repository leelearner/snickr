interface Result {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function score(password: string): Result {
  if (!password) return { score: 0, label: '', color: 'bg-slate-200' };
  let s = 0;
  if (password.length >= 8) s++;
  if (password.length >= 12) s++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
  if (/\d/.test(password)) s++;
  if (/[^a-zA-Z0-9]/.test(password)) s++;
  if (s > 4) s = 4;
  if (password.length < 6) s = 1;

  const colors = ['bg-slate-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score: s as Result['score'], label: labels[s], color: colors[s] };
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const result = score(password);

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= result.score ? result.color : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Strength: <span className="font-medium text-slate-700">{result.label}</span>
      </p>
    </div>
  );
}
