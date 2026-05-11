import { useState } from 'react';

type LoginPageProps = {
  onLogin: (token: string) => void;
};

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const response = await fetch('http://127.0.0.1:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (data.success && data.token) {
      onLogin(data.token);
    } else {
      setError(data.message || 'Login failed');
    }
  };

  return (
    <form
  onSubmit={handleSubmit}
  className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5"
>
  <div className="flex flex-col gap-2">
    <label className="text-sm text-zinc-400 font-medium">
      Username
    </label>

    <input
      type="text"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      placeholder="Enter your username"
      className="
        bg-zinc-800
        border border-zinc-700
        rounded-xl
        px-4 py-3
        text-white
        outline-none
        transition
        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-500/30
      "
    />
  </div>

  <div className="flex flex-col gap-2">
    <label className="text-sm text-zinc-400 font-medium">
      Password
    </label>

    <input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Enter your password"
      className="
        bg-zinc-800
        border border-zinc-700
        rounded-xl
        px-4 py-3
        text-white
        outline-none
        transition
        focus:border-blue-500
        focus:ring-2
        focus:ring-blue-500/30
      "
    />
  </div>

  {error && (
    <div
      className="
        bg-red-500/10
        border border-red-500/20
        text-red-400
        text-sm
        rounded-xl
        px-4 py-3
      "
    >
      {error}
    </div>
  )}

  <button
    type="submit"
    className="
      bg-blue-600
      hover:bg-blue-500
      active:scale-[0.98]
      transition
      text-white
      font-semibold
      rounded-xl
      py-3
      shadow-lg
      shadow-blue-500/20
    "
  >
    Login
  </button>
</form>
  );
}

export default LoginPage;
