"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin" | "owner" | "resident";
type Tab = "overview" | "properties" | "applications" | "access" | "inquiries";
type Account = { id: string; email: string; displayName: string; role: Role };
type Property = { id: string; name: string; neighborhood: string; kind: string; homes: number; occupied: number; status: "published" | "draft"; accent: "green" | "blue" | "ochre" | "coral"; access_role?: "admin" | "owner" | "resident" | null };
type Application = { id: string; property_id: string; property_name: string; full_name: string; email: string; phone: string; move_in_date: string | null; household_size: number; message: string; status: "new" | "reviewing" | "declined" | "accepted"; created_at: string };
type Inquiry = { id: string; name: string; email: string; phone: string; subject: string; message: string; created_at: string };
type Group = { id: string; name: string; role: "owner" | "resident"; property_id: string; property_name: string; members: number; pending: number };

const nav: { id: Tab; label: string; roles: Role[] }[] = [
  { id: "overview", label: "Overview", roles: ["admin", "owner", "resident"] },
  { id: "properties", label: "Properties", roles: ["admin", "owner", "resident"] },
  { id: "applications", label: "Applications", roles: ["admin", "owner"] },
  { id: "access", label: "Access", roles: ["admin"] },
  { id: "inquiries", label: "Inquiries", roles: ["admin"] },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? "We could not complete that action.");
  return body as T;
}

