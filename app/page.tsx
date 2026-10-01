"use client";

import { useEffect, useState } from "react";

type View = "manage" | "resident";
type Nav = "Overview" | "Properties" | "Residents" | "Requests" | "Messages" | "Documents" | "Settings";

const navItems: { label: Nav; icon: string }[] = [
  { label: "Overview", icon: "▦" }, { label: "Properties", icon: "⌂" },
  { label: "Residents", icon: "♙" }, { label: "Requests", icon: "◌" },
  { label: "Messages", icon: "✦" }, { label: "Documents", icon: "▱" }, { label: "Settings", icon: "⚙" },
];

const requests = [
  ["Water pressure in unit 2C", "Kinanira Heights · 24 min ago", "Urgent", "coral"],
  ["Replace hallway light", "Kigobe Court · 1 hr ago", "Normal", "ochre"],
  ["Gate remote not working", "Rohero Gardens · Yesterday", "Normal", "blue"],
];

function Avatar({ initials, hue = "green", small = false }: { initials: string; hue?: string; small?: boolean }) {
  return <span className={`avatar ${hue} ${small ? "small" : ""}`}>{initials}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("manage");
  const [nav, setNav] = useState<Nav>("Overview");
  const [requestOpen, setRequestOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };
  const switchView = (next: View) => { setView(next); setNav("Overview"); setRequestOpen(false); };
  useEffect(() => { const saved = window.localStorage.getItem("urugo-theme"); if (saved === "dark" || saved === "light") setTheme(saved); }, []);
  useEffect(() => { window.localStorage.setItem("urugo-theme", theme); }, [theme]);

  return <main className={`app-shell ${theme === "dark" ? "dark" : ""}`}>
    <aside className="sidebar">
      <button className="brand" onClick={() => switchView("manage")} aria-label="Urugo home"><span className="brand-mark"><i /><i /><i /></span><span>urugo</span></button>
      <div className="workspace-switch" aria-label="Choose workspace">
        <button className={view === "manage" ? "switch-active" : ""} onClick={() => switchView("manage")}><span>▦</span>Manage</button>
        <button className={view === "resident" ? "switch-active" : ""} onClick={() => switchView("resident")}><span>⌂</span>Resident</button>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map((item) => <button key={item.label} className={view === "manage" && nav === item.label ? "nav-active" : ""} onClick={() => { switchView("manage"); setNav(item.label); if (item.label !== "Overview") toast(`${item.label} workspace is ready to configure.`); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.label === "Requests" && <b className="nav-count">3</b>}</button>)}
      </nav>
      <div className="sidebar-bottom"><button onClick={() => { switchView("manage"); setNav("Settings"); }}><span className="nav-icon">⚙</span>Settings</button><button onClick={() => toast("Help center opened.")}><span className="nav-icon">?</span>Help center</button><button onClick={() => { switchView("manage"); setNav("Settings"); }}><Avatar initials="NK" hue="sand" small />Nadine K.</button></div>
    </aside>
    <section className="content-area">
      {view === "manage" ? <Manager nav={nav} theme={theme} setTheme={setTheme} complete={complete} onNew={() => setRequestOpen(true)} onDone={() => { setComplete(true); toast("Request marked complete — the resident will be notified."); }} toast={toast} /> : <Resident theme={theme} setTheme={setTheme} onNew={() => setRequestOpen(true)} toast={toast} />}
    </section>
    {requestOpen && <RequestModal close={() => setRequestOpen(false)} send={() => { setRequestOpen(false); toast("Your maintenance request has been sent."); }} />}
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
  </main>;
}

function Topbar({ title, resident, toast, theme, setTheme }: { title: string; resident?: boolean; toast: (message: string) => void; theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void }) {
  return <header className="topbar"><div><p className="eyebrow">{resident ? "YOUR HOME · KINANIRA HEIGHTS" : <>WEDNESDAY, 01 OCTOBER <i className="live-dot" /> BUJUMBURA</>}</p><h1>{title}</h1></div><div className="topbar-actions"><button className="icon-button theme-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "◐"}</button><button className="icon-button" aria-label="Notifications" onClick={() => toast(resident ? "You have one home update." : "You have 3 maintenance updates to review.")}>♢<i /></button><button className="profile-button" onClick={() => toast("Profile menu opened.")}><Avatar initials="NK" hue="sand" /><span>Nadine K.</span><b>⌄</b></button></div></header>;
}

