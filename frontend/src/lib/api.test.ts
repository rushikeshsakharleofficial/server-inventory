import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

function mockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return {
    status,
    ok,
    headers: { get: (name: string) => (name === "content-type" ? "application/json" : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(status: number, body: string, ok = status >= 200 && status < 300) {
  return {
    status,
    ok,
    headers: { get: () => "text/plain" },
    json: async () => { throw new Error("not json"); },
    text: async () => body,
  };
}

describe("api()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    (globalThis as any).window = { location: { protocol: "http:", hostname: "localhost", pathname: "/servers", assign: vi.fn() } };
    (globalThis as any).location = (globalThis as any).window.location;
    (globalThis as any).localStorage = mockLocalStorage();
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON body on a successful response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { hello: "world" }));
    const { api } = await import("./api");

    const result = await api<{ hello: string }>("/api/thing");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns undefined for a 204 No Content response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, null));
    const { api } = await import("./api");

    const result = await api("/api/thing");
    expect(result).toBeUndefined();
  });

  it("appends a query string, skipping undefined/null/empty values", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { api } = await import("./api");

    await api("/api/things", { query: { a: 1, b: undefined, c: null, d: "", e: "x" } });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("a=1");
    expect(calledUrl).toContain("e=x");
    expect(calledUrl).not.toContain("b=");
    expect(calledUrl).not.toContain("c=");
    expect(calledUrl).not.toContain("d=");
  });

  it("sends Authorization header when a token is stored", async () => {
    (globalThis as any).localStorage.setItem("sic.token", "tok-123");
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { api } = await import("./api");

    await api("/api/thing");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok-123");
  });

  it("sets Content-Type and serializes the json option", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { api } = await import("./api");

    await api("/api/thing", { method: "POST", json: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws ApiError with the detail message on a JSON error body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, { detail: "Validation failed" }));
    const { api, ApiError } = await import("./api");

    await expect(api("/api/thing")).rejects.toMatchObject(
      new ApiError(422, "Validation failed", { detail: "Validation failed" }),
    );
  });

  it("throws ApiError with the raw text on a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(textResponse(500, "Internal Server Error"));
    const { api } = await import("./api");

    await expect(api("/api/thing")).rejects.toMatchObject({ status: 500, message: "Internal Server Error" });
  });

  it("clears the token and redirects to /login on a 401 outside the login page", async () => {
    (globalThis as any).localStorage.setItem("sic.token", "tok-123");
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Unauthorized" }));
    const { api } = await import("./api");

    await expect(api("/api/thing")).rejects.toBeTruthy();

    expect((globalThis as any).localStorage.getItem("sic.token")).toBeNull();
    expect((globalThis as any).window.location.assign).toHaveBeenCalledWith("/login");
  });

  it("does not redirect on a 401 while already on the login page", async () => {
    (globalThis as any).window.location.pathname = "/login";
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Unauthorized" }));
    const { api } = await import("./api");

    await expect(api("/api/thing")).rejects.toBeTruthy();

    expect((globalThis as any).window.location.assign).not.toHaveBeenCalled();
  });
});
