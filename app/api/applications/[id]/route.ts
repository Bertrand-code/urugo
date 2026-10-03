import {
  database,
  requireAccount,
  errorResponse,
  AccessError,
  stringField,
} from "@/lib/data";
import { can, auditStatement } from "@/lib/authorization";
import {
  applicationFields,
  applicationJoin,
  profileData,
  stages,
  legacyStatus,
} from "@/lib/applications";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount();
    const db = await database();
    const id = (await params).id;
    const row = await db
      .prepare(
        "SELECT " +
          applicationFields +
          ",w.account_id,w.profile_snapshot FROM " +
          applicationJoin +
          " WHERE a.id=?",
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) throw new AccessError("Application not found.", 404);
    const own = row.account_id === account.id;
    const manager = await can(
      account,
      "application.view",
      String(row.property_id),
    );
    if (!own && !manager) throw new AccessError("Application not found.", 404);
    if (!own && row.stage === "draft")
      throw new AccessError("Application not found.", 404);
    const timeline = await db
      .prepare(
        "SELECT id,stage,message,internal,created_at FROM application_events WHERE application_id=?" +
          (manager && !own ? "" : " AND internal=0") +
          " ORDER BY created_at",
      )
      .bind(id)
      .all();
    const {
      account_id: accountId,
      profile_snapshot: snapshot,
      ...application
    } = row;
    void accountId;
    if (own) delete application.assigned_to;
    return Response.json({
      application,
      profile: JSON.parse(String(snapshot)),
      timeline: timeline.results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount();
    const db = await database();
    const id = (await params).id;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await db
      .prepare(
        "SELECT a.property_id,w.account_id,w.stage FROM applications a JOIN application_workflows w ON w.application_id=a.id WHERE a.id=?",
      )
      .bind(id)
      .first<{
        property_id: string;
        account_id: string | null;
        stage: string;
      }>();
    if (!row) throw new AccessError("Application not found.", 404);
    const own = row.account_id === account.id;
    const manager = await can(account, "application.review", row.property_id);
    if (!own && !manager) throw new AccessError("Application not found.", 404);
    const aliases: Record<string, string> = {
      new: "submitted",
      reviewing: "under_review",
      accepted: "approved",
      declined: "denied",
    };
    const stage = body.stage
      ? String(body.stage)
      : body.status
        ? aliases[String(body.status)]
        : row.stage;
    if (!stages.includes(stage as (typeof stages)[number]))
      throw new AccessError("Choose a valid stage.", 400);
    if (
      own &&
      (!["draft", "needs_information"].includes(row.stage) ||
        !["draft", "submitted", "withdrawn", row.stage].includes(stage)) &&
      stage !== "withdrawn"
    )
      throw new AccessError("This application can no longer be edited.", 409);
    if (
      own &&
      stage === "withdrawn" &&
      ["denied", "withdrawn"].includes(row.stage)
    )
      throw new AccessError("This application is already closed.", 409);
    if (!own && row.stage === "draft")
      throw new AccessError("Drafts are private to the applicant.", 403);
    const statements: D1PreparedStatement[] = [];
    if (own && stage !== "withdrawn") {
      const fullName = stringField(body.fullName, 100),
        phone = stringField(body.phone, 50),
        size = Number(body.householdSize) || 1;
      if (
        !Number.isInteger(size) ||
        size < 1 ||
        size > 30 ||
        (stage === "submitted" && (!fullName || !phone))
      )
        throw new AccessError(
          "Complete contact and household details before submitting.",
          400,
        );
      statements.push(
        db
          .prepare(
            "UPDATE applications SET full_name=?,phone=?,household_size=?,move_in_date=?,message=? WHERE id=?",
          )
          .bind(
            fullName || account.display_name,
            phone,
            size,
            stringField(body.moveInDate) || null,
            stringField(body.message, 2000),
            id,
          ),
      );
      statements.push(
        db
          .prepare(
            "UPDATE application_workflows SET profile_snapshot=? WHERE application_id=?",
          )
          .bind(JSON.stringify(profileData(body.profile)), id),
      );
    }
    if (body.assignedTo !== undefined && !own) {
      const assignedTo = stringField(body.assignedTo) || null;
      if (assignedTo) {
        const reviewer = await db
          .prepare(
            "SELECT account_id FROM staff_assignments WHERE account_id=? AND property_id=? AND status='active' AND role IN ('property_manager','leasing_agent')",
          )
          .bind(assignedTo, row.property_id)
          .first();
        if (!reviewer)
          throw new AccessError("Choose an assigned leasing team member.", 400);
      }
      statements.push(
        db
          .prepare(
            "UPDATE application_workflows SET assigned_to=? WHERE application_id=?",
          )
          .bind(assignedTo, id),
      );
    }
    statements.push(
      db
        .prepare(
          "UPDATE application_workflows SET stage=?,updated_at=CURRENT_TIMESTAMP WHERE application_id=?",
        )
        .bind(stage, id),
      db
        .prepare("UPDATE applications SET status=? WHERE id=?")
        .bind(legacyStatus(stage), id),
    );
    const message = stringField(body.note, 2000);
    if (stage !== row.stage || message)
      statements.push(
        db
          .prepare(
            "INSERT INTO application_events (id,application_id,actor_id,stage,message,internal) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            id,
            account.id,
            stage,
            message,
            !own && body.internal === true ? 1 : 0,
          ),
      );
    statements.push(
      auditStatement(db, account, row.property_id, "application." + stage, id),
    );
    await db.batch(statements);
    return Response.json({
      application: { id, status: legacyStatus(stage), stage },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