const initial = (value: string) => value.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "UR";
const date = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const roleName = (role: Role) => ({ admin: "Administrator", owner: "Property owner", resident: "Resident" })[role];

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [account, setAccount] = useState<Account | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);

  const tell = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3600); };
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const identity = await api<{ account: Account | null }>("/api/me");
      setAccount(identity.account);
      const propertyData = await api<{ properties: Property[] }>("/api/properties");
      setProperties(propertyData.properties);
      if (identity.account?.role === "admin" || identity.account?.role === "owner") {
        const response = await api<{ applications: Application[] }>("/api/applications");
        setApplications(response.applications);
      } else setApplications([]);
      if (identity.account?.role === "admin") {
        const results = await Promise.all([api<{ inquiries: Inquiry[] }>("/api/contact"), api<{ groups: Group[] }>("/api/access")]);
        setInquiries(results[0].inquiries); setGroups(results[1].groups);
      } else { setInquiries([]); setGroups([]); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load the workspace."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const availableTabs = useMemo(() => nav.filter((item) => !account || item.roles.includes(account.role)), [account]);
  const canManage = account?.role === "admin" || account?.role === "owner";
  const totalHomes = properties.reduce((sum, property) => sum + property.homes, 0);
  const occupied = properties.reduce((sum, property) => sum + property.occupied, 0);
  const openApplications = applications.filter((item) => item.status === "new" || item.status === "reviewing").length;

  async function addProperty(payload: { name: string; neighborhood: string; kind: string; homes: number; status: "published" | "draft" }) {
    const result = await api<{ property: Property }>("/api/properties", { method: "POST", body: JSON.stringify(payload) });
    setProperties((current) => [result.property, ...current]); setShowPropertyForm(false); tell(result.property.name + " has been added.");
  }
  async function changeProperty(property: Property, status: "published" | "draft") {
    try {
      const result = await api<{ property: Property }>("/api/properties/" + property.id, { method: "PATCH", body: JSON.stringify({ status }) });
      setProperties((current) => current.map((item) => item.id === property.id ? { ...result.property, access_role: property.access_role } : item)); tell(property.name + " is now " + status + ".");
    } catch (reason) { tell(reason instanceof Error ? reason.message : "Unable to update the property."); }
  }
  async function removeProperty(property: Property) {
    if (!window.confirm("Delete " + property.name + "? This also removes its applications and access groups.")) return;
    try {
      await api("/api/properties/" + property.id, { method: "DELETE" });
      setProperties((current) => current.filter((item) => item.id !== property.id));
      setApplications((current) => current.filter((item) => item.property_id !== property.id));
      setGroups((current) => current.filter((item) => item.property_id !== property.id));
      tell(property.name + " was deleted.");
    } catch (reason) { tell(reason instanceof Error ? reason.message : "Unable to delete the property."); }
  }
  async function changeApplication(application: Application, status: Application["status"]) {
    try {
      await api("/api/applications/" + application.id, { method: "PATCH", body: JSON.stringify({ status }) });
      setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status } : item)); tell("Application marked " + status + ".");
    } catch (reason) { tell(reason instanceof Error ? reason.message : "Unable to update the application."); }
  }
  async function addGroup(payload: { name: string; role: "owner" | "resident"; propertyId: string }) {
    const result = await api<{ group: Group }>("/api/access", { method: "POST", body: JSON.stringify({ action: "create-group", ...payload }) });
    const property = properties.find((item) => item.id === result.group.property_id);
    setGroups((current) => [...current, { ...result.group, property_name: property?.name ?? "Property" }]);
    tell(payload.name + " is ready for members.");
  }
  async function grantAccess(groupId: string, email: string) {
    const result = await api<{ status: "added" | "pending" }>("/api/access", { method: "POST", body: JSON.stringify({ action: "invite", groupId, email }) });
    setGroups((current) => current.map((group) => group.id !== groupId ? group : result.status === "pending" ? { ...group, pending: group.pending + 1 } : { ...group, members: group.members + 1 }));
    tell(result.status === "pending" ? "Access will activate when they first sign in." : "Access has been granted.");
  }
  async function removeGroup(group: Group) {
    if (!window.confirm("Remove " + group.name + "? Members lose this property access unless another group grants it.")) return;
    try { await api("/api/access?groupId=" + encodeURIComponent(group.id), { method: "DELETE" }); setGroups((current) => current.filter((item) => item.id !== group.id)); tell(group.name + " was removed."); }
    catch (reason) { tell(reason instanceof Error ? reason.message : "Unable to remove the group."); }
  }

  if (loading) return <main className="loading-screen"><span className="brand-mark"><i /><i /><i /></span><p>Loading Urugo</p></main>;
  return <main className="workspace">
    <aside className="rail">
      <a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>urugo</span></a>
      <p className="rail-label">Workspace</p>
      <nav aria-label="Primary navigation">{availableTabs.map((item) => <button key={item.id} className={tab === item.id ? "nav-current" : ""} onClick={() => setTab(item.id)}><i className={"nav-glyph " + item.id} />{item.label}{item.id === "applications" && openApplications > 0 && <b>{openApplications}</b>}</button>)}</nav>
      <div className="rail-footer"><a href="/apply">Apply for a home</a><a href="/contact">Contact Urugo</a></div>
    </aside>
    <section className="workspace-main">
      <header className="app-header"><div><p className="kicker">PROPERTY OPERATIONS · BUJUMBURA</p><h1>{tab === "overview" ? account ? "Welcome back, " + account.displayName.split(" ")[0] : "Homes that work better" : ({ properties: "Properties", applications: "Applications", access: "Access control", inquiries: "Contact inquiries" } as Record<string, string>)[tab]}</h1></div><div className="header-actions"><button className="text-button" onClick={() => void load()}>Refresh</button>{account ? <div className="account-chip"><span>{initial(account.displayName)}</span><div><strong>{account.displayName}</strong><small>{roleName(account.role)}</small></div></div> : <a className="button button-dark" href="/signin-with-chatgpt?return_to=%2F">Sign in</a>}</div></header>
      {error && <div className="error-banner"><span>!</span><p>{error}</p><button onClick={() => void load()}>Try again</button></div>}
      {!account && <section className="signin-banner"><div><strong>Welcome to Urugo</strong><p>Browse homes, apply for a rental, or sign in to manage your property.</p></div><a className="button button-dark" href="/signin-with-chatgpt?return_to=%2F">Sign in to workspace</a></section>}
      {tab === "overview" && <Overview account={account} properties={properties} applications={applications} totalHomes={totalHomes} occupied={occupied} openApplications={openApplications} onTab={setTab} />}
      {tab === "properties" && <PropertiesScreen properties={properties} canManage={canManage} isAdmin={account?.role === "admin"} create={() => setShowPropertyForm(true)} update={changeProperty} remove={removeProperty} />}
      {tab === "applications" && <ApplicationsScreen applications={applications} update={changeApplication} />}
      {tab === "access" && <AccessScreen properties={properties} groups={groups} create={addGroup} invite={grantAccess} remove={removeGroup} />}
      {tab === "inquiries" && <InquiriesScreen inquiries={inquiries} />}
    </section>
    {showPropertyForm && <PropertyModal close={() => setShowPropertyForm(false)} submit={addProperty} />}
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
  </main>;
}

