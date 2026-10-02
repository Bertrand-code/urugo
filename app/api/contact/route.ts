import { database, errorResponse, isEmail, requireAdmin, runtimeEnv, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

const CONTACT_RECIPIENT = "btuyisenge40@gmail.com";

type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new";
  created_at: string;
};

async function deliverEmail(inquiry: Inquiry) {
  const runtime = runtimeEnv();
  if (!runtime.RESEND_API_KEY) return false;
  const from = runtime.CONTACT_FROM_EMAIL ?? "Urugo <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [CONTACT_RECIPIENT],
      reply_to: inquiry.email,
      subject: `Urugo inquiry: ${inquiry.subject}`,
      text: `New inquiry from ${inquiry.name} (${inquiry.email})\nPhone: ${inquiry.phone || "Not supplied"}\n\n${inquiry.message}`,
    }),
  });
  if (!response.ok) console.error("Unable to deliver contact notification", await response.text());
  return response.ok;
}

export async function GET() {
  try {
    await requireAdmin();
    const db = await database();
    const inquiries = await db.prepare("SELECT id, name, email, phone, subject, message, status, created_at FROM contact_inquiries ORDER BY created_at DESC").all();
    return Response.json({ inquiries: inquiries.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const name = stringField(payload.name, 100);
    const email = stringField(payload.email, 150).toLowerCase();
    const phone = stringField(payload.phone, 50);
    const subject = stringField(payload.subject, 120);
    const message = stringField(payload.message, 3000);
    if (!name || !isEmail(email) || !subject || !message) {
      return Response.json({ error: "Please add your name, email, subject, and message." }, { status: 400 });
    }
    const inquiry: Inquiry = { id: crypto.randomUUID(), name, email, phone, subject, message, status: "new", created_at: new Date().toISOString() };
    const db = await database();
    await db.prepare("INSERT INTO contact_inquiries (id, name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, 'new')")
      .bind(inquiry.id, name, email, phone, subject, message).run();
    const delivered = await deliverEmail(inquiry);
    return Response.json({ inquiry: { id: inquiry.id }, emailNotificationSent: delivered }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