function Manager({ nav, theme, setTheme, complete, onNew, onDone, toast }: { nav: Nav; theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; complete: boolean; onNew: () => void; onDone: () => void; toast: (message: string) => void }) {
  if (nav === "Settings") return <Settings theme={theme} setTheme={setTheme} toast={toast} />;
  if (nav !== "Overview") return <div className="dashboard-frame"><Topbar title={nav} theme={theme} setTheme={setTheme} toast={toast} /><section className="placeholder-section"><span className="placeholder-mark">✦</span><p className="section-label">URUGO WORKSPACE</p><h2>{nav}, made simple.</h2><p>{placeholderCopy[nav]}</p><button className="primary-button" onClick={() => toast(`${nav} setup started.`)}>Start setting up <span>→</span></button></section></div>;
  return <div className="dashboard-frame">
    <Topbar title="Good morning, Nadine" theme={theme} setTheme={setTheme} toast={toast} />
    <section className="attention-card"><span className="attention-icon">!</span><div><strong>3 requests need your attention</strong><small>One priority issue has been reported at Kinanira Heights.</small></div><button onClick={() => toast("Showing your open maintenance requests.")}>Review requests <span>→</span></button></section>
    <section className="metrics-grid"><Metric icon="⌂" label="Properties" value="18" note="4 locations" tone="green" /><Metric icon="♙" label="Active residents" value="246" note="↑ 12 this month" tone="blue" /><Metric icon="◌" label="Open requests" value={complete ? "2" : "3"} note={complete ? "1 completed today" : "1 priority"} tone="coral" /><Metric icon="▱" label="Documents due" value="6" note="Next 7 days" tone="yellow" /></section>
    <section className="dashboard-grid">
      <article className="panel portfolio-panel"><PanelTitle eyebrow="PORTFOLIO HEALTH" title="Your properties" action="View all" onClick={() => toast("Property insights are now in view.")} /><div className="portfolio-body"><div className="ring"><div><strong>96%</strong><span>occupied</span></div></div><div className="portfolio-stat"><strong>246</strong><span>occupied homes</span><em>+4 since September</em></div><div className="portfolio-stat faded"><strong>10</strong><span>available homes</span><em>2 viewing this week</em></div></div><div className="building-list"><Building dot="green" name="Kinanira Heights" count="64 / 66 homes" width="97%" /><Building dot="blue" name="Rohero Gardens" count="48 / 50 homes" width="96%" /><Building dot="ochre" name="Kigobe Court" count="37 / 40 homes" width="92%" /></div></article>
      <article className="panel move-panel"><PanelTitle eyebrow="THIS WEEK" title="Move-ins & visits" action="•••" onClick={() => toast("Scheduling options opened.")} /><div className="date-strip"><span>Mon<b>29</b></span><span>Tue<b>30</b></span><span className="today">Wed<b>1</b></span><span>Thu<b>2</b></span><span>Fri<b>3</b></span></div><Agenda time="10:00" color="blue" title="Move-in · Apt 3A" meta="Kinanira Heights · Esther N." initials="EN" hue="pink" /><Agenda time="02:30" color="green" title="Viewing · Studio 2" meta="Rohero Gardens · Alain B." initials="AB" hue="green" /><button className="full-width-link" onClick={() => toast("Your October schedule is ready.")}>Open schedule <span>→</span></button></article>
      <article className="panel requests-panel"><PanelTitle eyebrow="MAINTENANCE" title="Recent requests" action="New request +" onClick={onNew} /><div className="request-list">{requests.map(([title, meta, priority, color], i) => (!complete || i !== 0) && <button className="request-row" key={title} onClick={() => i === 0 ? onDone() : toast(`Opened: ${title}`)}><span className={`request-symbol ${color}`}>{i === 0 ? "!" : "•"}</span><span><strong>{title}</strong><small>{meta}</small></span><b className={`priority ${color}`}>{priority}</b><i>›</i></button>)}</div><button className="full-width-link" onClick={() => toast("All maintenance requests are ready to review.")}>View all requests <span>→</span></button></article>
      <article className="panel messages-panel"><PanelTitle eyebrow="INBOX" title="Resident messages" action="All messages" onClick={() => toast("Your full inbox is ready.")} /><div className="message-list"><Message initials="AM" hue="pink" name="Aimée M." body="We will be home after 5pm today." time="9:42 AM" toast={toast} /><Message initials="JK" hue="green" name="Jean K." body="Thank you — the technician was helpful." time="Yesterday" toast={toast} /><Message initials="CS" hue="blue" name="Cleaning service" body="Weekly schedule confirmed for Friday." time="Mon" toast={toast} /></div></article>
    </section>
    <section className="local-note"><span>✦</span><div><strong>Designed for home, here in Burundi.</strong><small>Keep every conversation, request, document, and home detail in one clear place.</small></div><button onClick={() => toast("Your Burundi-ready workspace is set up.")}>Explore what’s new <b>→</b></button></section>
  </div>;
}

