import axios from "axios";
import { supabaseAdmin } from "../src/lib/supabase.js";

const API_BASE = "http://localhost:4000/api/v1";

async function runArchitectureGenerationFlowTests() {
  console.log("=== STARTING ARCHFORGE ARCHITECTURE GENERATION & VERSIONING TEST ===\n");

  const timestamp = Date.now();
  const user1Email = `architect.${timestamp}@archforge.dev`;
  const user2Email = `intruder.${timestamp}@archforge.dev`;
  const testPassword = "ForgePassword@2026";

  let user1Id: string = "";
  let user2Id: string = "";
  let user1Token: string = "";
  let user2Token: string = "";

  let workspaceId: string = "";
  let projectId: string = "";

  try {
    // 1. SETUP TEST USERS
    console.log("[STEP 1] Creating test users in Supabase...");
    const { data: u1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: user1Email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Alice Architect" },
    });
    if (e1 || !u1.user) throw new Error(`Failed to create user1: ${e1?.message}`);
    user1Id = u1.user.id;

    const { data: u2, error: e2 } = await supabaseAdmin.auth.admin.createUser({
      email: user2Email,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Bob Intruder" },
    });
    if (e2 || !u2.user) throw new Error(`Failed to create user2: ${e2?.message}`);
    user2Id = u2.user.id;

    const login1 = await axios.post(`${API_BASE}/auth/login`, {
      email: user1Email,
      password: testPassword,
    });
    user1Token = login1.data.data.session.accessToken;

    const login2 = await axios.post(`${API_BASE}/auth/login`, {
      email: user2Email,
      password: testPassword,
    });
    user2Token = login2.data.data.session.accessToken;
    console.log("✓ STEP 1 PASSED: Users authenticated.");

    // 2. CREATE WORKSPACE AND PROJECT
    console.log("\n[STEP 2] Creating workspace and project for Alice...");
    const wsRes = await axios.post(
      `${API_BASE}/workspaces`,
      { name: `Workspace ${timestamp}` },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    workspaceId = wsRes.data.data.id;

    const prjRes = await axios.post(
      `${API_BASE}/workspaces/${workspaceId}/projects`,
      { name: "CloudPlatform", description: "Cloud platform project" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    projectId = prjRes.data.data.id;
    console.log(`✓ STEP 2 PASSED: Project created (id: ${projectId}).`);

    // 3. VERIFY INITIAL DATABASE COUNTS ARE 0
    console.log("\n[STEP 3] Verifying initial database counts for this project...");
    const { count: v0Count } = await supabaseAdmin
      .from("architecture_versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    console.log(`Initial architecture_versions count: ${v0Count}`);
    if (v0Count !== 0) throw new Error(`Expected 0 versions initially, got ${v0Count}`);

    // GET /projects/:projectId/architecture must return null version
    const initialArch = await axios.get(`${API_BASE}/projects/${projectId}/architecture`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    if (initialArch.data.data.version !== null || initialArch.data.data.nodes.length !== 0) {
      throw new Error("Expected null version and empty nodes for new project");
    }
    console.log("✓ STEP 3 PASSED: Initial project has 0 versions, 0 nodes.");

    // 4. ATTEMPT GENERATION WITH 0 REQUIREMENTS (MUST REJECT)
    console.log("\n[STEP 4] Attempting generation with 0 requirements (should fail)...");
    let rejectedAsExpected = false;
    try {
      await axios.post(
        `${API_BASE}/projects/${projectId}/architecture/generate`,
        {},
        { headers: { Authorization: `Bearer ${user1Token}` } }
      );
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 422) {
        rejectedAsExpected = true;
        console.log(`✓ Correctly rejected with status ${err.response.status}: ${err.response.data?.message}`);
      }
    }
    if (!rejectedAsExpected) throw new Error("Generation should fail when project has 0 requirements");
    console.log("✓ STEP 4 PASSED: Rejection verified for empty requirements.");

    // 5. CREATE REAL REQUIREMENTS
    console.log("\n[STEP 5] Creating real project requirements...");
    await axios.post(
      `${API_BASE}/projects/${projectId}/requirements`,
      { content: "User authentication with JWT sessions and password security" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    await axios.post(
      `${API_BASE}/projects/${projectId}/requirements`,
      { content: "Relational PostgreSQL database for domain entity persistence" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    await axios.post(
      `${API_BASE}/projects/${projectId}/requirements`,
      { content: "API Gateway routing incoming traffic with rate limiting" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    await axios.post(
      `${API_BASE}/projects/${projectId}/requirements`,
      { content: "Redis in-memory caching for session validation" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log("✓ STEP 5 PASSED: 4 requirements created.");

    // 6. GENERATE PREVIEW (VERIFY DATABASE STILL HAS 0 VERSIONS)
    console.log("\n[STEP 6] Calling POST /projects/:projectId/architecture/generate...");
    const genRes = await axios.post(
      `${API_BASE}/projects/${projectId}/architecture/generate`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    const preview = genRes.data.data.architecture;
    console.log(`Generated preview: ${preview.nodes.length} nodes, ${preview.edges.length} edges`);
    console.log("Nodes:", preview.nodes.map((n: any) => `${n.name} (${n.type})`).join(", "));

    const nodeKeys = preview.nodes.map((n: any) => n.node_key);
    if (!nodeKeys.includes("auth_service")) throw new Error("Missing auth_service node");
    if (!nodeKeys.includes("primary_database")) throw new Error("Missing primary_database node");
    if (!nodeKeys.includes("api_gateway")) throw new Error("Missing api_gateway node");
    if (!nodeKeys.includes("cache_store")) throw new Error("Missing cache_store node");

    // Check DB count: must STILL be 0!
    const { count: vAfterGen } = await supabaseAdmin
      .from("architecture_versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    console.log(`Database architecture_versions count after preview: ${vAfterGen}`);
    if (vAfterGen !== 0) throw new Error("Preview generation must NOT insert records into architecture_versions!");
    console.log("✓ STEP 6 PASSED: Preview generated without creating DB records.");

    // 7. SAVE VERSION 1
    console.log("\n[STEP 7] Calling Save Version (POST /projects/:projectId/architecture/versions)...");
    const saveV1Res = await axios.post(
      `${API_BASE}/projects/${projectId}/architecture/versions`,
      {
        name: "CloudPlatform v1",
        description: "Initial generated architecture",
        nodes: preview.nodes,
        edges: preview.edges,
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    const v1Data = saveV1Res.data.data;
    const v1Id = v1Data.version?.id ?? v1Data.id;
    const v1Num = v1Data.version?.version_number ?? v1Data.version_number;
    console.log(`Saved Version: id=${v1Id}, version_number=${v1Num}`);
    if (v1Num !== 1) throw new Error(`Expected version_number 1, got ${v1Num}`);

    // Check DB counts for Version 1
    const { count: v1DbCount } = await supabaseAdmin
      .from("architecture_versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    const { count: n1DbCount } = await supabaseAdmin
      .from("architecture_nodes")
      .select("*", { count: "exact", head: true })
      .eq("architecture_version_id", v1Id);
    const { count: e1DbCount } = await supabaseAdmin
      .from("architecture_edges")
      .select("*", { count: "exact", head: true })
      .eq("architecture_version_id", v1Id);

    console.log(`DB check: versions=${v1DbCount}, nodes=${n1DbCount}, edges=${e1DbCount}`);
    if (v1DbCount !== 1) throw new Error(`Expected 1 version in DB, got ${v1DbCount}`);
    if ((n1DbCount ?? 0) < 4) throw new Error(`Expected >= 4 nodes in DB, got ${n1DbCount}`);
    if ((e1DbCount ?? 0) < 3) throw new Error(`Expected >= 3 edges in DB, got ${e1DbCount}`);
    console.log("✓ STEP 7 PASSED: Version 1 persisted to PostgreSQL with nodes and edges.");

    // 8. RELOAD ARCHITECTURE FROM GET ENDPOINT
    console.log("\n[STEP 8] Reloading architecture via GET /projects/:projectId/architecture...");
    const reloadRes = await axios.get(`${API_BASE}/projects/${projectId}/architecture`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const loadedGraph = reloadRes.data.data;
    if (loadedGraph.version.id !== v1Id) throw new Error("Reloaded version ID does not match saved version");
    if (loadedGraph.nodes.length !== n1DbCount) throw new Error("Reloaded node count does not match DB");
    console.log(`✓ STEP 8 PASSED: Successfully loaded Version 1 (${loadedGraph.nodes.length} nodes) from PostgreSQL.`);

    // 9. MODIFY REQUIREMENTS & GENERATE VERSION 2
    console.log("\n[STEP 9] Adding billing requirement and generating Version 2...");
    await axios.post(
      `${API_BASE}/projects/${projectId}/requirements`,
      { content: "Stripe payment processing for subscription billing and invoicing" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    const gen2Res = await axios.post(
      `${API_BASE}/projects/${projectId}/architecture/generate`,
      {},
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    const preview2 = gen2Res.data.data.architecture;
    const nodeKeys2 = preview2.nodes.map((n: any) => n.node_key);
    console.log("Preview 2 nodes:", nodeKeys2.join(", "));
    if (!nodeKeys2.includes("billing_service")) throw new Error("Version 2 preview should include billing_service");

    // Save Version 2
    const saveV2Res = await axios.post(
      `${API_BASE}/projects/${projectId}/architecture/versions`,
      {
        name: "CloudPlatform v2",
        description: "Added billing service",
        nodes: preview2.nodes,
        edges: preview2.edges,
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    const v2Data = saveV2Res.data.data;
    const v2Id = v2Data.version?.id ?? v2Data.id;
    const v2Num = v2Data.version?.version_number ?? v2Data.version_number;
    console.log(`Saved Version 2: id=${v2Id}, version_number=${v2Num}`);
    if (v2Num !== 2) throw new Error(`Expected version_number 2, got ${v2Num}`);

    // Verify DB has 2 versions
    const { count: totalVersions } = await supabaseAdmin
      .from("architecture_versions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    if (totalVersions !== 2) throw new Error(`Expected 2 versions in DB, got ${totalVersions}`);

    // Verify Version 1 is UNCHANGED
    const { data: v1Check } = await supabaseAdmin
      .from("architecture_versions")
      .select("*")
      .eq("id", v1Id)
      .single();
    if (v1Check.version_number !== 1) throw new Error("Version 1 number changed!");
    const { count: v1NodesCheck } = await supabaseAdmin
      .from("architecture_nodes")
      .select("*", { count: "exact", head: true })
      .eq("architecture_version_id", v1Id);
    if (v1NodesCheck !== n1DbCount) throw new Error("Version 1 nodes were altered!");

    console.log("✓ STEP 9 PASSED: Version 2 saved (v2). Version 1 is completely preserved and immutable.");

    // 10. VERIFY SECURITY: UNAUTHORIZED USER REJECTED
    console.log("\n[STEP 10] Testing security access boundaries...");
    let securityBlocked = false;
    try {
      await axios.get(`${API_BASE}/projects/${projectId}/architecture`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        securityBlocked = true;
        console.log(`✓ Bob Intruder blocked with status ${err.response.status}`);
      }
    }
    if (!securityBlocked) throw new Error("Bob should not be able to access Alice's architecture");
    console.log("✓ STEP 10 PASSED: Project authorization enforced.");

    console.log("\n========================================================");
    console.log("🎉 ALL ARCHITECTURE GENERATION & VERSIONING TESTS PASSED!");
    console.log("========================================================\n");
  } finally {
    // CLEANUP
    console.log("[CLEANUP] Cleaning up test records...");
    if (projectId) {
      await supabaseAdmin.from("projects").delete().eq("id", projectId);
    }
    if (workspaceId) {
      await supabaseAdmin.from("workspaces").delete().eq("id", workspaceId);
    }
    if (user1Id) {
      await supabaseAdmin.auth.admin.deleteUser(user1Id);
    }
    if (user2Id) {
      await supabaseAdmin.auth.admin.deleteUser(user2Id);
    }
    console.log("✓ Cleanup finished.");
  }
}

runArchitectureGenerationFlowTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
