import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = [
  "20261121_pfms_legacy_team_management.sql",
  "20261122_pfms_legacy_team_permissions.sql",
  "20261122_pfms_legacy_team_roster.sql",
  "20261123_pfms_legacy_team_training.sql",
  "20261124_pfms_legacy_team_calendar.sql",
  "20261125_pfms_legacy_team_matches.sql",
  "20261127_pfms_legacy_team_finance.sql",
  "20261201_pfms_legacy_training_cycles.sql",
  "20261202_pfms_legacy_team_analysis.sql",
  "20261203_pfms_legacy_team_events.sql",
  "20261204_pfms_legacy_team_event_participants.sql",
  "20261205_pfms_legacy_team_event_logistics.sql",
  "20261205_pfms_legacy_team_event_travel_plans.sql",
  "20261206_pfms_legacy_team_tasks.sql",
  "20261211_pfms_legacy_team_membership_scope.sql",
  "20261212_pfms_legacy_team_task_assignee_membership.sql",
  "20261213_pfms_training_cycle_session_date_guard.sql",
  "20261214_pfms_match_lineup_team_integrity.sql",
  "20261215_pfms_team_permission_membership_gate.sql",
  "20261216_pfms_roster_select_permission_gate.sql",
  "20261217_pfms_calendar_events_rpc_boundary.sql"
];
const sources = await Promise.all(
  migrationFiles.map((file) => readFile(resolve(migrationDirectory, file), "utf8"))
);
const sql = sources.join("\n");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

const modules = {
  squad: {
    tables: ["pfms_legacy_team_players"],
    rpc: {
      pfms_list_legacy_team_players: "view",
      pfms_search_global_players_for_team: "edit",
      pfms_add_legacy_team_player: "edit",
      pfms_update_legacy_team_player: "edit",
      pfms_remove_legacy_team_player: "edit"
    }
  },
  training: {
    tables: ["pfms_legacy_training_sessions"],
    rpc: {
      pfms_list_legacy_team_training: "view",
      pfms_create_legacy_team_training: "edit",
      pfms_update_legacy_team_training: "edit"
    }
  },
  attendance: {
    tables: ["pfms_legacy_training_attendance"],
    rpc: {
      pfms_list_legacy_training_attendance: "view",
      pfms_mark_legacy_training_attendance: "edit"
    }
  },
  calendar: {
    tables: ["pfms_legacy_team_calendar_events"],
    rpc: {
      pfms_list_legacy_team_calendar: "view",
      pfms_create_legacy_team_calendar_event: "edit",
      pfms_update_legacy_team_calendar_event: "edit"
    }
  },
  matches: {
    tables: ["pfms_legacy_team_matches", "pfms_legacy_team_match_lineup"],
    rpc: {
      pfms_list_legacy_team_matches: "view",
      pfms_create_legacy_team_match: "edit",
      pfms_update_legacy_team_match: "edit",
      pfms_list_legacy_team_match_lineup: "view",
      pfms_list_legacy_team_match_candidates: "view",
      pfms_save_legacy_team_match_lineup: "edit"
    }
  },
  finance: {
    tables: ["pfms_legacy_team_finance_entries"],
    rpc: {
      pfms_list_legacy_team_finance: "view",
      pfms_get_legacy_team_finance_summary: "view",
      pfms_create_legacy_team_finance_entry: "edit",
      pfms_void_legacy_team_finance_entry: "edit"
    }
  },
  analysis: {
    tables: ["pfms_legacy_team_analysis"],
    rpc: {
      pfms_list_legacy_team_analysis_matches: "view",
      pfms_list_legacy_team_analysis: "view",
      pfms_create_legacy_team_analysis: "edit",
      pfms_update_legacy_team_analysis: "edit",
      pfms_delete_legacy_team_analysis: "edit"
    }
  },
  events: {
    tables: [
      "pfms_legacy_team_event_participants",
      "pfms_legacy_team_event_logistics",
      "pfms_legacy_team_event_travel_plans"
    ],
    rpc: {
      pfms_list_legacy_team_events: "view",
      pfms_create_legacy_team_event: "edit",
      pfms_update_legacy_team_event: "edit",
      pfms_delete_legacy_team_event: "edit",
      pfms_list_legacy_team_event_participants: "view",
      pfms_list_legacy_team_event_player_options: "view",
      pfms_add_legacy_team_event_participant: "edit",
      pfms_update_legacy_team_event_participant: "edit",
      pfms_remove_legacy_team_event_participant: "edit",
      pfms_list_legacy_team_events_with_logistics: "view",
      pfms_save_legacy_team_event: "edit",
      pfms_list_legacy_team_event_travel_plans: "view",
      pfms_save_legacy_team_event_travel_plan: "edit",
      pfms_delete_legacy_team_event_travel_plan: "edit"
    }
  },
  tasks: {
    tables: ["pfms_legacy_team_tasks"],
    rpc: {
      pfms_list_legacy_team_tasks: "view",
      pfms_create_legacy_team_task: "edit",
      pfms_update_legacy_team_task: "edit",
      pfms_delete_legacy_team_task: "edit"
    }
  }
};

