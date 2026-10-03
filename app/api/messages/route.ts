import { managementScope, can } from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  requirePropertyParticipant,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  property_id: string;
  property_name: string;
  sender_name: string;
  audience: "all" | "resident" | "management";
  body: string;
  created_at: string;
};
const fields =
  "m.id, m.property_id, p.name AS property_name, m.sender_name, m.audience, m.body, m.created_at, c.reply_to, c.context_type, c.context_id, c.recipient_account_id";

export async function GET(request: Request) {
  try {
    const account = await currentAccount();
    if (!account)
      throw new AccessError("Please sign in to view messages.", 401);
    const db = await database();
    const scope = await managementScope(
      account,
      "message.view",
      "m.property_id",
    );
    if (new URL(request.url).searchParams.get("experience") === "personal") {
      scope.sql = "0=1";
      scope.values = [];
    }
    const messages = await db
      .prepare(
        "SELECT " +
          fields +
          " FROM property_messages m JOIN properties p ON p.id=m.property_id LEFT JOIN message_context c ON c.message_id=m.id WHERE (" +
          scope.sql +
          ") OR (((m.audience IN ('all','resident') AND c.recipient_account_id IS NULL) OR c.recipient_account_id=? OR m.sender_account_id=?) AND EXISTS (SELECT 1 FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id WHERE t.property_id=m.property_id AND h.account_id=? AND t.status IN ('active','notice_given','move_out_pending'))) ORDER BY m.created_at DESC LIMIT 100",
      )
      .bind(...scope.values, account.id, account.id, account.id)
      .all<MessageRow>();
    return Response.json({ messages: messages.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const propertyId = stringField(payload.propertyId, 100);
    const signedIn = await currentAccount();
    if (!signedIn) throw new AccessError("Please sign in.", 401);
    const participant = (await can(signedIn, "message.send", propertyId))
      ? { account: signedIn, access: "owner" as const }
      : await requirePropertyParticipant(propertyId);
    const body = stringField(payload.body, 2000);
    let audience = String(payload.audience);
    if (!body)
      return Response.json(
        { error: "Write a message before sending it." },
        { status: 400 },
      );
    if (participant.access === "resident") audience = "management";
    else if (!["all", "resident", "management"].includes(audience))
      audience = "all";
    const message = {
      id: crypto.randomUUID(),
      property_id: propertyId,
      property_name: "",
      sender_name: participant.account.display_name,
      audience,
      body,
      created_at: new Date().toISOString(),
    };
    const db = await database();
    const property = await db
      .prepare("SELECT name FROM properties WHERE id = ?")
      .bind(propertyId)
      .first<{ name: string }>();
    if (!property)
      return Response.json({ error: "Property not found." }, { status: 404 });
    message.property_name = property.name;
    const replyTo = stringField(payload.replyTo) || null;
    let recipient: string | null = null;
    let contextType = "property",
      contextId: string | null = propertyId;
    if (replyTo) {
      const original = await db
        .prepare(
          "SELECT m.sender_account_id,m.audience,c.recipient_account_id,c.context_type,c.context_id FROM property_messages m LEFT JOIN message_context c ON c.message_id=m.id WHERE m.id=? AND m.property_id=?",
        )
        .bind(replyTo, propertyId)
        .first<{
          sender_account_id: string;
          audience: string;
          recipient_account_id: string | null;
          context_type: string | null;
          context_id: string | null;
        }>();
      if (!original) throw new AccessError("Message not found.", 404);
      if (
        participant.access === "resident" &&
        original.sender_account_id !== signedIn.id &&
        original.recipient_account_id !== signedIn.id &&
        (original.audience === "management" || original.recipient_account_id)
      )
        throw new AccessError("Message not found.", 404);
      if (participant.access !== "resident") {
        recipient = original.recipient_account_id || original.sender_account_id;
        audience = "resident";
      } else audience = "management";
      contextType = original.context_type || "property";
      contextId = original.context_id || propertyId;
    }
    message.audience = audience;
    const statements = [
      db
        .prepare(
          "INSERT INTO property_messages (id, property_id, sender_account_id, sender_name, audience, body) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          message.id,
          propertyId,
          participant.account.id,
          participant.account.display_name,
          audience,
          body,
        ),
      db
        .prepare(
          "INSERT INTO message_context (message_id,reply_to,recipient_account_id,context_type,context_id) VALUES (?,?,?,?,?)",
        )
        .bind(message.id, replyTo, recipient, contextType, contextId),
    ];
    await db.batch(statements);
    return Response.json(
      {
        message: {
          ...message,
          reply_to: replyTo,
          recipient_account_id: recipient,
          context_type: contextType,
          context_id: contextId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
