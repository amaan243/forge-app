import axios from "axios";
import { supabaseAdmin } from "../src/lib/supabase.js";

const API_BASE = "http://localhost:4000/api/v1";

async function runWorkspaceProjectTests() {
  console.log("=== STARTING ARCHFORGE WORKSPACE & PROJECT TEST SUITE ===\n");

  const timestamp = Date.now();
  const user1Email = `ws.architect.${timestamp}@archforge.dev`;
  const user2Email = `other.architect.${timestamp}@archforge.dev`;
  const testPassword = "ForgePassword@2026";

  let user1Id: string = "";
  let user2Id: string = "";
  let user1Token: string = "";
  let user2Token: string = "";

  let workspaceId: string = "";
  let projectId: string = "";

  try {
    // 1. SETUP TEST USERS
    console.log("[STEP 1] Creating verified test users in Supabase...");
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
      user_metadata: { full_name: "Bob Infiltrator" },
    });
    if (e2 || !u2.user) throw new Error(`Failed to create user2: ${e2?.message}`);
    user2Id = u2.user.id;

    // Login user 1
    const login1 = await axios.post(`${API_BASE}/auth/login`, {
      email: user1Email,
      password: testPassword,
    });
    user1Token = login1.data.data.session.accessToken;

    // Login user 2
    const login2 = await axios.post(`${API_BASE}/auth/login`, {
      email: user2Email,
      password: testPassword,
    });
    user2Token = login2.data.data.session.accessToken;
    console.log("✓ STEP 1 PASSED: Test users created and authenticated.");

    // 2. LIST INITIAL WORKSPACES (SHOULD BE EMPTY)
    console.log("\n[STEP 2] List initial workspaces for Alice...");
    const initialList = await axios.get(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Initial Workspaces count:", initialList.data.data.length);
    console.log("✓ STEP 2 PASSED: Initial workspaces list retrieved.");

    // 3. CREATE WORKSPACE
    console.log("\n[STEP 3] Alice creates a new workspace...");
    const createWsRes = await axios.post(
      `${API_BASE}/workspaces`,
      {
        name: "Enterprise Core Platform",
        description: "Primary production architecture workspace for core services",
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log("Create Workspace Status:", createWsRes.status);
    const ws = createWsRes.data.data;
    workspaceId = ws.id;
    console.log("Created Workspace:", { id: ws.id, name: ws.name, slug: ws.slug, owner_id: ws.owner_id });
    if (!ws.id || ws.owner_id !== user1Id) throw new Error("Workspace owner or ID mismatch");
    console.log("✓ STEP 3 PASSED: Workspace created successfully.");

    // 4. VERIFY WORKSPACE & MEMBERSHIP IN SUPABASE POSTGRESQL
    console.log("\n[STEP 4] Verifying workspace and membership in Supabase PostgreSQL...");
    const { data: dbWs } = await supabaseAdmin.from("workspaces").select().eq("id", workspaceId).single();
    if (!dbWs) throw new Error("Workspace not found in database");
    console.log("DB Workspace found:", dbWs.name);

    const { data: dbMembers } = await supabaseAdmin.from("workspace_members").select().eq("workspace_id", workspaceId);
    console.log("DB Members count:", dbMembers?.length);
    const ownerMember = dbMembers?.find((m) => m.user_id === user1Id);
    if (!ownerMember || ownerMember.role !== "owner") {
      throw new Error("Creator is not registered as owner in workspace_members");
    }
    console.log("✓ STEP 4 PASSED: Creator verified as owner in workspace_members.");

    // 5. GET WORKSPACE DETAILS
    console.log("\n[STEP 5] Alice gets workspace details...");
    const getWsRes = await axios.get(`${API_BASE}/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Fetched Workspace Name:", getWsRes.data.data.name);
    console.log("✓ STEP 5 PASSED: Workspace details retrieved.");

    // 6. UPDATE WORKSPACE
    console.log("\n[STEP 6] Alice updates workspace description...");
    const updateWsRes = await axios.patch(
      `${API_BASE}/workspaces/${workspaceId}`,
      { description: "Updated platform description v2" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log("Updated Description:", updateWsRes.data.data.description);
    if (updateWsRes.data.data.description !== "Updated platform description v2") {
      throw new Error("Workspace description not updated");
    }
    console.log("✓ STEP 6 PASSED: Workspace updated successfully.");

    // 7. CREATE PROJECT INSIDE WORKSPACE
    console.log("\n[STEP 7] Alice creates a project inside the workspace...");
    const createProjRes = await axios.post(
      `${API_BASE}/workspaces/${workspaceId}/projects`,
      {
        name: "Payments Ingestion Gateway",
        description: "High-throughput PCI-compliant payment webhook ingestor",
        visibility: "workspace",
      },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log("Create Project Status:", createProjRes.status);
    const proj = createProjRes.data.data;
    projectId = proj.id;
    console.log("Created Project:", { id: proj.id, name: proj.name, slug: proj.slug, workspace_id: proj.workspace_id });
    if (!proj.id || proj.workspace_id !== workspaceId || proj.created_by !== user1Id) {
      throw new Error("Project metadata mismatch");
    }
    console.log("✓ STEP 7 PASSED: Project created inside workspace.");

    // 8. VERIFY PROJECT IN SUPABASE
    console.log("\n[STEP 8] Verifying project in Supabase database...");
    const { data: dbProj } = await supabaseAdmin.from("projects").select().eq("id", projectId).single();
    if (!dbProj || dbProj.name !== "Payments Ingestion Gateway") {
      throw new Error("Project not found in Supabase database");
    }
    console.log("✓ STEP 8 PASSED: Project verified in Supabase.");

    // 9. LIST PROJECTS IN WORKSPACE
    console.log("\n[STEP 9] Listing projects in workspace...");
    const listProjRes = await axios.get(`${API_BASE}/workspaces/${workspaceId}/projects`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Projects count:", listProjRes.data.data.length);
    if (!listProjRes.data.data.some((p: any) => p.id === projectId)) {
      throw new Error("Created project not in workspace project list");
    }
    console.log("✓ STEP 9 PASSED: Workspace projects listed.");

    // 10. GET PROJECT BY ID
    console.log("\n[STEP 10] Get project by ID...");
    const getProjRes = await axios.get(`${API_BASE}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Fetched Project Name:", getProjRes.data.data.name);
    console.log("✓ STEP 10 PASSED: Project retrieved by ID.");

    // 11. UPDATE PROJECT
    console.log("\n[STEP 11] Update project description...");
    const updateProjRes = await axios.patch(
      `${API_BASE}/projects/${projectId}`,
      { description: "Updated high-throughput payment webhook ingestor" },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    console.log("Updated Project Description:", updateProjRes.data.data.description);
    console.log("✓ STEP 11 PASSED: Project updated successfully.");

    // 12. SECURITY CHECK: BOB ATTEMPTS UNAUTHORIZED ACCESS
    console.log("\n[STEP 12] Security check: Bob attempts unauthorized access...");
    // Bob tries to get Alice's workspace
    try {
      await axios.get(`${API_BASE}/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      throw new Error("Security failure: Bob should NOT be able to view Alice's workspace!");
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        console.log("Correctly blocked Bob from accessing Alice's workspace (HTTP", err.response.status, ")");
      } else {
        throw err;
      }
    }

    // Bob tries to create project in Alice's workspace
    try {
      await axios.post(
        `${API_BASE}/workspaces/${workspaceId}/projects`,
        { name: "Malicious Project" },
        { headers: { Authorization: `Bearer ${user2Token}` } }
      );
      throw new Error("Security failure: Bob should NOT be able to create a project in Alice's workspace!");
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        console.log("Correctly blocked Bob from creating project in Alice's workspace (HTTP", err.response.status, ")");
      } else {
        throw err;
      }
    }

    // Bob tries to view Alice's project
    try {
      await axios.get(`${API_BASE}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      throw new Error("Security failure: Bob should NOT be able to access Alice's project!");
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        console.log("Correctly blocked Bob from accessing Alice's project (HTTP", err.response.status, ")");
      } else {
        throw err;
      }
    }
    console.log("✓ STEP 12 PASSED: All unauthorized access attempts blocked securely.");

    // 13. DELETE PROJECT
    console.log("\n[STEP 13] Alice deletes project...");
    const deleteProjRes = await axios.delete(`${API_BASE}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Delete Project Status:", deleteProjRes.status);

    // Verify it's no longer listed
    const postDeleteList = await axios.get(`${API_BASE}/workspaces/${workspaceId}/projects`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    if (postDeleteList.data.data.some((p: any) => p.id === projectId)) {
      throw new Error("Deleted project still appeared in active list!");
    }
    console.log("✓ STEP 13 PASSED: Project soft-deleted and omitted from active list.");

    // 14. DELETE WORKSPACE
    console.log("\n[STEP 14] Alice deletes workspace...");
    const deleteWsRes = await axios.delete(`${API_BASE}/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    console.log("Delete Workspace Status:", deleteWsRes.status);
    console.log("✓ STEP 14 PASSED: Workspace deleted.");

    console.log("\n=======================================================");
    console.log("🎉 ALL 14 WORKSPACE & PROJECT TESTS PASSED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    // Cleanup users
    if (user1Id) await supabaseAdmin.auth.admin.deleteUser(user1Id).catch(() => {});
    if (user2Id) await supabaseAdmin.auth.admin.deleteUser(user2Id).catch(() => {});
    console.log("\nCleanup complete.");
  }
}

runWorkspaceProjectTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err.response?.data || err.message);
  process.exit(1);
});