function Resident({ theme, setTheme, onNew, toast }: { theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; onNew: () => void; toast: (message: string) => void }) {
  return <div className="dashboard-frame resident-frame"><Topbar title="Welcome home, Nadine" resident theme={theme} setTheme={setTheme} toast={toast} />
    <section className="resident-hero"><div className="hero-text"><b>APARTMENT 4B</b><h2>Everything for your<br />home, in one place.</h2><p>Stay connected to your building team and get help whenever you need it.</p><div><button className="primary-button" onClick={onNew}>Request maintenance <span>→</span></button><button className="secondary-button" onClick={() => toast("Your building contacts are ready.")}>Building contacts</button></div></div><HomeIllustration /></section>
    <section className="resident-grid"><article className="panel home-status"><PanelTitle eyebrow="HOME STATUS" title="Good to know" action="All clear" onClick={() => toast("Your home has no open requests.")} /><Status icon="✓" tone="green" title="No open requests" body="Your home has no outstanding maintenance items." action="Report an issue" click={onNew} /><Status icon="i" tone="blue" title="Water tank inspection" body="Friday, October 3 · 9:00 AM – 12:00 PM" action="View notice" click={() => toast("Building notice saved.")} /></article><article className="panel contact-card"><p className="section-label">YOUR BUILDING TEAM</p><h2>We’re here to help</h2><Contact initials="DM" hue="green" name="Diane M." role="Community manager" toast={toast} /><Contact initials="JP" hue="blue" name="Jean-Pierre N." role="Maintenance coordinator" toast={toast} /></article><article className="panel documents-card"><PanelTitle eyebrow="DOCUMENTS" title="Your home files" action="View all" onClick={() => toast("Document library opened.")} /><Document icon="▱" title="Lease agreement" body="Signed 14 March 2026" click={() => toast("Lease agreement selected.")} /><Document icon="✦" green title="Welcome guide" body="Kinanira Heights" click={() => toast("Welcome guide selected.")} /></article></section>
  </div>;
}

function Settings({ theme, setTheme, toast }: { theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; toast: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [reviewers, setReviewers] = useState(["netsell2020@gmail.com"]);
  const addReviewer = () => {
    const address = email.trim().toLowerCase();
    if (!address || !address.includes("@")) { toast("Enter a valid reviewer email address."); return; }
    if (reviewers.includes(address)) { toast("That reviewer already has access."); return; }
    setReviewers([...reviewers, address]);
    setEmail("");
    toast("Reviewer added to this feedback list.");
  };
  const copyReviewLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast("Private review link copied."); }
    catch { toast("Use the browser address bar to copy the private review link."); }
  };
  return <div className="dashboard-frame settings-frame">
    <Topbar title="Settings" theme={theme} setTheme={setTheme} toast={toast} />
    <section className="settings-intro"><p className="section-label">WORKSPACE PREFERENCES</p><h2>Make Urugo work your way.</h2><p>Control how your workspace looks and keep feedback access organized for your review team.</p></section>
    <section className="settings-grid">
      <article className="settings-panel appearance-panel"><div className="settings-heading"><div><p className="section-label">APPEARANCE</p><h3>Choose a color mode</h3><span>Your choice is saved on this device.</span></div><span className="settings-icon">◐</span></div><div className="theme-choices"><button className={theme === "light" ? "theme-selected" : ""} onClick={() => setTheme("light")}><b>☀</b><span><strong>Light</strong><small>Bright, clear workspace</small></span><i>{theme === "light" ? "✓" : ""}</i></button><button className={theme === "dark" ? "theme-selected" : ""} onClick={() => setTheme("dark")}><b>◐</b><span><strong>Dark</strong><small>Comfortable for low light</small></span><i>{theme === "dark" ? "✓" : ""}</i></button></div></article>
      <article className="settings-panel feedback-panel"><div className="settings-heading"><div><p className="section-label">FEEDBACK ACCESS</p><h3>Private review team</h3><span>Only invited people can open your review link.</span></div><span className="settings-icon">♙</span></div><div className="access-callout"><span>✓</span><div><strong>Private preview is protected</strong><small>Reviewers can explore the portal and share feedback without making the site public.</small></div></div><div className="reviewer-list"><div className="reviewer-row"><Avatar initials="BT" hue="sand" small /><span><strong>Bertrand TUYISENGE</strong><small>Owner · full control</small></span><b>Owner</b></div>{reviewers.map((reviewer) => <div className="reviewer-row" key={reviewer}><Avatar initials={reviewer.slice(0, 2).toUpperCase()} hue="blue" small /><span><strong>{reviewer}</strong><small>Feedback reviewer · view access</small></span><b className="viewer-badge">Viewer</b></div>)}</div><div className="invite-row"><label htmlFor="reviewer-email">Add another reviewer</label><div><input id="reviewer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addReviewer(); }} placeholder="name@example.com" /><button className="primary-button" onClick={addReviewer}>Add to list</button></div></div><div className="sharing-actions"><button className="secondary-button" onClick={copyReviewLink}>Copy review link</button><span>For permanent live access, invite the reviewer from your hosting access list.</span></div></article>
      <article className="settings-panel workflow-panel"><div className="settings-heading"><div><p className="section-label">FEEDBACK WORKFLOW</p><h3>Review with confidence</h3></div><span className="settings-icon">✦</span></div><div className="workflow-step"><b>1</b><span><strong>Invite a reviewer</strong><small>Keep your product review private and focused.</small></span></div><div className="workflow-step"><b>2</b><span><strong>Share the private link</strong><small>They can explore the resident and manager experiences.</small></span></div><div className="workflow-step"><b>3</b><span><strong>Collect feedback</strong><small>Use comments to guide the next product improvements.</small></span></div></article>
    </section>
  </div>;
}

