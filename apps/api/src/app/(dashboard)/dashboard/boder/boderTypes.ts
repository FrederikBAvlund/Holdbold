export type FineTemplate = {
  id: string;
  title: string;
  amount: number;
  category: "SOME" | "FAELLES" | "SPILLER" | "DIVERSE";
  description?: string | null;
  status?: string;
  createdAt: string;
  createdById?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  createdBy?: { id: string; name: string | null } | null;
  approvedBy?: { id: string; name: string | null } | null;
  rejectedBy?: { id: string; name: string | null } | null;
};

export type Member = {
  role: string;
  user: {
    id: string;
    name: string;
    email?: string | null;
  };
};

export type FineItem = {
  id: string;
  amount: number;
  reason: string;
  description?: string | null;
  status: string;
  createdAt: string;
  createdById?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  createdByLabel?: string | null;
  createdBy?: { name: string | null } | null;
  approvedBy?: { id: string; name: string | null } | null;
  user?: { id: string; name: string | null } | null;
  template?: FineTemplate | null;
  event?: { id: string; title: string; date: string } | null;
};

export type PendingPayment = {
  userId: string;
  name: string;
  total: number;
  count: number;
  requestedAt: string | null;
};

export type FineCollection = {
  id: string;
  deadlineAt: string;
  intervalHours: number;
  createdAt: string;
  template: {
    id: string;
    title: string;
    amount: number;
  };
};
