// Thin fetch wrapper. `credentials: "include"` ships the session cookie so the
// server can identify the signed-in rider on every request.
async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed. Please try again.");
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  postJson: (path, body) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
  postForm: (path, formData) =>
    request(path, {
      method: "POST",
      body: formData
    })
};
