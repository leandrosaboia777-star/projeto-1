import { proposalSchema } from "../../../src/domain/schema.ts";
import { authenticated, json, failure } from "../_shared/http.ts";
import { encryptAccess } from "../_shared/encryption.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client, profile } = await authenticated(req);
    if (profile.role !== "manager") throw new Error("FORBIDDEN");
    const body = await req.json();
    const proposal = proposalSchema.parse(body.proposal);
    // Assign the house UUID before encryption so the envelope is bound to its final row.
    const houseId =
      proposal.action === "create_house"
        ? crypto.randomUUID()
        : proposal.action === "update_house"
          ? proposal.house_id
          : null;
    const access =
      "access_instructions" in proposal &&
      proposal.access_instructions !== undefined &&
      houseId
        ? await encryptAccess(
            proposal.access_instructions,
            profile.business_id,
            houseId,
          )
        : null;
    const { data, error } = await client.rpc("commit_assistant_proposal", {
      proposal,
      p_house_id: houseId,
      p_access: access,
    });
    if (error) throw error;
    return json(data);
  } catch (e) {
    return failure(e);
  }
});
