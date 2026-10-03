"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApplicationInbox,
  TeamPanel,
  HouseholdPanel,
  PerformancePanel,
  type Identity,
} from "./components/workspace";
import { LeaseActions } from "./components/lease-actions";
import { Modal } from "./components/modal";
import { WorkspaceSearch } from "./components/workspace-search";
import { ListingSettings } from "./components/listing-settings";
import type { Permission } from "@/lib/permissions";

type Role = "admin" | "owner" | "resident";
type Tab =
  | "overview"
  | "properties"
  | "applications"
  | "residents"
  | "maintenance"
  | "messages"
  | "documents"
  | "access"
  | "inquiries"
  | "myApplications"
  | "household"
  | "performance";
type Account = { id: string; email: string; displayName: string; role: Role };
type Property = {
  id: string;
  name: string;
  neighborhood: string;
  kind: string;
  homes: number;
  occupied: number;
  status: "published" | "draft";
  accent: "green" | "blue" | "ochre" | "coral";
  listing_type: "rent" | "sale";
  price_amount: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  year_built: number | null;
  address: string;
  city: string;
  description: string;
  featured: number;
  access_role?: "admin" | "owner" | "resident" | null;
};
type Application = {
  id: string;
  property_id: string;
  property_name: string;
  full_name: string;
  email: string;
  phone: string;
  move_in_date: string | null;
  household_size: number;
  unit_id?: string;
  message: string;
  status: "new" | "reviewing" | "declined" | "accepted";
  created_at: string;
};
type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  created_at: string;
};
type Lease = {
  id: string;
  property_id: string;
  property_name: string;
  unit_id: string | null;
  unit_name: string | null;
  resident_email: string;
  resident_name: string;
  monthly_rent: number;
  currency: string;
  due_day: number;
  start_date: string;
  tenancy_status?: string;
  status: string;
  balance: number;
  open_charge_id?: string | null;
  next_due_date?: string | null;
};
type ResidentPortal = {
  resident: { name: string; email: string };
  leases: Lease[];
  charges: {
    id: string;
    lease_id: string;
    description: string;
    amount: number;
    due_date: string;
    status: string;
  }[];
  payments: {
    id: string;
    lease_id: string;
    amount: number;
    paid_at: string;
    reference: string;
  }[];
  balance: number;
};
type PropertyInput = {
  name: string;
  neighborhood: string;
  kind: string;
  homes: number;
  status: "published" | "draft";
  listingType: "rent" | "sale";
  priceAmount: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: string;
  yearBuilt: string;
  address: string;
  city: string;
  description: string;
  ownerEmail: string;
  featured: boolean;
};
type Maintenance = {
  id: string;
  property_id: string;
  property_name: string;
  lease_id: string | null;
  resident_name: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "emergency";
  status: "new" | "in_progress" | "on_hold" | "completed";
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
};
type PropertyMessage = {
  id: string;
  property_id: string;
  property_name: string;
  sender_name: string;
  reply_to?: string | null;
  recipient_account_id?: string | null;
  audience: "all" | "resident" | "management";
  body: string;
  created_at: string;
};
type PropertyDocument = {
  id: string;
  property_id: string;
  property_name: string;
  lease_id: string | null;
  file_name: string;
  content_type: string;
  size_bytes: number;
  visibility: "management" | "resident";
  created_at: string;
};

const nav: { id: Tab; label: string; roles: Role[] }[] = [
  { id: "overview", label: "Overview", roles: ["admin", "owner", "resident"] },
  { id: "properties", label: "Properties", roles: ["admin", "owner"] },
  { id: "applications", label: "Applications", roles: ["admin", "owner"] },
  { id: "residents", label: "Residents", roles: ["admin", "owner"] },
  {
    id: "maintenance",
    label: "Maintenance",
    roles: ["admin", "owner", "resident"],
  },
  { id: "messages", label: "Messages", roles: ["admin", "owner", "resident"] },
  {
    id: "documents",
    label: "Documents",
    roles: ["admin", "owner", "resident"],
  },
  { id: "access", label: "Access", roles: ["admin"] },
  { id: "inquiries", label: "Inquiries", roles: ["admin"] },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body =
    response.status === 204
      ? null
      : ((await response.json().catch(() => ({}))) as { error?: string });
  if (!response.ok)
    throw new Error(body?.error ?? "We could not complete that action.");
  return body as T;
}

