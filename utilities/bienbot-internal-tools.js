/**
 * Static prompt-side metadata for the 6 internal fetchers (T1-T13 of the
 * prior plan). Execution stays in bienbot-action-executor.js — this file
 * exists so the prompt-generation pipeline has one mechanism for both
 * internal-Mongo fetchers and registry-defined external tools.
 */

const INTERNAL_TOOLS = [
  {
    name: 'fetch_plan_items',
    payloadSchema: { plan_id: 'string', filter: '"all"|"unscheduled"|"scheduled"|"incomplete"|"overdue"', limit: 'number?' },
    promptHints: [
      '"Review/list/show me the items" with an active plan -> fetch_plan_items',
      '"Schedule the unscheduled ones" / "what is left to plan" -> fetch_plan_items with filter="unscheduled" first, then propose update_plan_item actions in your follow-up reply'
    ]
  },
  {
    name: 'fetch_plan_costs',
    payloadSchema: { plan_id: 'string', group_by: '"category"|"item"|"none"' },
    promptHints: [ '"What did I spend" / "break down the costs" with active plan -> fetch_plan_costs' ]
  },
  {
    name: 'fetch_plan_collaborators',
    payloadSchema: { plan_id: 'string' },
    promptHints: [ '"Who is on this plan" -> fetch_plan_collaborators' ]
  },
  {
    name: 'fetch_experience_items',
    payloadSchema: { experience_id: 'string', limit: 'number?' },
    promptHints: [ '"What is in this experience template" -> fetch_experience_items' ]
  },
  {
    name: 'fetch_destination_experiences',
    payloadSchema: { destination_id: 'string', limit: 'number?', sort: '"popular"|"recent"|"name"' },
    promptHints: [ '"What experiences are at <destination>" -> fetch_destination_experiences' ]
  },
  {
    name: 'fetch_user_plans',
    payloadSchema: { user_id: 'string?', status: '"active"|"completed"|"all"', limit: 'number?' },
    promptHints: [ '"What plans am I working on" -> fetch_user_plans (defaults to the requesting user)' ]
  }
];

function renderInternalSchemaLines() {
  const lines = ['Internal data tools (read from local database):'];
  for (const t of INTERNAL_TOOLS) {
    const parts = Object.entries(t.payloadSchema).map(([k, v]) => `${k}: ${v}`).join(', ');
    lines.push(`  - ${t.name}: { ${parts} }`);
  }
  return lines.join('\n');
}

function renderInternalPromptHints() {
  return INTERNAL_TOOLS.flatMap(t => t.promptHints.map(h => `- ${h}`)).join('\n');
}

module.exports = { INTERNAL_TOOLS, renderInternalSchemaLines, renderInternalPromptHints };