function Overview({ account, properties, applications, totalHomes, occupied, openApplications, onTab }: { account: Account | null; properties: Property[]; applications: Application[]; totalHomes: number; occupied: number; openApplications: number; onTab: (tab: Tab) => void }) {
  const occupancy = totalHomes ? Math.round((occupied / totalHomes) * 100) : 0;
  return <div className="page-content">
    <section className="overview-hero"><div><p className="kicker">A CLEARER WAY TO MANAGE HOMES</p><h2>One place for listings, people, and every next step.</h2><p>Keep your portfolio organized, give every person the right access, and move applications forward with confidence.</p></div><div className="hero-actions"><button className="button button-dark" onClick={() => onTab("properties")}>View properties <span>→</span></button>{account?.role === "admin" && <button className="button button-light" onClick={() => onTab("access")}>Manage access</button>}{!account && <a className="button button-light" href="/contact">Talk to our team</a>}</div></section>
    <section className="metrics"><Metric label="Properties" value={String(properties.length)} detail="In your workspace" tone="green" /><Metric label="Homes" value={String(totalHomes)} detail={String(occupied) + " occupied"} tone="blue" /><Metric label="Occupancy" value={String(occupancy) + "%"} detail={totalHomes ? String(Math.max(totalHomes - occupied, 0)) + " homes available" : "Add your first property"} tone="ochre" /><Metric label="Applications" value={String(openApplications)} detail="New or in review" tone="coral" /></section>
    <section className="two-column"><article className="card"><CardHeading eyebrow="PORTFOLIO" title="Property snapshot" action="See all" onClick={() => onTab("properties")} />{properties.length ? <div className="property-mini-list">{properties.slice(0, 5).map((property) => <div className="property-mini" key={property.id}><span className={"building-swatch " + property.accent}><i /><i /></span><div><strong>{property.name}</strong><small>{property.neighborhood} · {property.kind}</small></div><div className="mini-stat"><b>{property.occupied}/{property.homes}</b><small>occupied</small></div></div>)}</div> : <Empty title="No properties yet" body="Add a property to begin organizing your portfolio." action="Add a property" onClick={() => onTab("properties")} />}</article>
      <article className="card"><CardHeading eyebrow="APPLICATIONS" title="Recent activity" action={account ? "Review queue" : "Apply now"} onClick={() => account ? onTab("applications") : window.location.assign("/apply")} />{applications.length ? <div className="activity-list">{applications.slice(0, 4).map((application) => <div className="activity-row" key={application.id}><span className="person-dot">{initial(application.full_name)}</span><div><strong>{application.full_name}</strong><small>{application.property_name} · {date(application.created_at)}</small></div><Status status={application.status} /></div>)}</div> : <Empty title={account ? "Your review queue is clear" : "Looking for a home?"} body={account ? "New applications will appear here as they arrive." : "Browse available homes and apply in a few minutes."} action={account ? "Open applications" : "Start an application"} onClick={() => account ? onTab("applications") : window.location.assign("/apply")} />}</article></section>
    <section className="workflow-card"><div><p className="kicker">HOW ACCESS WORKS</p><h3>People get access through property-specific groups.</h3><p>Administrators create owner or resident groups, connect them to a property, then grant access by email. Owners see assigned properties and applicants; residents see only their home.</p></div>{account?.role === "admin" && <button className="button button-light" onClick={() => onTab("access")}>Set up access</button>}</section>
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <article className={"metric " + tone}><span /><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article>; }
function CardHeading({ eyebrow, title: heading, action, onClick }: { eyebrow: string; title: string; action: string; onClick: () => void }) { return <header className="card-heading"><div><p className="kicker">{eyebrow}</p><h3>{heading}</h3></div><button className="text-button" onClick={onClick}>{action} <span>→</span></button></header>; }
function Empty({ title: heading, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) { return <div className="empty-state"><span>+</span><strong>{heading}</strong><p>{body}</p><button className="text-button" onClick={onClick}>{action} <i>→</i></button></div>; }
function Status({ status }: { status: Application["status"] }) { return <span className={"status-pill " + status}>{title(status)}</span>; }

function PropertiesScreen({ properties, canManage, isAdmin, create, update, remove }: { properties: Property[]; canManage: boolean; isAdmin: boolean; create: () => void; update: (property: Property, status: "published" | "draft") => void; remove: (property: Property) => void }) {
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const visible = filter === "all" ? properties : properties.filter((property) => property.status === filter);
  return <div className="page-content"><section className="section-intro"><div><p className="kicker">LISTING MANAGEMENT</p><h2>Properties, with the details that matter.</h2><p>Published homes appear in the public application form. Drafts stay private until you are ready.</p></div>{isAdmin && <button className="button button-dark" onClick={create}>Add property <span>+</span></button>}</section><div className="filter-row">{(["all", "published", "draft"] as const).map((item) => <button key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : title(item)} <b>{item === "all" ? properties.length : properties.filter((property) => property.status === item).length}</b></button>)}</div>{visible.length ? <div className="property-grid">{visible.map((property) => <article className="property-card" key={property.id}><div className={"property-visual " + property.accent}><span>{property.kind}</span><i /><i /><i /><b>{property.status}</b></div><div className="property-card-body"><div><h3>{property.name}</h3><p>{property.neighborhood}</p></div><div className="property-figures"><span><strong>{property.homes}</strong><small>homes</small></span><span><strong>{property.occupied}</strong><small>occupied</small></span><span><strong>{property.homes - property.occupied}</strong><small>available</small></span></div>{canManage && (isAdmin || property.access_role === "owner") && <div className="property-actions"><button className="text-button" onClick={() => update(property, property.status === "published" ? "draft" : "published")}>{property.status === "published" ? "Move to draft" : "Publish"}</button><button className="danger-button" onClick={() => remove(property)}>Delete</button></div>}</div></article>)}</div> : <div className="card"><Empty title="No matching properties" body={properties.length ? "Try a different property filter." : "Add your first property to make it available to your team."} action={isAdmin ? "Add property" : "View all"} onClick={isAdmin ? create : () => setFilter("all")} /></div>}</div>;
}

