export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(
      0,
      "No pudimos conectar con el servidor. Revisa tu conexión e intenta nuevamente.",
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? Array.isArray(body.message)
          ? body.message.join(". ")
          : String(body.message)
        : "No pudimos conectar con el servidor. Intenta nuevamente.";
    throw new ApiError(response.status, message);
  }
  return body as T;
}
