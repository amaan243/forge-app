import "dotenv/config";
import { repositoryIntelligenceService } from "../src/services/repository-intelligence-service.js";
import { supabaseAdmin } from "../src/lib/supabase.js";

async function main() {
  const { data: repos, error: repoErr } = await supabaseAdmin.from("repositories").select("*").limit(1);
  if (repoErr) {
    console.error("Supabase query error:", repoErr);
    process.exit(1);
  }
  if (!repos || repos.length === 0) {
    console.log("No repository found");
    return;
  }
  const repo = repos[0];
  console.log("Connecting repository analysis for:", repo.repository_url, "Project ID:", repo.project_id);

  const result = await repositoryIntelligenceService.analyze(repo.project_id, repo.connected_by || "user-1");
  console.log("=== ANALYSIS COMPLETE ===");
  console.log("Commit SHA:", result.commit_sha);
  console.log("Status:", result.status);
  console.log("File counts:", result.analysis_data.fileCounts);
  console.log("Languages breakdown:", result.analysis_data.languagesBreakdown);
  console.log("Detected Frameworks:", (result.analysis_data.detectedFrameworks || []).map((f: any) => `${f.name} (${f.version || "detected"})`));
  console.log("Total unique routes discovered:", (result.architecture.routes || []).length);
  console.log("All resolved routes:");
  for (const r of result.architecture.routes || []) {
    console.log(`  [${r.framework}] ${r.method.padEnd(6)} ${r.path.padEnd(35)} -> ${r.file}${r.line ? `:${r.line}` : ""} (handler: ${r.handler || "n/a"})`);
  }
  console.log("Entry points:", result.analysis_data.entryPointDetails);
  console.log("Readiness Score:", result.analysis_data.readiness?.score, result.analysis_data.readiness?.rating);
  console.log("Readiness Factors:");
  for (const f of result.analysis_data.readiness?.factors || []) {
    console.log(`  ${f.name}: ${f.points}/${f.maxPoints} pts (${f.status}) - ${f.description}`);
  }
  console.log("Security Checks Executed:", result.analysis_data.security?.checksExecuted);
  console.log("Security Findings count:", (result.analysis_data.security?.findings || []).length);
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
