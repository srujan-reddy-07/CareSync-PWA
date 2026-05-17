const BASE = "/api";

export function getToken(): string | null {
  return localStorage.getItem("cs_token");
}
export function setToken(token: string) {
  localStorage.setItem("cs_token", token);
}
export function clearToken() {
  localStorage.removeItem("cs_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    sendOtp: (phone: string, role: string) =>
      request("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone, role }),
      }),
    verifyOtp: (phone: string, otp: string, name?: string, role?: string) =>
      request<{ token: string; user: { id: string; name: string; phone: string; role: string } }>(
        "/auth/verify-otp",
        { method: "POST", body: JSON.stringify({ phone, otp, name, role }) }
      ),
    me: () =>
      request<{ id: string; name: string; phone: string; role: string }>("/auth/me"),
  },
  medicines: {
    list: () => request<any[]>("/medicines"),
    add: (med: { name: string; stock: number; doseTime: string; doseQuantity: number }) =>
      request<any>("/medicines", { method: "POST", body: JSON.stringify(med) }),
    update: (id: string, updates: Partial<{ taken: boolean; stock: number }>) =>
      request<any>(`/medicines/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      request<any>(`/medicines/${id}`, { method: "DELETE" }),
    reset: () => request<any>("/medicines/reset", { method: "POST" }),
  },
  vault: {
    list: () => request<any[]>("/vault"),
    add: (doc: { name: string; category: string; date: string; fileData?: string; isDemo?: boolean }) =>
      request<any>("/vault", { method: "POST", body: JSON.stringify(doc) }),
    delete: (id: string) =>
      request<any>(`/vault/${id}`, { method: "DELETE" }),
  },
  caretaker: {
    patients: () => request<any[]>("/caretaker/patients"),
    link: (patientPhone: string) =>
      request<any>("/caretaker/link", {
        method: "POST",
        body: JSON.stringify({ patientPhone }),
      }),
    addMedicine: (patientId: string, med: { name: string; stock: number; doseTime: string; doseQuantity: number; dosage?: string }) =>
      request<any>(`/caretaker/patients/${patientId}/medicines`, {
        method: "POST",
        body: JSON.stringify(med),
      }),
    deleteMedicine: (patientId: string, medicineId: string) =>
      request<any>(`/caretaker/patients/${patientId}/medicines/${medicineId}`, { method: "DELETE" }),
    markGiven: (patientId: string, medicineId: string, taken: boolean) =>
      request<any>(`/caretaker/patients/${patientId}/medicines/${medicineId}`, {
        method: "PATCH",
        body: JSON.stringify({ taken }),
      }),
    refillStock: (patientId: string, medicineId: string, addStock: number) =>
      request<any>(`/caretaker/patients/${patientId}/medicines/${medicineId}`, {
        method: "PATCH",
        body: JSON.stringify({ addStock }),
      }),
  },
};