function ApplicationsScreen({ applications, update }: { applications: Application[]; update: (application: Application, status: Application["status"]) => void }) {
  const [filter, setFilter] = useState<"all" | Application["status"]>("all");
  const visible = filter === "all" ? applications : applications.filter((application) => application.status === filter);
  return <div className="page-content"><section className="section-intro"><div><p className="kicker">LEASING PIPELINE</p><h2>Every application, ready for a decision.</h2><p>Applications submitted from the public form arrive here. Property owners see applicants only for their assigned homes.</p></div><a className="button button-light" href="/apply">Open application form <span>↗</span></a></section><div className="filter-row">{(["all", "new", "reviewing", "accepted", "declined"] as const).map((item) => <button key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : title(item)} <b>{item === "all" ? applications.length : applications.filter((application) => application.status === item).length}</b></button>)}</div><div className="application-list card">{visible.length ? visible.map((application) => <article className="application-row" key={application.id}><span className="applicant-avatar">{initial(application.full_name)}</span><div className="application-main"><div className="application-title"><div><h3>{application.full_name}</h3><p>{application.property_name} · Submitted {date(application.created_at)}</p></div><Status status={application.status} /></div><div className="application-details"><a href={"mailto:" + application.email}>{application.email}</a><a href={"tel:" + application.phone}>{application.phone}</a><span>{application.household_size} person{application.household_size === 1 ? "" : "s"}</span>{application.move_in_date && <span>Move-in: {application.move_in_date}</span>}</div>{application.message && <p className="application-note">{application.message}</p>}<label className="status-select">Update status<select value={application.status} onChange={(event) => update(application, event.target.value as Application["status"])}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="accepted">Accepted</option><option value="declined">Declined</option></select></label></div></article>) : <Empty title="No applications here" body="New submissions will be shown as soon as an applicant applies." action="Open application form" onClick={() => window.location.assign("/apply")} />}</div></div>;
}

