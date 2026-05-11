export async function apiFetch(
  url: string,
  options: RequestInit = {},
  token: string | null
) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  // ❌ TOKEN EXPIRE OU INVALID
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  return res;
}