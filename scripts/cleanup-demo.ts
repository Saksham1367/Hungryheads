/**
 * Wipe every demo-tagged auth.users row + everything that cascades from it.
 *
 *   pnpm cleanup:demo
 *
 * Safe to run any time: matches ONLY `demo-*@hungryheads.demo`. Your real
 * account is untouched. Also clears any chat_shares created by demo users
 * (cascades automatically via `chat_shares.shared_by → profiles.id`).
 */
import { DEMO_EMAIL_DOMAIN, getAdminClient, log } from "./_demo-shared";

async function main() {
  const admin = await getAdminClient();
  log.info(`Looking for demo users (email like %@${DEMO_EMAIL_DOMAIN})…`);

  // Iterate listUsers; perPage=100 is plenty for demo state.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const demos = (list.users ?? []).filter((u) =>
    u.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`),
  );

  if (demos.length === 0) {
    log.ok("No demo users to clean. Nothing to do.");
    return;
  }

  log.info(`Found ${demos.length} demo user(s). Deleting…`);
  let deleted = 0;
  for (const u of demos) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) {
      log.warn(`  ${u.email}: ${error.message}`);
    } else {
      log.ok(`  ${u.email}`);
      deleted++;
    }
  }

  // Also wipe huddles whose admin was a demo user (they should have cascaded
  // via on-delete-cascade, but in older schemas where admin_id pointed at a
  // since-deleted row we may have orphans; this is a safety net).
  await admin.from("huddles").delete().is("admin_id", null);

  log.ok(`Cleanup complete — ${deleted}/${demos.length} demo accounts removed.`);
}

main().catch((err) => {
  log.err(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