function AccessScreen({ properties, groups, create, invite, remove }: { properties: Property[]; groups: Group[]; create: (payload: { name: string; role: "owner" | "resident"; propertyId: string }) => Promise<void>; invite: (groupId: string, email: string) => Promise<void>; remove: (group: Group) => void }) {
  const [name, setName] = useState(""); const [role, setRole] = useState<"owner" | "resident">("owner"); const [propertyId, setPropertyId] = useState(properties[0]?.id ?? ""); const [groupId, setGroupId] = useState(groups[0]?.id ?? ""); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!propertyId && properties[0]) setPropertyId(properties[0].id); }, [properties, propertyId]);
  useEffect(() => { if (!groupId && groups[0]) setGroupId(groups[0].id); }, [groups, groupId]);
  async function createGroup(event: FormEvent) { event.preventDefault(); setBusy(true); try { await create({ name, role, propertyId }); setName(""); } finally { setBusy(false); } }
  async function invitePerson(event: FormEvent) { event.preventDefault(); setBusy(true); try { await invite(groupId, email); setEmail(""); } finally { setBusy(false); } }
  return <div className="page-content"><section className="section-intro"><div><p className="kicker">PERMISSION MODEL</p><h2>Give people access to the right home, and nothing else.</h2><p>Groups are tied to a property. Owners can manage their assigned property and applicants; residents can access only their home.</p></div></section><section className="access-explainer"><div><b>1</b><strong>Create a group</strong><p>Choose an access type and one property.</p></div><div><b>2</b><strong>Add an email</strong><p>New people are granted access on first sign-in.</p></div><div><b>3</b><strong>Stay in control</strong><p>Remove a group to revoke its property access.</p></div></section><div className="access-forms"><form className="card compact-form" onSubmit={createGroup}><div><p className="kicker">NEW GROUP</p><h3>Set up access</h3></div><label>Group name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kinanira owners" /></label><label>Access type<select value={role} onChange={(event) => setRole(event.target.value as "owner" | "resident")}><option value="owner">Property owners</option><option value="resident">Residents</option></select></label><label>Property<select required value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Choose a property</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label><button className="button button-dark" disabled={busy || !propertyId}>Create group</button></form><form className="card compact-form" onSubmit={invitePerson}><div><p className="kicker">ADD A PERSON</p><h3>Grant property access</h3></div><label>Access group<select required value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name} · {group.property_name}</option>)}</select></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label><p className="form-hint">New people receive access automatically when they first sign in.</p><button className="button button-dark" disabled={busy || !groupId}>Grant access</button></form></div><section className="group-section"><div className="section-list-heading"><div><p className="kicker">ACTIVE GROUPS</p><h3>Who can access what</h3></div><span>{groups.length} group{groups.length === 1 ? "" : "s"}</span></div>{groups.length ? <div className="group-list">{groups.map((group) => <article className="group-row" key={group.id}><span className={"group-role " + group.role}>{group.role === "owner" ? "O" : "R"}</span><div><strong>{group.name}</strong><small>{group.property_name} · {group.role === "owner" ? "Property owner access" : "Resident access"}</small></div><div className="group-counts"><span>{group.members} active</span>{group.pending > 0 && <span>{group.pending} pending</span>}</div><button className="danger-button" onClick={() => remove(group)}>Remove</button></article>)}</div> : <div className="card"><Empty title="No access groups yet" body="Create a group before granting property owner or resident access." action="Start above" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} /></div>}</section></div>;
}