const placeholderCopy: Record<Exclude<Nav, "Overview" | "Settings">, string> = { Properties: "Bring your full portfolio together, building by building.", Residents: "Offer residents a thoughtful, responsive home experience.", Requests: "Track every maintenance task from report to completion.", Messages: "Keep the whole conversation in one shared place.", Documents: "Store clear records for each home and resident." };

function Metric({ icon, label, value, note, tone }: { icon: string; label: string; value: string; note: string; tone: string }) { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em className={note.startsWith("↑") ? "positive" : ""}>{note}</em></div></article>; }
function PanelTitle({ eyebrow, title, action, onClick }: { eyebrow: string; title: string; action: string; onClick: () => void }) { return <div className="panel-header"><div><p className="section-label">{eyebrow}</p><h2>{title}</h2></div><button onClick={onClick}>{action} {action !== "•••" && !action.includes("+") && <span>→</span>}</button></div>; }
function Building({ dot, name, count, width }: { dot: string; name: string; count: string; width: string }) { return <div><i className={`building-dot ${dot}`} /><span>{name}</span><small>{count}</small><b><i style={{ width }} /></b></div>; }
function Agenda({ time, color, title, meta, initials, hue }: { time: string; color: string; title: string; meta: string; initials: string; hue: string }) { return <div className="agenda"><small>{time}<em>AM</em></small><i className={color} /><span><strong>{title}</strong><small>{meta}</small></span><Avatar initials={initials} hue={hue} small /></div>; }
function Message({ initials, hue, name, body, time, toast }: { initials: string; hue: string; name: string; body: string; time: string; toast: (message: string) => void }) { return <button className="message-row" onClick={() => toast(`Conversation with ${name} opened.`)}><Avatar initials={initials} hue={hue} small /><span><strong>{name}</strong><small>{body}</small></span><time>{time}</time></button>; }
function Status({ icon, tone, title, body, action, click }: { icon: string; tone: string; title: string; body: string; action: string; click: () => void }) { return <div className="status-row"><b className={tone}>{icon}</b><span><strong>{title}</strong><small>{body}</small></span><button onClick={click}>{action} <i>→</i></button></div>; }
function Contact({ initials, hue, name, role, toast }: { initials: string; hue: string; name: string; role: string; toast: (message: string) => void }) { return <div className="contact-person"><Avatar initials={initials} hue={hue} /><span><strong>{name}</strong><small>{role}</small></span><button onClick={() => toast("Message composer opened.")}>Message</button></div>; }
function Document({ icon, green, title, body, click }: { icon: string; green?: boolean; title: string; body: string; click: () => void }) { return <button className="document-row" onClick={click}><b className={green ? "green" : ""}>{icon}</b><span><strong>{title}</strong><small>{body}</small></span><i>›</i></button>; }
function HomeIllustration() { return <div className="home-illustration" aria-hidden="true"><i className="sun" /><i className="hill one" /><i className="hill two" /><div className="house"><i className="roof" /><i className="wall" /><i className="door" /><i className="window a" /><i className="window b" /></div><i className="plant one" /><i className="plant two" /></div>; }
function RequestModal({ close, send }: { close: () => void; send: () => void }) { const [type, setType] = useState("Repair or maintenance"); return <div className="modal-backdrop" onMouseDown={close}><section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-top"><div><p className="section-label">NEW REQUEST</p><h2 id="request-title">How can we help?</h2></div><button onClick={close} aria-label="Close">×</button></div><label>Request type<select value={type} onChange={(e) => setType(e.target.value)}><option>Repair or maintenance</option><option>Building service</option><option>General question</option></select></label><label>What’s happening?<textarea placeholder="Tell your building team what you need…" /></label><div className="modal-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={send}>Send request <span>→</span></button></div></section></div>; }
