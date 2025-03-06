import { retell } from "@/lib/retell/retell-client";
import { db } from "@/server/db";
import { rows } from "@/server/db/schema";
import { z } from "zod";

// Every time we dispatch a call, we need to create the call in Retell and then create a row in our database with the retell call id
// We need to make sure that we are not dispatching the same call multiple times

export class CallDispatcher {
  private readonly MAX_CALLS_PER_RUN = 20;
  private readonly MAX_CALLS_PER_RUN = 20;

  constructor() {}

  async dispatchCall(call: z.infer<typeof dispatchCallSchema>) {
    const { to, from, agentId, metadata, variables } = call;
  }

  async createRetellCall(call: z.infer<typeof dispatchCallSchema>) {
    const { to, from, agentId, metadata, variables } = call;

    const retellCall = await retell.call.createPhoneCall({
      to_number: to,
      from_number: from,
      override_agent_id: agentId,
      retell_llm_dynamic_variables: variables,
      metadata: metadata,
    });

    return retellCall;
  }

  async createDatabaseRow(retellCall: any) {
    const row = await db.insert(rows).values({
      retellCallId: retellCall.id,
      orgId: orgId,
      runId: runId,
      variables: variables,
      metadata: metadata,
    });
  }
}