function InquiriesScreen({ inquiries }: { inquiries: Inquiry[] }) { return <div className="page-content"><section className="section-intro"><div><p className="kicker">CONTACT CENTRE</p><h2>Conversations that need your attention.</h2><p>Every message from the contact page is stored here. Mail notifications are delivered to btuyisenge40@gmail.com when the mail provider is configured.</p></div><a className="button button-light" href="/contact">Open contact page <span>↗</span></a></section><section className="inquiry-list card">{inquiries.length ? inquiries.map((inquiry) => <article className="inquiry-row" key={inquiry.id}><div className="inquiry-title"><span className="person-dot">{initial(inquiry.name)}</span><div><h3>{inquiry.name}</h3><p>{inquiry.subject} · {date(inquiry.created_at)}</p></div></div><p className="inquiry-message">{inquiry.message}</p><div className="inquiry-actions"><a href={"mailto:" + inquiry.email + "?subject=" + encodeURIComponent("Re: " + inquiry.subject)}>Reply by email</a>{inquiry.phone && <a href={"tel:" + inquiry.phone}>Call {inquiry.phone}</a>}</div></article>) : <Empty title="No contact inquiries yet" body="Messages submitted through the contact page will show up here." action="Open contact page" onClick={() => window.location.assign("/contact")} />}</section></div>; }

function PropertyModal({ close, submit }: { close: () => void; submit: (payload: { name: string; neighborhood: string; kind: string; homes: number; status: "published" | "draft" }) => Promise<void> }) {
  const [name, setName] = useState(""); const [neighborhood, setNeighborhood] = useState(""); const [kind, setKind] = useState("Apartments"); const [homes, setHomes] = useState("1"); const [status, setStatus] = useState<"published" | "draft">("published"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function create(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await submit({ name, neighborhood, kind, homes: Number(homes), status }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create property."); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onSubmit={create} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="kicker">NEW PROPERTY</p><h2>Add a home to your portfolio</h2></div><button type="button" className="close-button" onClick={close}>×</button></header><div className="form-grid"><label>Property name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kiriri Residences" /></label><label>Neighborhood<input required value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="e.g. Kiriri, Bujumbura" /></label><label>Property type<select value={kind} onChange={(event) => setKind(event.target.value)}><option>Apartments</option><option>Houses</option><option>Townhomes</option><option>Commercial</option></select></label><label>Number of homes<input required type="number" min="1" max="5000" value={homes} onChange={(event) => setHomes(event.target.value)} /></label></div><fieldset><legend>Listing status</legend><label className="radio-option"><input type="radio" checked={status === "published"} onChange={() => setStatus("published")} /><span><strong>Publish now</strong><small>Applicants can see and apply for this property.</small></span></label><label className="radio-option"><input type="radio" checked={status === "draft"} onChange={() => setStatus("draft")} /><span><strong>Keep as draft</strong><small>Only your workspace can see it until you publish.</small></span></label></fieldset>{error && <p className="inline-error">{error}</p>}<footer><button type="button" className="button button-light" onClick={close}>Cancel</button><button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Add property"}</button></footer></form></div>;
}
