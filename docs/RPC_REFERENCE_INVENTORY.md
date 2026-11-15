# PFMS RPC reference inventory

## Purpose

The RPC reference inventory complements the frontend-to-SQL signature contract test. It enumerates public SQL function names defined by migrations and classifies statically visible references from:

- Browser frontend `app.js` and `scout-workspace.js` using Supabase `.rpc(...)` calls
- Supabase Edge Function TypeScript/JavaScript sources
- SQL references to `public.function_name(...)`
- SQL trigger targets declared with `EXECUTE FUNCTION public.function_name(...)`

## Interpretation and safety

A function with no detected source reference is a **review candidate only**, not proof that it is unused. Static scanning cannot reliably discover dynamic SQL, external PostgREST clients, scheduled jobs, operator scripts, integrations outside this repository, or indirect dispatch mechanisms. A function may also be intentionally retained for backward compatibility.

Therefore this check never changes SQL, grants, migrations, or function definitions. Do not remove or revoke a candidate without confirming live staging catalogs, dependency/trigger references, external consumers, and a rollback path.

The scanner is intentionally additive to existing RPC signature and effective-privilege tests. A green result establishes only that the repository scan ran and found expected reference categories; it does not establish live database reachability or authorization correctness.

## Run

```sh
node tests/rpc-reference-inventory-smoke.mjs
```

The test suite also runs this inventory as part of `npm test`.