function latestFunctionBody(name) {
  const pattern = new RegExp(
    "create\\s+(?:or\\s+replace\\s+)?function\\s+public\\." +
      name +
      "\\s*\\([\\s\\S]*?\\bas\\s+\\$\\$([\\s\\S]*?)\\$\\$;",
    "gi"
  );
  const matches = [...sql.matchAll(pattern)];
  assert.ok(matches.length > 0, "Missing database RPC definition: " + name);
  return matches.at(-1)[1].replace(/\s+/g, " ").toLowerCase();
}

function latestSelectPolicyBody(tableName) {
  const pattern = new RegExp(
    "create policy\\s+[a-z0-9_]+\\s+on\\s+public\\." +
      tableName +
      "\\s+for\\s+select\\s+to\\s+authenticated\\s+using\\s*\\(([\\s\\S]*?)\\);",
    "gi"
  );
  const matches = [...sql.matchAll(pattern)];
  assert.ok(matches.length > 0, "Missing authenticated SELECT policy: " + tableName);
  return matches.at(-1)[1].replace(/\s+/g, " ").toLowerCase();
}

let rpcCount = 0;
let tableCount = 0;
for (const [moduleKey, definition] of Object.entries(modules)) {
  for (const [functionName, action] of Object.entries(definition.rpc)) {
    const body = latestFunctionBody(functionName);
    const permissionCheck = new RegExp(
      "pfms_has_legacy_team_permission\\s*\\([^)]*?['\"]" +
        moduleKey +
        "['\"]\\s*,\\s*['\"]" +
        action +
        "['\"]\\s*\\)"
    );
    assert.match(
      body,
      permissionCheck,
      functionName + " must enforce " + moduleKey + "." + action + " in its latest definition"
    );
    rpcCount += 1;
  }

  for (const tableName of definition.tables) {
    const tableRef = "public\\." + tableName;
    assert.match(
      normalized,
      new RegExp("alter table " + tableRef + " enable row level security"),
      moduleKey + " table must enable RLS: " + tableName
    );
    assert.match(
      normalized,
      new RegExp("alter table " + tableRef + " force row level security"),
      moduleKey + " table must force RLS: " + tableName
    );

    const policyBody = latestSelectPolicyBody(tableName);
    const requiredPolicyModules =
      tableName === "pfms_legacy_training_sessions"
        ? ["training", "attendance"]
        : tableName === "pfms_legacy_team_calendar_events"
          ? ["calendar", "events"]
          : [moduleKey];
    for (const requiredModule of requiredPolicyModules) {
      assert.match(
        policyBody,
        new RegExp(
          "pfms_has_legacy_team_permission\\s*\\([^)]*?['\"]" +
            requiredModule +
            "['\"]\\s*,\\s*['\"]view['\"]"
        ),
        moduleKey + " table SELECT policy must enforce " + requiredModule + ".view: " + tableName
      );
    }
    tableCount += 1;
  }
}

assert.match(
  normalized,
  /add constraint pfms_legacy_team_permissions_module_key_check\s+check\s*\(module_key in\s*\([^)]*'tasks'[^)]*\)\)/,
  "Permission table constraint must allow the ninth module, tasks."
);
assert.match(
  normalized,
  /jsonb_array_length\(p_permissions\)\s*<>\s*9/,
  "Permission save RPC must require all nine module entries."
);
assert.match(
  normalized,
  /count\(distinct value ->> 'module_key'\)[\s\S]*?\)\s*<>\s*9/,
  "Permission save RPC must reject duplicate or missing module entries."
);