const initial = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "UR";
const date = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const roleName = (role: Role) =>
  ({ admin: "Administrator", owner: "Property owner", resident: "Resident" })[
    role
  ];
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [account, setAccount] = useState<Account | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [experience, setExperience] = useState("auto");
  const [propertyContext, setPropertyContext] = useState("");
  const contexts = identity?.contexts ?? [];
  const personal = experience === "personal";
  const scopeContexts = contexts.filter(
    (c) => !propertyContext || c.id === propertyContext,
  );
  const has = (permission: Permission) =>
    !personal &&
    (account?.role === "admin" ||
      scopeContexts.some((c) => c.permissions.includes(permission)));
  const [leases, setLeases] = useState<Lease[]>([]);
  const [residentPortal, setResidentPortal] = useState<ResidentPortal | null>(
    null,
  );
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [messages, setMessages] = useState<PropertyMessage[]>([]);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [unitProperty, setUnitProperty] = useState<Property | null>(null);
  const [leaseDraft, setLeaseDraft] = useState<Application | null>(null);

  const tell = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const identity = await api<Identity>("/api/me");
      setIdentity(identity);
      const mode =
        experience === "auto"
          ? new URLSearchParams(window.location.search).get("mode") ||
            (identity.contexts.length || identity.account?.role === "admin"
              ? "manage"
              : "personal")
          : experience;
      if (experience === "auto") {
        setExperience(mode);
        setPropertyContext(
          new URLSearchParams(window.location.search).get("property") || "",
        );
        const initialTab = new URLSearchParams(window.location.search).get(
          "tab",
        ) as Tab | null;
        if (
          initialTab &&
          [
            "overview",
            "properties",
            "applications",
            "residents",
            "maintenance",
            "messages",
            "documents",
            "access",
            "myApplications",
            "household",
            "performance",
          ].includes(initialTab)
        )
          setTab(initialTab);
      }
      setAccount(identity.account);
      const propertyData = await api<{ properties: Property[] }>(
        "/api/properties",
      );
      setProperties(propertyData.properties);
      if (identity.account) {
        const suffix = mode === "personal" ? "?experience=personal" : "";
        const responses = await Promise.all([
          api<{ applications: Application[] }>("/api/applications" + suffix),
          mode === "personal"
            ? Promise.resolve({ leases: [] as Lease[] })
            : api<{ leases: Lease[] }>("/api/leases"),
          api<{ requests: Maintenance[] }>("/api/maintenance" + suffix),
          api<{ messages: PropertyMessage[] }>("/api/messages" + suffix),
          api<{ documents: PropertyDocument[] }>("/api/documents" + suffix),
          api<ResidentPortal>("/api/resident"),
        ]);
        setApplications(responses[0].applications);
        setLeases(responses[1].leases);
        setMaintenance(responses[2].requests);
        setMessages(responses[3].messages);
        setDocuments(responses[4].documents);
        setResidentPortal(responses[5]);
        if (identity.account.role === "admin")
          setInquiries(
            (await api<{ inquiries: Inquiry[] }>("/api/contact")).inquiries,
          );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load the workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [experience]);
  useEffect(() => {
    void load();
  }, [load]);

  const availableTabs = (() => {
    if (personal)
      return [
        { id: "overview" as Tab, label: "My Home" },
        { id: "myApplications" as Tab, label: "My Applications" },
        ...(identity?.tenancies.length
          ? [
              { id: "maintenance" as Tab, label: "Maintenance" },
              { id: "documents" as Tab, label: "Lease & Documents" },
              { id: "messages" as Tab, label: "Messages" },
              { id: "household" as Tab, label: "Household" },
            ]
          : []),
      ];
    const required: Partial<Record<Tab, Permission>> = {
      properties: "property.view",
      applications: "application.view",
      residents: "lease.view",
      maintenance: "maintenance.view",
      messages: "message.view",
      documents: "document.view",
      access: "team.view",
      performance: "report.view",
    };
    return [
      ...nav,
      { id: "performance" as Tab, label: "Performance", roles: [] as Role[] },
    ]
      .filter(
        (item) =>
          item.id === "overview" ||
          (item.id === "inquiries" && account?.role === "admin") ||
          (required[item.id] &&
            (account?.role === "admin" ||
              scopeContexts.some((c) =>
                c.permissions.includes(required[item.id]!),
              ))),
      )
      .map((item) => ({
        ...item,
        label:
          item.id === "access"
            ? "Team & Access"
            : item.id === "residents"
              ? "Leases & Payments"
              : item.label,
      }));
  })();
  const canManage = has("property.edit");
  const visibleProperties = personal
    ? []
    : properties.filter((p) => !propertyContext || p.id === propertyContext);
  const scoped = <T extends { property_id: string }>(rows: T[]) =>
    rows.filter(
      (r) => !propertyContext || personal || r.property_id === propertyContext,
    );
  const viewAccount = account
    ? {
        ...account,
        role: personal
          ? ("resident" as const)
          : account.role === "admin"
            ? ("admin" as const)
            : ("owner" as const),
      }
    : null;
  const openApplications = applications.filter(
    (item) => item.status === "new" || item.status === "reviewing",
  ).length;

  async function addProperty(payload: PropertyInput, photos: File[]) {
    const result = await api<{ property: Property }>("/api/properties", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setProperties((current) => [result.property, ...current]);
    if (photos.length) {
      const form = new FormData();
      photos.forEach((photo) => form.append("files", photo));
      const upload = await fetch(
        "/api/properties/" + result.property.id + "/media",
        { method: "POST", body: form },
      );
      if (!upload.ok) {
        setShowPropertyForm(false);
        const body = (await upload.json().catch(() => ({}))) as {
          error?: string;
        };
        tell(
          result.property.name +
            " was created, but its photos could not be uploaded: " +
            (body.error ?? "please try again."),
        );
        return;
      }
    }
    setShowPropertyForm(false);
    tell(result.property.name + " has been added.");
  }
  async function changeProperty(
    property: Property,
    status: "published" | "draft",
  ) {
    try {
      const result = await api<{ property: Property }>(
        "/api/properties/" + property.id,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setProperties((current) =>
        current.map((item) =>
          item.id === property.id
            ? { ...result.property, access_role: property.access_role }
            : item,
        ),
      );
      tell(property.name + " is now " + status + ".");
    } catch (reason) {
      tell(
        reason instanceof Error
          ? reason.message
          : "Unable to update the property.",
      );
    }
  }
  async function removeProperty(property: Property) {
    if (
      !window.confirm(
        "Delete " +
          property.name +
          "? This permanently removes its leases, balances, applications, files and property access.",
      )
    )
      return;
    try {
      await api("/api/properties/" + property.id, { method: "DELETE" });
      setProperties((current) =>
        current.filter((item) => item.id !== property.id),
      );
      setApplications((current) =>
        current.filter((item) => item.property_id !== property.id),
      );
      tell(property.name + " was deleted.");
    } catch (reason) {
      tell(
        reason instanceof Error
          ? reason.message
          : "Unable to delete the property.",
      );
    }
  }
  async function changeApplication(
    application: Application,
    status: Application["status"],
  ) {
    try {
      await api("/api/applications/" + application.id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id ? { ...item, status } : item,
        ),
      );
      tell("Application marked " + status + ".");
    } catch (reason) {
      tell(
        reason instanceof Error
          ? reason.message
          : "Unable to update the application.",
      );
    }
  }
  async function addLease(payload: {
    propertyId: string;
    unitId?: string;
    applicationId?: string;
    residentName: string;
    residentEmail: string;
    monthlyRent: number;
    currency: string;
    dueDay: number;
    startDate: string;
    dueDate: string;
  }) {
    const result = await api<{ lease: Lease }>("/api/leases", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const property = properties.find(
      (item) => item.id === result.lease.property_id,
    );
    setLeases((current) => [
      { ...result.lease, property_name: property?.name ?? "Property" },
      ...current,
    ]);
    tell(
      "Lease prepared. Confirm move-in after the lease requirements are complete.",
    );
  }
  async function addUnit(payload: {
    name: string;
    bedrooms: number;
    bathrooms: number;
    areaSqm: string;
    priceAmount: number;
    currency: string;
    availableDate: string;
  }) {
    if (!unitProperty) return;
    await api("/api/properties/" + unitProperty.id + "/units", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUnitProperty(null);
    tell(payload.name + " is now available at " + unitProperty.name + ".");
  }
  async function updateMaintenance(
    item: Maintenance,
    status: Maintenance["status"],
  ) {
    try {
      await api("/api/maintenance/" + item.id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMaintenance((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, status } : entry,
        ),
      );
      tell("Maintenance request updated.");
    } catch (reason) {
      tell(
        reason instanceof Error
          ? reason.message
          : "Unable to update this request.",
      );
    }
  }
  async function createMaintenance(payload: {
    propertyId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
  }) {
    const result = await api<{ request: Maintenance }>("/api/maintenance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const property =
      properties.find((item) => item.id === result.request.property_id) ??
      residentPortal?.leases.find(
        (item) => item.property_id === result.request.property_id,
      );
    setMaintenance((current) => [
      {
        ...result.request,
        property_name: property
          ? "property_name" in property
            ? property.property_name
            : property.name
          : "Property",
      },
      ...current,
    ]);
    tell("Maintenance request sent to management.");
  }
  async function sendMessage(payload: {
    propertyId: string;
    body: string;
    audience: string;
    replyTo?: string;
  }) {
    const result = await api<{ message: PropertyMessage }>("/api/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMessages((current) => [result.message, ...current]);
    tell("Message sent.");
  }
  async function uploadDocument(payload: {
    propertyId: string;
    visibility: "management" | "resident";
    files: File[];
    leaseId?: string;
  }) {
    const form = new FormData();
    form.append("propertyId", payload.propertyId);
    form.append("visibility", payload.visibility);
    if (payload.leaseId) form.append("leaseId", payload.leaseId);
    payload.files.forEach((file) => form.append("files", file));
    const response = await fetch("/api/documents", {
      method: "POST",
      body: form,
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      documents: PropertyDocument[];
    };
    if (!response.ok)
      throw new Error(body.error ?? "Unable to upload document.");
    setDocuments((current) => [
      ...(body.documents as PropertyDocument[]),
      ...current,
    ]);
    tell("Document uploaded.");
  }
  async function recordPayment(lease: Lease) {
    if (!lease.open_charge_id) {
      tell("There is no open charge to record for this lease.");
      return;
    }
    const reference = window.prompt(
      "Record payment received for the next open charge. Enter the receipt or transfer reference.",
    );
    if (reference === null) return;
    try {
      await api("/api/leases/" + lease.id + "/payment", {
        method: "POST",
        body: JSON.stringify({ chargeId: lease.open_charge_id, reference }),
      });
      await load();
      tell("Payment recorded and resident balance refreshed.");
    } catch (reason) {
      tell(
        reason instanceof Error ? reason.message : "Unable to record payment.",
      );
    }
  }
  async function addCharge(
    lease: Lease,
    payload: {
      kind: string;
      description: string;
      amount: number;
      dueDate: string;
    },
  ) {
    await api("/api/leases/" + lease.id + "/charges", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await load();
    tell("Charge added to the resident ledger.");
  }

  if (loading)
    return (
      <main className="loading-screen">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <p>Loading Urugo</p>
      </main>
    );
  return (
    <main className="workspace">
      <aside className="rail">
        <a className="brand" href="/">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>urugo</span>
        </a>
        <label className="context-switcher">
          Your workspace
          <select
            aria-label="Switch experience"
            value={personal ? "personal" : propertyContext || "manage"}
            onChange={(e) => {
              const value = e.target.value;
              setExperience(value === "personal" ? "personal" : "manage");
              setPropertyContext(
                ["personal", "manage"].includes(value) ? "" : value,
              );
              setTab("overview");
            }}
          >
            <optgroup label="Personal">
              <option value="personal">My home & applications</option>
            </optgroup>
            {(contexts.length > 0 || account?.role === "admin") && (
              <optgroup label="Management">
                <option value="manage">All properties</option>
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.roles.join(", ").replaceAll("_", " ")}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <p className="rail-label">{personal ? "PERSONAL" : "MANAGE"}</p>
        <nav aria-label="Primary navigation">
          {availableTabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "nav-current" : ""}
              onClick={() => {
                setTab(item.id);
                window.history.replaceState(
                  null,
                  "",
                  "/?mode=" +
                    (personal ? "personal" : "manage") +
                    "&tab=" +
                    item.id,
                );
              }}
            >
              <i className={"nav-glyph " + item.id} />
              {item.label}
              {item.id === "applications" && openApplications > 0 && (
                <b>{openApplications}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-footer">
          <a href="/discover">Explore homes</a>
          <a href="/apply">Apply for a home</a>
          <a href="/cars">Urugo Cars</a>
          <a href="/health">Urugo Health</a>
          <a href="/contact">Contact Urugo</a>
        </div>
      </aside>
      <section className="workspace-main">
        <header className="app-header">
          <div>
            <p className="kicker">
              {personal
                ? "YOUR LIFE AT HOME"
                : propertyContext
                  ? contexts.find((c) => c.id === propertyContext)?.name
                  : "YOUR PORTFOLIO"}
            </p>
            <h1>
              {tab === "overview"
                ? account
                  ? "Welcome back, " + account.displayName.split(" ")[0]
                  : "Homes that work better"
                : (
                    {
                      properties: "Properties",
                      applications: "Applications",
                      residents: "Residents & rent",
                      maintenance: "Maintenance",
                      messages: "Messages",
                      documents: "Documents",
                      access: "Team & Access",
                      myApplications: "My Applications",
                      household: "Household",
                      performance: "Portfolio performance",
                      inquiries: "Contact inquiries",
                    } as Record<string, string>
                  )[tab]}
            </h1>
          </div>
          <div className="header-actions">
            {!personal && account && <WorkspaceSearch />}
            <button className="text-button" onClick={() => void load()}>
              Refresh
            </button>
            {account ? (
              <div className="account-chip">
                <span>{initial(account.displayName)}</span>
                <div>
                  <strong>{account.displayName}</strong>
                  <small>{roleName(account.role)}</small>
                </div>
              </div>
            ) : (
              <a
                className="button button-dark"
                href="/signin-with-chatgpt?return_to=%2F"
              >
                Sign in
              </a>
            )}
          </div>
        </header>
        {error && (
          <div className="error-banner">
            <span>!</span>
            <p>{error}</p>
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {!account && (
          <section className="signin-banner">
            <div>
              <strong>Welcome to Urugo</strong>
              <p>
                Browse homes, apply for a rental, or sign in to manage your
                property.
              </p>
            </div>
            <a
              className="button button-dark"
              href="/signin-with-chatgpt?return_to=%2F"
            >
              Sign in to workspace
            </a>
          </section>
        )}
        {!!identity?.invitations.length && (
          <section className="card invitation-banner">
            <h2>Your invitations</h2>
            {identity.invitations.map((invite) => (
              <div key={invite.id}>
                <span>
                  {invite.property_name} · {invite.role.replaceAll("_", " ")}
                </span>
                <button
                  className="button button-light"
                  onClick={() =>
                    void api("/api/team", {
                      method: "POST",
                      body: JSON.stringify({ action: "accept", id: invite.id }),
                    })
                      .then(() => load())
                      .catch((e) => tell(e.message))
                  }
                >
                  Accept invitation
                </button>
              </div>
            ))}
          </section>
        )}
        {tab === "overview" &&
          (personal ? (
            residentPortal?.leases.length ? (
              <>
                <nav className="quick-actions" aria-label="Home actions">
                  <button onClick={() => setTab("maintenance")}>
                    Request maintenance
                  </button>
                  <button onClick={() => setTab("messages")}>
                    Message management
                  </button>
                  <button onClick={() => setTab("documents")}>
                    Lease & documents
                  </button>
                </nav>
                <ResidentPortalScreen portal={residentPortal} />
              </>
            ) : (
              <ApplicationInbox personal />
            )
          ) : (
            <>
              {scopeContexts.length > 0 &&
              scopeContexts.every((c) =>
                c.roles.every((r) => ["owner", "investor"].includes(r)),
              ) ? (
                <PerformancePanel propertyId={propertyContext} />
              ) : (
                <section className="page-content">
                  <section className="section-intro">
                    <div>
                      <p className="kicker">YOUR ACTION CENTER</p>
                      <h2>Here’s what needs your attention.</h2>
                      <p>
                        Work across your portfolio, or choose a property to
                        focus your day.
                      </p>
                    </div>
                  </section>
                  <div className="action-grid">
                    {has("application.view") && (
                      <button onClick={() => setTab("applications")}>
                        <strong>
                          {
                            scoped(applications).filter((a) =>
                              ["new", "reviewing"].includes(a.status),
                            ).length
                          }
                        </strong>
                        Applications awaiting review
                        <span>Review applications →</span>
                      </button>
                    )}
                    {has("maintenance.view") && (
                      <button onClick={() => setTab("maintenance")}>
                        <strong>
                          {
                            scoped(maintenance).filter(
                              (m) => m.status !== "completed",
                            ).length
                          }
                        </strong>
                        Open maintenance requests<span>View work orders →</span>
                      </button>
                    )}
                    {has("lease.view") && (
                      <button onClick={() => setTab("residents")}>
                        <strong>
                          {
                            scoped(leases).filter((l) => l.status === "pending")
                              .length
                          }
                        </strong>
                        Pending move-ins<span>View leases →</span>
                      </button>
                    )}
                    {has("report.view") && (
                      <button onClick={() => setTab("performance")}>
                        <strong>{visibleProperties.length}</strong>Properties in
                        this view<span>View performance →</span>
                      </button>
                    )}
                  </div>
                  <section className="card review-panel">
                    <h3>Today’s priorities</h3>
                    {scoped(maintenance)
                      .filter(
                        (m) =>
                          m.status !== "completed" &&
                          ["emergency", "high"].includes(m.priority),
                      )
                      .map((m) => (
                        <button
                          className="priority-row"
                          key={m.id}
                          onClick={() => setTab("maintenance")}
                        >
                          <span>
                            {m.priority.toUpperCase()} · {m.property_name}
                          </span>
                          <strong>{m.title}</strong>
                          <span>Open work orders →</span>
                        </button>
                      ))}
                    {scoped(applications)
                      .filter((a) => a.status === "new")
                      .slice(0, 5)
                      .map((a) => (
                        <button
                          className="priority-row"
                          key={a.id}
                          onClick={() => setTab("applications")}
                        >
                          <span>APPLICATION · {a.property_name}</span>
                          <strong>{a.full_name}</strong>
                          <span>Review application →</span>
                        </button>
                      ))}
                    {!scoped(maintenance).some(
                      (m) =>
                        m.status !== "completed" &&
                        ["emergency", "high"].includes(m.priority),
                    ) &&
                      !scoped(applications).some((a) => a.status === "new") && (
                        <p>
                          You’re caught up on urgent requests and new
                          applications.
                        </p>
                      )}
                  </section>
                </section>
              )}
            </>
          ))}
        {tab === "myApplications" && <ApplicationInbox personal />}
        {tab === "household" && <HouseholdPanel />}
        {tab === "performance" && (
          <PerformancePanel propertyId={propertyContext} />
        )}
        {tab === "properties" && propertyContext && has("listing.manage") && (
          <ListingSettings key={propertyContext} propertyId={propertyContext} />
        )}
        {tab === "properties" && (
          <PropertiesScreen
            properties={visibleProperties}
            canManage={canManage}
            isAdmin={account?.role === "admin"}
            create={() => setShowPropertyForm(true)}
            addUnit={(property) => setUnitProperty(property)}
            update={changeProperty}
            remove={removeProperty}
          />
        )}
        {tab === "applications" && (
          <>
            <ApplicationInbox
              propertyId={propertyContext}
              onRefresh={() => void load()}
            />
            <ApplicationsScreen
              applications={scoped(applications).filter(
                (a) => a.status === "accepted",
              )}
              update={changeApplication}
              createLease={(application) => {
                setLeaseDraft(application);
                setTab("residents");
              }}
            />
          </>
        )}
        {tab === "residents" && (
          <ResidentsScreen
            properties={visibleProperties}
            leases={scoped(leases)}
            draft={leaseDraft}
            canCreate={has("lease.create")}
            canBill={has("payment.manage")}
            canManageLease={has("lease.manage")}
            refresh={() => void load()}
            create={async (payload) => {
              await addLease(payload);
              setLeaseDraft(null);
            }}
            recordPayment={recordPayment}
            addCharge={addCharge}
          />
        )}
        {tab === "maintenance" && (
          <MaintenanceScreen
            account={viewAccount}
            properties={visibleProperties}
            portal={residentPortal}
            requests={scoped(maintenance)}
            create={createMaintenance}
            update={updateMaintenance}
          />
        )}
        {tab === "messages" && (
          <MessagesScreen
            account={viewAccount}
            properties={visibleProperties}
            portal={residentPortal}
            messages={scoped(messages)}
            send={sendMessage}
          />
        )}
        {tab === "documents" && (
          <DocumentsScreen
            account={viewAccount}
            properties={visibleProperties}
            documents={scoped(documents)}
            leases={scoped(leases)}
            upload={uploadDocument}
          />
        )}
        {tab === "access" && (
          <TeamPanel contexts={contexts} propertyId={propertyContext} />
        )}
        {tab === "inquiries" && <InquiriesScreen inquiries={inquiries} />}
      </section>
      {showPropertyForm && (
        <PropertyModal
          close={() => setShowPropertyForm(false)}
          submit={addProperty}
        />
      )}
      {unitProperty && (
        <UnitModal
          property={unitProperty}
          close={() => setUnitProperty(null)}
          submit={addUnit}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
    </main>
  );
}

function CardHeading({
  eyebrow,
  title: heading,
  action,
  onClick,
}: {
  eyebrow: string;
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <header className="card-heading">
      <div>
        <p className="kicker">{eyebrow}</p>
        <h3>{heading}</h3>
      </div>
      <button className="text-button" onClick={onClick}>
        {action} <span>→</span>
      </button>
    </header>
  );
}
function Empty({
  title: heading,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <span>+</span>
      <strong>{heading}</strong>
      <p>{body}</p>
      <button className="text-button" onClick={onClick}>
        {action} <i>→</i>
      </button>
    </div>
  );
}
function Status({ status }: { status: Application["status"] }) {
  return <span className={"status-pill " + status}>{title(status)}</span>;
}

function PropertiesScreen({
  properties,
  canManage,
  isAdmin,
  create,
  addUnit,
  update,
  remove,
}: {
  properties: Property[];
  canManage: boolean;
  isAdmin: boolean;
  create: () => void;
  addUnit: (property: Property) => void;
  update: (property: Property, status: "published" | "draft") => void;
  remove: (property: Property) => void;
}) {
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const visible =
    filter === "all"
      ? properties
      : properties.filter((property) => property.status === filter);
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">LISTING MANAGEMENT</p>
          <h2>Properties, with the details that matter.</h2>
          <p>
            Published homes appear in the public marketplace. Add units when an
            apartment community needs individual availability and pricing.
          </p>
        </div>
        {isAdmin && (
          <button className="button button-dark" onClick={create}>
            Add property <span>+</span>
          </button>
        )}
      </section>
      <div className="filter-row">
        {(["all", "published", "draft"] as const).map((item) => (
          <button
            key={item}
            className={filter === item ? "filter-active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "All" : title(item)}{" "}
            <b>
              {item === "all"
                ? properties.length
                : properties.filter((property) => property.status === item)
                    .length}
            </b>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="property-grid">
          {visible.map((property) => (
            <article className="property-card" key={property.id}>
              <div className={"property-visual " + property.accent}>
                <span>
                  {property.listing_type === "rent" ? "For rent" : "For sale"}
                </span>
                <i />
                <i />
                <i />
                <b>{property.status}</b>
              </div>
              <div className="property-card-body">
                <div>
                  <h3>
                    {property.name}{" "}
                    {property.featured ? (
                      <em className="featured-tag">Featured</em>
                    ) : null}
                  </h3>
                  <p>
                    {property.neighborhood} · {property.city}
                  </p>
                  <strong className="property-price">
                    {property.price_amount
                      ? money(property.price_amount, property.currency)
                      : "Price on request"}
                    {property.listing_type === "rent" &&
                    property.price_amount ? (
                      <small> / month</small>
                    ) : null}
                  </strong>
                </div>
                <div className="property-figures">
                  <span>
                    <strong>{property.bedrooms}</strong>
                    <small>bedrooms</small>
                  </span>
                  <span>
                    <strong>{property.homes}</strong>
                    <small>homes</small>
                  </span>
                  <span>
                    <strong>{property.homes - property.occupied}</strong>
                    <small>available</small>
                  </span>
                </div>
                {canManage && (isAdmin || canManage) && (
                  <div className="property-actions">
                    <button
                      className="text-button"
                      onClick={() => addUnit(property)}
                    >
                      Add unit
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        update(
                          property,
                          property.status === "published"
                            ? "draft"
                            : "published",
                        )
                      }
                    >
                      {property.status === "published"
                        ? "Move to draft"
                        : "Publish"}
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => remove(property)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            title="No matching properties"
            body={
              properties.length
                ? "Try a different property filter."
                : "Add your first property to make it available to your team."
            }
            action={isAdmin ? "Add property" : "View all"}
            onClick={isAdmin ? create : () => setFilter("all")}
          />
        </div>
      )}
    </div>
  );
}

function ApplicationsScreen({
  applications,
  update,
  createLease,
}: {
  applications: Application[];
  update: (application: Application, status: Application["status"]) => void;
  createLease: (application: Application) => void;
}) {
  const [filter, setFilter] = useState<"all" | Application["status"]>("all");
  const visible =
    filter === "all"
      ? applications
      : applications.filter((application) => application.status === filter);
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">LEASING PIPELINE</p>
          <h2>Every application, ready for a decision.</h2>
          <p>
            Applications submitted from the public form arrive here. Property
            owners see applicants only for their assigned homes.
          </p>
        </div>
        <a className="button button-light" href="/apply">
          Open application form <span>↗</span>
        </a>
      </section>
      <div className="filter-row">
        {(["all", "new", "reviewing", "accepted", "declined"] as const).map(
          (item) => (
            <button
              key={item}
              className={filter === item ? "filter-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "all" ? "All" : title(item)}{" "}
              <b>
                {item === "all"
                  ? applications.length
                  : applications.filter(
                      (application) => application.status === item,
                    ).length}
              </b>
            </button>
          ),
        )}
      </div>
      <div className="application-list card">
        {visible.length ? (
          visible.map((application) => (
            <article className="application-row" key={application.id}>
              <span className="applicant-avatar">
                {initial(application.full_name)}
              </span>
              <div className="application-main">
                <div className="application-title">
                  <div>
                    <h3>{application.full_name}</h3>
                    <p>
                      {application.property_name} · Submitted{" "}
                      {date(application.created_at)}
                    </p>
                  </div>
                  <Status status={application.status} />
                </div>
                <div className="application-details">
                  <a href={"mailto:" + application.email}>
                    {application.email}
                  </a>
                  <a href={"tel:" + application.phone}>{application.phone}</a>
                  <span>
                    {application.household_size} person
                    {application.household_size === 1 ? "" : "s"}
                  </span>
                  {application.move_in_date && (
                    <span>Move-in: {application.move_in_date}</span>
                  )}
                </div>
                {application.message && (
                  <p className="application-note">{application.message}</p>
                )}
                <div className="application-actions">
                  <label className="status-select">
                    Update status
                    <select
                      value={application.status}
                      onChange={(event) =>
                        update(
                          application,
                          event.target.value as Application["status"],
                        )
                      }
                    >
                      <option value="new">New</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </select>
                  </label>
                  {application.status === "accepted" && (
                    <button
                      className="text-button"
                      onClick={() => createLease(application)}
                    >
                      Prepare lease →
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="No applications here"
            body="New submissions will be shown as soon as an applicant applies."
            action="Open application form"
            onClick={() => window.location.assign("/apply")}
          />
        )}
      </div>
    </div>
  );
}

function ResidentPortalScreen({
  portal: allPortal,
}: {
  portal: ResidentPortal;
}) {
  const [home, setHome] = useState(allPortal.leases[0]?.id ?? "");
  const lease =
    allPortal.leases.find((l) => l.id === home) ?? allPortal.leases[0];
  const charges = allPortal.charges.filter((c) => c.lease_id === lease?.id);
  const portal = {
    ...allPortal,
    charges,
    payments: allPortal.payments.filter((p) => p.lease_id === lease?.id),
    balance: charges
      .filter((c) => c.status === "open")
      .reduce((sum, c) => sum + c.amount, 0),
  };
  const nextCharge = portal.charges.find((charge) => charge.status === "open");
  return (
    <div className="page-content">
      <label className="home-selector">
        Your home
        <select value={home} onChange={(e) => setHome(e.target.value)}>
          {allPortal.leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.property_name} · {l.unit_name || "Unit unassigned"} ·{" "}
              {l.status === "pending" ? "Upcoming move-in" : l.status}
            </option>
          ))}
        </select>
      </label>
      <section className="resident-balance">
        <div>
          <p className="kicker">YOUR RESIDENT PORTAL</p>
          <h2>{lease ? lease.property_name : "Your home"}</h2>
          <p>
            {lease
              ? (lease.unit_name ? lease.unit_name + " · " : "") +
                "Rent is due on the " +
                lease.due_day +
                ordinal(lease.due_day) +
                " of each month."
              : "Your property team has not attached an active lease to this account yet."}
          </p>
        </div>
        <div className="balance-amount">
          <small>AMOUNT DUE</small>
          <strong>{lease ? money(portal.balance, lease.currency) : "—"}</strong>
          {nextCharge && <span>Next due {date(nextCharge.due_date)}</span>}
        </div>
      </section>
      <section className="resident-grid">
        <article className="card">
          <CardHeading
            eyebrow="CURRENT BALANCE"
            title="What you owe"
            action="Contact manager"
            onClick={() => window.location.assign("/contact")}
          />
          {portal.charges.length ? (
            <div className="resident-charge-list">
              {portal.charges.map((charge) => (
                <div className="resident-charge" key={charge.id}>
                  <div>
                    <strong>{charge.description}</strong>
                    <small>Due {date(charge.due_date)}</small>
                  </div>
                  <b>{money(charge.amount, lease?.currency ?? "BIF")}</b>
                  <Status
                    status={charge.status === "open" ? "new" : "accepted"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Nothing due right now"
              body="Your balance and upcoming rent will appear here."
              action="Contact manager"
              onClick={() => window.location.assign("/contact")}
            />
          )}
        </article>
        <article className="card">
          <CardHeading
            eyebrow="PAYMENT HISTORY"
            title="Your recent payments"
            action="Need help?"
            onClick={() => window.location.assign("/contact")}
          />
          {portal.payments.length ? (
            <div className="resident-charge-list">
              {portal.payments.map((payment) => (
                <div className="resident-charge" key={payment.id}>
                  <div>
                    <strong>Payment received</strong>
                    <small>
                      {date(payment.paid_at)}
                      {payment.reference ? " · " + payment.reference : ""}
                    </small>
                  </div>
                  <b>{money(payment.amount, lease?.currency ?? "BIF")}</b>
                  <Status status="accepted" />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No recorded payments"
              body="Once your property team records a payment, it will show here."
              action="Contact manager"
              onClick={() => window.location.assign("/contact")}
            />
          )}
        </article>
      </section>
      <section className="resident-help">
        <div>
          <p className="kicker">NEED SOMETHING?</p>
          <h3>Keep your home team in the loop.</h3>
          <p>
            For rent questions, maintenance, or your lease, send a message to
            the Urugo team and we will route it to the right person.
          </p>
        </div>
        <a className="button button-light" href="/contact">
          Contact your team
        </a>
      </section>
    </div>
  );
}

function ResidentsScreen({
  properties,
  leases,
  draft,
  canCreate,
  canBill,
  canManageLease,
  refresh,
  create,
  recordPayment,
  addCharge,
}: {
  properties: Property[];
  leases: Lease[];
  draft: Application | null;
  canCreate: boolean;
  canBill: boolean;
  canManageLease: boolean;
  refresh: () => void;
  create: (payload: {
    propertyId: string;
    unitId?: string;
    applicationId?: string;
    residentName: string;
    residentEmail: string;
    monthlyRent: number;
    currency: string;
    dueDay: number;
    startDate: string;
    dueDate: string;
  }) => Promise<void>;
  recordPayment: (lease: Lease) => Promise<void>;
  addCharge: (
    lease: Lease,
    payload: {
      kind: string;
      description: string;
      amount: number;
      dueDate: string;
    },
  ) => Promise<void>;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [unitId, setUnitId] = useState(draft?.unit_id ?? "");
  const [units, setUnits] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [residentName, setResidentName] = useState("");
  const [residentEmail, setResidentEmail] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [currency, setCurrency] = useState("BIF");
  const [dueDay, setDueDay] = useState("5");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [billingLease, setBillingLease] = useState<Lease | null>(null);
  const [chargeDescription, setChargeDescription] = useState("Rent charge");
  useEffect(() => {
    setUnitId(draft?.property_id === propertyId ? (draft.unit_id ?? "") : "");
    if (propertyId)
      void api<{ units: typeof units }>(
        "/api/properties/" + propertyId + "/units",
      )
        .then((r) => setUnits(r.units))
        .catch((e) => setError(e.message));
  }, [propertyId, draft]);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDue, setChargeDue] = useState(
    new Date().toISOString().slice(0, 10),
  );
  useEffect(() => {
    if (!propertyId && properties[0]) setPropertyId(properties[0].id);
  }, [properties, propertyId]);
  useEffect(() => {
    if (draft) {
      setPropertyId(draft.property_id);
      setResidentName(draft.full_name);
      setResidentEmail(draft.email);
      if (draft.move_in_date) {
        setStartDate(draft.move_in_date);
        setDueDate(draft.move_in_date);
      }
    }
  }, [draft]);
  async function addResident(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await create({
        propertyId,
        unitId,
        applicationId: draft?.id,
        residentName,
        residentEmail,
        monthlyRent: Number(monthlyRent),
        currency,
        dueDay: Number(dueDay),
        startDate,
        dueDate,
      });
      setResidentName("");
      setResidentEmail("");
      setMonthlyRent("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create resident lease.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function bill(event: FormEvent) {
    event.preventDefault();
    if (!billingLease) return;
    setBusy(true);
    try {
      await addCharge(billingLease, {
        kind: "rent",
        description: chargeDescription,
        amount: Number(chargeAmount),
        dueDate: chargeDue,
      });
      setBillingLease(null);
      setChargeAmount("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to add charge.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">RESIDENT MANAGEMENT</p>
          <h2>Give residents a home portal with a real balance.</h2>
          <p>
            Prepare pending leases, confirm move-in, record received payments,
            and give residents one clear view of their account.
          </p>
        </div>
      </section>
      {canCreate && (
        <section className="access-forms resident-management">
          <form className="card compact-form" onSubmit={addResident}>
            <div>
              <p className="kicker">NEW RESIDENT LEASE</p>
              <h3>Set up their account</h3>
            </div>
            <label>
              Property
              <select
                required
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
              >
                <option value="">Choose a property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Unit to be assigned</option>
                {units
                  .filter((u) => u.status === "available")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Resident name
              <input
                required
                value={residentName}
                onChange={(event) => setResidentName(event.target.value)}
                placeholder="Full name"
              />
            </label>
            <label>
              Resident email
              <input
                required
                type="email"
                value={residentEmail}
                onChange={(event) => setResidentEmail(event.target.value)}
                placeholder="resident@example.com"
              />
            </label>
            <div className="form-grid">
              <label>
                Monthly rent
                <input
                  required
                  min="0"
                  type="number"
                  value={monthlyRent}
                  onChange={(event) => setMonthlyRent(event.target.value)}
                  placeholder="750000"
                />
              </label>
              <label>
                Currency
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option>BIF</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Rent due day
                <input
                  required
                  min="1"
                  max="28"
                  type="number"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                />
              </label>
              <label>
                First due date
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>
            <label>
              Lease start date
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            {error && <p className="inline-error">{error}</p>}
            <button
              className="button button-dark"
              disabled={busy || !propertyId}
            >
              {busy ? "Creating…" : "Create resident lease"}
            </button>
          </form>
          <article className="card resident-side-note">
            <p className="kicker">PAYMENTS & BILLING</p>
            <h3>Issue a charge, then record the payment against it.</h3>
            <p>
              The ledger is ready for a payment gateway. Until a provider is
              connected, management can record verified transfers or cash
              receipts.
            </p>
          </article>
        </section>
      )}
      {billingLease && canBill && (
        <form className="card compact-form charge-form" onSubmit={bill}>
          <div>
            <p className="kicker">NEW CHARGE · {billingLease.resident_name}</p>
            <h3>Add a rent or fee charge</h3>
          </div>
          <div className="form-grid">
            <label>
              Description
              <input
                required
                value={chargeDescription}
                onChange={(event) => setChargeDescription(event.target.value)}
              />
            </label>
            <label>
              Amount
              <input
                required
                min="0"
                type="number"
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
              />
            </label>
            <label>
              Due date
              <input
                required
                type="date"
                value={chargeDue}
                onChange={(event) => setChargeDue(event.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button button-light"
              onClick={() => setBillingLease(null)}
            >
              Cancel
            </button>
            <button className="button button-dark" disabled={busy}>
              Add charge
            </button>
          </div>
        </form>
      )}
      <section className="group-section">
        <div className="section-list-heading">
          <div>
            <p className="kicker">ACTIVE LEASES</p>
            <h3>Residents and balances</h3>
          </div>
          <span>
            {leases.length} lease{leases.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="card resident-list">
          {leases.length ? (
            leases.map((lease) => (
              <article className="resident-row" key={lease.id}>
                <span className="person-dot">
                  {initial(lease.resident_name)}
                </span>
                <div>
                  <strong>{lease.resident_name}</strong>
                  <small>
                    {lease.resident_email} · {lease.property_name}
                  </small>
                </div>
                <div>
                  <b>{money(lease.monthly_rent, lease.currency)}</b>
                  <small>monthly rent</small>
                </div>
                <div>
                  <b className={lease.balance ? "balance-open" : ""}>
                    {lease.balance === undefined
                      ? "—"
                      : money(lease.balance, lease.currency)}
                  </b>
                  <small>amount due</small>
                </div>
                <div className="resident-actions">
                  {canBill && (
                    <>
                      <button
                        className="text-button"
                        onClick={() => setBillingLease(lease)}
                      >
                        Add charge
                      </button>
                      <button
                        className="text-button"
                        disabled={!lease.open_charge_id}
                        onClick={() => void recordPayment(lease)}
                      >
                        Record payment
                      </button>
                    </>
                  )}
                  {canManageLease && (
                    <LeaseActions
                      leaseId={lease.id}
                      status={
                        lease.tenancy_status ||
                        (lease.status === "pending"
                          ? "pending_move_in"
                          : lease.status)
                      }
                      onChange={refresh}
                    />
                  )}
                </div>
              </article>
            ))
          ) : (
            <Empty
              title="No resident leases yet"
              body="Create a lease above to give a resident their amount-due portal."
              action="Start above"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function propertyOptions(
  properties: Property[],
  portal: ResidentPortal | null,
) {
  const options = properties.map((property) => ({
    id: property.id,
    name: property.name,
  }));
  for (const lease of portal?.leases ?? [])
    if (!options.some((option) => option.id === lease.property_id))
      options.push({ id: lease.property_id, name: lease.property_name });
  return options;
}

function MaintenanceScreen({
  account,
  properties,
  portal,
  requests,
  create,
  update,
}: {
  account: Account | null;
  properties: Property[];
  portal: ResidentPortal | null;
  requests: Maintenance[];
  create: (payload: {
    propertyId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
  }) => Promise<void>;
  update: (
    request: Maintenance,
    status: Maintenance["status"],
  ) => Promise<void>;
}) {
  const options = propertyOptions(properties, portal);
  const manager = account?.role === "admin" || account?.role === "owner";
  const [propertyId, setPropertyId] = useState(options[0]?.id ?? "");
  const [titleValue, setTitleValue] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!propertyId && options[0]) setPropertyId(options[0].id);
  }, [options, propertyId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await create({
        propertyId,
        title: titleValue,
        description,
        category,
        priority,
      });
      setTitleValue("");
      setDescription("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to submit the request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">MAINTENANCE CENTRE</p>
          <h2>
            {manager
              ? "Keep every repair moving."
              : "Tell your home team what needs attention."}
          </h2>
          <p>
            {manager
              ? "Prioritize, schedule, and close work requests across the properties you manage."
              : "Share the issue, location, and urgency. Your property team receives it immediately."}
          </p>
        </div>
      </section>
      {!manager && (
        <form className="card compact-form maintenance-form" onSubmit={submit}>
          <div>
            <p className="kicker">NEW REQUEST</p>
            <h3>Report a maintenance issue</h3>
          </div>
          <label>
            Home
            <select
              required
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Issue type
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="general">General</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="appliance">Appliance</option>
                <option value="security">Security</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </label>
          </div>
          <label>
            Short title
            <input
              required
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              placeholder="e.g. Kitchen tap is leaking"
            />
          </label>
          <label>
            Details
            <textarea
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue and when it started."
            />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <button className="button button-dark" disabled={busy || !propertyId}>
            {busy ? "Sending…" : "Send maintenance request"}
          </button>
        </form>
      )}
      <section className="group-section">
        <div className="section-list-heading">
          <div>
            <p className="kicker">REQUESTS</p>
            <h3>
              {requests.length
                ? requests.length + " active and completed requests"
                : "No requests yet"}
            </h3>
          </div>
        </div>
        <div className="card operations-list">
          {requests.length ? (
            requests.map((item) => (
              <article className="operation-row" key={item.id}>
                <div>
                  <div className="operation-title">
                    <h3>{item.title}</h3>
                    <Status
                      status={
                        item.status === "completed"
                          ? "accepted"
                          : item.status === "in_progress"
                            ? "reviewing"
                            : "new"
                      }
                    />
                  </div>
                  <p>
                    {item.property_name} · {item.category} · {item.priority}{" "}
                    priority · {date(item.created_at)}
                  </p>
                  <small>{item.description}</small>
                </div>
                {manager ? (
                  <label className="status-select">
                    Status
                    <select
                      value={item.status}
                      onChange={(event) =>
                        void update(
                          item,
                          event.target.value as Maintenance["status"],
                        )
                      }
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="on_hold">On hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                ) : null}
              </article>
            ))
          ) : (
            <Empty
              title="No maintenance requests"
              body="When a request is submitted, its status will be visible here."
              action="Contact your team"
              onClick={() => window.location.assign("/contact")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function MessagesScreen({
  account,
  properties,
  portal,
  messages,
  send,
}: {
  account: Account | null;
  properties: Property[];
  portal: ResidentPortal | null;
  messages: PropertyMessage[];
  send: (payload: {
    propertyId: string;
    body: string;
    audience: string;
    replyTo?: string;
  }) => Promise<void>;
}) {
  const options = propertyOptions(properties, portal);
  const manager = account?.role === "admin" || account?.role === "owner";
  const [propertyId, setPropertyId] = useState(options[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("resident");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!propertyId && options[0]) setPropertyId(options[0].id);
  }, [options, propertyId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send({ propertyId, body, audience });
      setBody("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">PROPERTY MESSAGES</p>
          <h2>
            {manager
              ? "Keep residents informed."
              : "Message your property team."}
          </h2>
          <p>
            {manager
              ? "Share notices with a whole property and keep resident conversations organized."
              : "Send rent, lease, or home questions directly to the management team."}
          </p>
        </div>
      </section>
      <form className="card compact-form message-form" onSubmit={submit}>
        <div>
          <p className="kicker">NEW MESSAGE</p>
          <h3>{manager ? "Send a property update" : "Contact management"}</h3>
        </div>
        <label>
          Property
          <select
            required
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        {manager && (
          <label>
            Audience
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option value="resident">Residents</option>
              <option value="all">Everyone with property access</option>
            </select>
          </label>
        )}
        <label>
          Message
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              manager
                ? "e.g. Water service will be interrupted on Tuesday from 9–11am."
                : "How can we help?"
            }
          />
        </label>
        {error && <p className="inline-error">{error}</p>}
        <button className="button button-dark" disabled={busy || !propertyId}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </form>
      <section className="group-section">
        <div className="section-list-heading">
          <div>
            <p className="kicker">RECENT MESSAGES</p>
            <h3>{messages.length ? "Property activity" : "No messages yet"}</h3>
          </div>
        </div>
        <div className="card operations-list">
          {messages.length ? (
            messages.map((message) => (
              <article className="operation-row" key={message.id}>
                <div>
                  <div className="operation-title">
                    <h3>{message.sender_name}</h3>
                    {message.recipient_account_id && (
                      <span className="audience-pill">Private reply</span>
                    )}
                    <span className="audience-pill">
                      {message.audience === "management"
                        ? "To management"
                        : message.audience === "resident"
                          ? "Residents"
                          : "Everyone"}
                    </span>
                  </div>
                  <p>
                    {message.property_name} · {date(message.created_at)}
                  </p>
                  <small>{message.body}</small>
                  <button
                    className="text-button"
                    onClick={() => {
                      const body = window.prompt(
                        "Reply to " +
                          message.sender_name +
                          ". " +
                          (manager
                            ? "This reply is private to this conversation."
                            : "Your reply goes to the property team."),
                      );
                      if (body)
                        void send({
                          propertyId: message.property_id,
                          body,
                          audience: "management",
                          replyTo: message.id,
                        }).catch((e) => setError(e.message));
                    }}
                  >
                    Reply privately →
                  </button>
                </div>
              </article>
            ))
          ) : (
            <Empty
              title="No messages yet"
              body="Updates and conversations for your home will appear here."
              action="Contact your team"
              onClick={() => window.location.assign("/contact")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function DocumentsScreen({
  account,
  properties,
  documents,
  leases,
  upload,
}: {
  account: Account | null;
  properties: Property[];
  documents: PropertyDocument[];
  leases: Lease[];
  upload: (payload: {
    propertyId: string;
    visibility: "management" | "resident";
    files: File[];
    leaseId?: string;
  }) => Promise<void>;
}) {
  const manager = account?.role === "admin" || account?.role === "owner";
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [visibility, setVisibility] = useState<"management" | "resident">(
    "resident",
  );
  const [leaseId, setLeaseId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!propertyId && properties[0]) setPropertyId(properties[0].id);
  }, [properties, propertyId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await upload({ propertyId, visibility, files, leaseId });
      setFiles([]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to upload document.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">LEASE & PROPERTY FILES</p>
          <h2>
            {manager
              ? "Keep important documents in one place."
              : "Your shared property documents."}
          </h2>
          <p>
            {manager
              ? "Upload lease documents, notices, and resident-ready files. Residents only see files you share with them."
              : "Open the lease notices and shared files from your property team."}
          </p>
        </div>
      </section>
      {manager && (
        <form className="card compact-form document-form" onSubmit={submit}>
          <div>
            <p className="kicker">UPLOAD DOCUMENTS</p>
            <h3>Share a file</h3>
          </div>
          <label>
            Property
            <select
              required
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as "management" | "resident")
              }
            >
              <option value="resident">Share with residents</option>
              <option value="management">Management only</option>
            </select>
          </label>
          <label>
            Recipient scope
            <select
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
            >
              <option value="">Property-wide shared file</option>
              {leases
                .filter((l) => l.property_id === propertyId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.resident_name} · {l.unit_name || "Lease"}
                  </option>
                ))}
            </select>
          </label>
          <p className="form-hint">
            Lease and household-specific documents must be assigned to a lease.
            Property-wide resident files are visible to every eligible
            household.
          </p>
          <label>
            Files
            <input
              required
              type="file"
              multiple
              accept="application/pdf,.doc,.docx,text/plain,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
            />
            <small>PDF, Word, text, or image files; up to 10 MB each.</small>
          </label>
          {error && <p className="inline-error">{error}</p>}
          <button
            className="button button-dark"
            disabled={busy || !propertyId || !files.length}
          >
            {busy ? "Uploading…" : "Upload documents"}
          </button>
        </form>
      )}
      <section className="group-section">
        <div className="section-list-heading">
          <div>
            <p className="kicker">DOCUMENT LIBRARY</p>
            <h3>
              {documents.length
                ? documents.length + " shared files"
                : "No shared documents yet"}
            </h3>
          </div>
        </div>
        <div className="card operations-list">
          {documents.length ? (
            documents.map((document) => (
              <article className="operation-row" key={document.id}>
                <div>
                  <div className="operation-title">
                    <h3>{document.file_name}</h3>
                    <span className="audience-pill">
                      {document.visibility === "resident"
                        ? "Resident shared"
                        : "Management"}
                    </span>
                  </div>
                  <p>
                    {document.property_name} ·{" "}
                    {Math.max(1, Math.round(document.size_bytes / 1024))} KB ·{" "}
                    {date(document.created_at)}
                  </p>
                </div>
                <a
                  className="text-button"
                  href={"/api/documents/" + document.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open ↗
                </a>
              </article>
            ))
          ) : (
            <Empty
              title="No documents yet"
              body="Shared lease files and notices will appear here."
              action="Contact your team"
              onClick={() => window.location.assign("/contact")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function ordinal(value: number) {
  const endings = ["th", "st", "nd", "rd"];
  const remainder = value % 100;
  return endings[(remainder - 20) % 10] || endings[remainder] || endings[0];
}

function InquiriesScreen({ inquiries }: { inquiries: Inquiry[] }) {
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">CONTACT CENTRE</p>
          <h2>Conversations that need your attention.</h2>
          <p>
            Every message from the contact page is stored here. Mail
            notifications are delivered to btuyisenge40@gmail.com when the mail
            provider is configured.
          </p>
        </div>
        <a className="button button-light" href="/contact">
          Open contact page <span>↗</span>
        </a>
      </section>
      <section className="inquiry-list card">
        {inquiries.length ? (
          inquiries.map((inquiry) => (
            <article className="inquiry-row" key={inquiry.id}>
              <div className="inquiry-title">
                <span className="person-dot">{initial(inquiry.name)}</span>
                <div>
                  <h3>{inquiry.name}</h3>
                  <p>
                    {inquiry.subject} · {date(inquiry.created_at)}
                  </p>
                </div>
              </div>
              <p className="inquiry-message">{inquiry.message}</p>
              <div className="inquiry-actions">
                <a
                  href={
                    "mailto:" +
                    inquiry.email +
                    "?subject=" +
                    encodeURIComponent("Re: " + inquiry.subject)
                  }
                >
                  Reply by email
                </a>
                {inquiry.phone && (
                  <a href={"tel:" + inquiry.phone}>Call {inquiry.phone}</a>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="No contact inquiries yet"
            body="Messages submitted through the contact page will show up here."
            action="Open contact page"
            onClick={() => window.location.assign("/contact")}
          />
        )}
      </section>
    </div>
  );
}

function PropertyModal({
  close,
  submit,
}: {
  close: () => void;
  submit: (payload: PropertyInput, photos: File[]) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [kind, setKind] = useState("Apartments");
  const [homes, setHomes] = useState("1");
  const [status, setStatus] = useState<"published" | "draft">("draft");
  const [listingType, setListingType] = useState<"rent" | "sale">("rent");
  const [priceAmount, setPriceAmount] = useState("");
  const [currency, setCurrency] = useState("BIF");
  const [bedrooms, setBedrooms] = useState("1");
  const [bathrooms, setBathrooms] = useState("1");
  const [areaSqm, setAreaSqm] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bujumbura");
  const [description, setDescription] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [featured, setFeatured] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submit(
        {
          name,
          neighborhood,
          kind,
          homes: Number(homes),
          status,
          listingType,
          priceAmount: Number(priceAmount),
          currency,
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          areaSqm,
          yearBuilt,
          address,
          city,
          description,
          ownerEmail,
          featured,
        },
        photos,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create property.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal close={close} label="Property setup">
      <form
        className="modal property-modal-wide"
        onSubmit={create}
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-form-title"
      >
        <header>
          <div>
            <p className="kicker">NEW LISTING</p>
            <h2 id="property-form-title">Create your property</h2>
          </div>
          <button type="button" className="close-button" onClick={close}>
            ×
          </button>
        </header>
        <nav className="filter-chips" aria-label="Property setup steps">
          {[
            "Property & location",
            "Pricing & specifications",
            "Photos & publication",
          ].map((title, index) => (
            <button
              type="button"
              key={title}
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              {index + 1}. {title}
            </button>
          ))}
        </nav>
        <fieldset hidden={step !== 0} disabled={step !== 0}>
          <legend>Property & location</legend>
          <div className="form-grid">
            <label>
              Property name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Kiriri Residences"
              />
            </label>
            <label>
              Property type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option>Apartments</option>
                <option>Houses</option>
                <option>Townhomes</option>
                <option>Commercial</option>
              </select>
            </label>
            <label>
              Street address
              <input
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="e.g. Avenue de la Plage 18"
              />
            </label>
            <label>
              Neighborhood
              <input
                required
                value={neighborhood}
                onChange={(event) => setNeighborhood(event.target.value)}
                placeholder="e.g. Rohero"
              />
            </label>
            <label>
              City
              <input
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <label>
              Number of homes
              <input
                required
                type="number"
                min="1"
                max="5000"
                value={homes}
                onChange={(event) => setHomes(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <fieldset hidden={step !== 1} disabled={step !== 1}>
          <legend>Pricing & specifications</legend>
          <div className="form-grid">
            <label>
              Listing type
              <select
                value={listingType}
                onChange={(event) =>
                  setListingType(event.target.value as "rent" | "sale")
                }
              >
                <option value="rent">For rent</option>
                <option value="sale">For sale</option>
              </select>
            </label>
            <label>
              {listingType === "rent" ? "Monthly rent" : "Sale price"}
              <input
                required
                min="0"
                type="number"
                value={priceAmount}
                onChange={(event) => setPriceAmount(event.target.value)}
                placeholder="e.g. 750000"
              />
            </label>
            <label>
              Currency
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option>BIF</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            <label>
              Bedrooms
              <input
                required
                min="0"
                type="number"
                value={bedrooms}
                onChange={(event) => setBedrooms(event.target.value)}
              />
            </label>
            <label>
              Bathrooms
              <input
                required
                min="0"
                step="0.5"
                type="number"
                value={bathrooms}
                onChange={(event) => setBathrooms(event.target.value)}
              />
            </label>
            <label>
              Area (m²)
              <input
                min="1"
                type="number"
                value={areaSqm}
                onChange={(event) => setAreaSqm(event.target.value)}
              />
            </label>
            <label>
              Year built
              <input
                min="1800"
                max="2100"
                type="number"
                value={yearBuilt}
                onChange={(event) => setYearBuilt(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <fieldset hidden={step !== 2} disabled={step !== 2}>
          <legend>Photos & publication</legend>
          <div className="form-grid">
            <label>
              Property owner email
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@example.com"
              />
            </label>
            <label className="full-form-field">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What makes this home special? Include amenities, nearby landmarks, and availability."
              />
            </label>
            <label className="full-form-field">
              Property photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) =>
                  setPhotos(Array.from(event.target.files ?? []))
                }
              />
              <small>
                Upload up to 12 photos, 8 MB each. The first photo is used on
                the public listing.
              </small>
            </label>
          </div>
          <fieldset>
            <legend>Listing status</legend>
            <label className="radio-option">
              <input
                type="radio"
                checked={status === "published"}
                onChange={() => setStatus("published")}
              />
              <span>
                <strong>Publish now</strong>
                <small>
                  It appears in the public home search and can receive
                  applications.
                </small>
              </span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                checked={status === "draft"}
                onChange={() => setStatus("draft")}
              />
              <span>
                <strong>Keep as draft</strong>
                <small>
                  Only the management workspace can see it until you publish.
                </small>
              </span>
            </label>
            <label className="radio-option">
              <input
                type="checkbox"
                checked={featured}
                onChange={(event) => setFeatured(event.target.checked)}
              />
              <span>
                <strong>Featured marketplace placement</strong>
                <small>
                  Prioritizes this listing in public search. Use this as a
                  premium partner listing.
                </small>
              </span>
            </label>
          </fieldset>
        </fieldset>
        {error && <p className="inline-error">{error}</p>}
        <footer>
          <button type="button" className="button button-light" onClick={close}>
            Cancel
          </button>
          {step > 0 && (
            <button
              type="button"
              className="button button-light"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              className="button button-dark"
              onClick={() => setStep(step + 1)}
            >
              Continue →
            </button>
          ) : (
            <button className="button button-dark" disabled={busy}>
              {busy
                ? "Saving…"
                : status === "draft"
                  ? "Save draft"
                  : "Publish listing"}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  );
}

function UnitModal({
  property,
  close,
  submit,
}: {
  property: Property;
  close: () => void;
  submit: (payload: {
    name: string;
    bedrooms: number;
    bathrooms: number;
    areaSqm: string;
    priceAmount: number;
    currency: string;
    availableDate: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [bedrooms, setBedrooms] = useState(String(property.bedrooms));
  const [bathrooms, setBathrooms] = useState(String(property.bathrooms));
  const [areaSqm, setAreaSqm] = useState("");
  const [priceAmount, setPriceAmount] = useState(String(property.price_amount));
  const [currency, setCurrency] = useState(property.currency);
  const [availableDate, setAvailableDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submit({
        name,
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        areaSqm,
        priceAmount: Number(priceAmount),
        currency,
        availableDate,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to add unit.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal close={close} label="Add a unit">
      <form className="modal" onSubmit={create}>
        <header>
          <div>
            <p className="kicker">NEW UNIT · {property.name}</p>
            <h2>Add an available unit</h2>
          </div>
          <button type="button" className="close-button" onClick={close}>
            ×
          </button>
        </header>
        <div className="form-grid">
          <label>
            Unit name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Apartment 3B"
            />
          </label>
          <label>
            Price
            <input
              required
              min="0"
              type="number"
              value={priceAmount}
              onChange={(event) => setPriceAmount(event.target.value)}
            />
          </label>
          <label>
            Currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option>BIF</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Bedrooms
            <input
              required
              min="0"
              type="number"
              value={bedrooms}
              onChange={(event) => setBedrooms(event.target.value)}
            />
          </label>
          <label>
            Bathrooms
            <input
              required
              min="0"
              step="0.5"
              type="number"
              value={bathrooms}
              onChange={(event) => setBathrooms(event.target.value)}
            />
          </label>
          <label>
            Area (m²)
            <input
              min="1"
              type="number"
              value={areaSqm}
              onChange={(event) => setAreaSqm(event.target.value)}
            />
          </label>
          <label>
            Available from
            <input
              type="date"
              value={availableDate}
              onChange={(event) => setAvailableDate(event.target.value)}
            />
          </label>
        </div>
        {error && <p className="inline-error">{error}</p>}
        <footer>
          <button type="button" className="button button-light" onClick={close}>
            Cancel
          </button>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Saving…" : "Add unit"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