const latestPermissionHelper = latestFunctionBody("pfms_has_legacy_team_permission");
assert.match(
  latestPermissionHelper,
  /public\.pfms_can_access_legacy_team\s*\(p_team_id\)/,
  "Module permissions must be gated by current central team/organization access."
);
assert.match(
  latestPermissionHelper,
  /'squad'[\s\S]*?'tasks'/,
  "The central permission helper must retain all nine supported modules."
);
const latestPermissionList = latestFunctionBody("pfms_list_legacy_team_permissions");
assert.match(
  latestPermissionList,
  /public\.pfms_can_access_legacy_team\s*\(v_team_id\)/,
  "Permission settings must not be readable through stale team assignments."
);

const trainingList = latestFunctionBody("pfms_list_legacy_team_training");
assert.match(
  trainingList,
  /'training', 'view'[\s\S]*?'attendance', 'view'/,
  "Combined training view must independently gate attendance data."
);


const latestCalendarList = latestFunctionBody("pfms_list_legacy_team_calendar");
assert.match(
  latestCalendarList,
  /'calendar', 'view'[\s\S]*?event_type not in \('tournament', 'event'\)/,
  "Calendar read RPC must exclude event/tournament rows even though it is SECURITY DEFINER."
);
const latestCalendarCreate = latestFunctionBody("pfms_create_legacy_team_calendar_event");
assert.match(
  latestCalendarCreate,
  /'calendar', 'edit'[\s\S]*?p_event_type not in \('match',\s*'meeting',\s*'other'\)/,
  "Calendar create RPC must accept only calendar-owned entry types."
);
const latestCalendarUpdate = latestFunctionBody("pfms_update_legacy_team_calendar_event");
assert.match(
  latestCalendarUpdate,
  /select team_id, event_type into v_team_id, v_existing_event_type/,
  "Calendar update RPC must load the existing row type before authorization."
);
assert.match(
  latestCalendarUpdate,
  /v_existing_event_type in \('tournament',\s*'event'\)/,
  "Calendar update RPC must refuse to mutate event-owned rows."
);
assert.match(
  latestCalendarUpdate,
  /p_event_type not in \('match',\s*'meeting',\s*'other'\)/,
  "Calendar update RPC must not convert calendar rows into event-owned rows."
);
const latestEventsList = latestFunctionBody("pfms_list_legacy_team_events");
assert.match(
  latestEventsList,
  /'events', 'view'[\s\S]*?event_type in \('tournament',\s*'event'\)/,
  "Events read RPC must remain separately permission-gated and type-scoped."
);

const indexHtml = await readFile(resolve(process.cwd(), "index.html"), "utf8");
const calendarForm = indexHtml.match(/<form id="pfmsTeamCalendarForm"[\s\S]*?<\/form>/)?.[0] || "";
assert.ok(calendarForm, "Calendar form must exist.");
assert.match(calendarForm, /value="match"/, "Calendar UI must retain match entries.");
assert.match(calendarForm, /value="meeting"/, "Calendar UI must retain meeting entries.");
assert.match(calendarForm, /value="other"/, "Calendar UI must retain other entries.");
assert.doesNotMatch(
  calendarForm,
  /value="(?:event|tournament)"/,
  "Calendar UI must route event/tournament creation through the events module."
);

const appSource = await readFile(resolve(process.cwd(), "app.js"), "utf8");
const calendarTypeMap = appSource.match(/const PFMS_TEAM_CALENDAR_TYPES = \{([\s\S]*?)\};/)?.[1] || "";
assert.ok(calendarTypeMap, "Calendar UI type map must exist.");
assert.doesNotMatch(
  calendarTypeMap,
  /\b(?:event|tournament)\s*:/,
  "Calendar UI type map must not treat event-owned types as calendar entries."
);

console.log(
  "PFMS team permission regression tests passed: " +
    rpcCount +
    " guarded RPCs, " +
    tableCount +
    " FORCE-RLS module tables, nine permission keys and central membership gate."
);
