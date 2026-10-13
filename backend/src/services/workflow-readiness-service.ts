import type {
  ReadinessCheckItem,
  ReadinessGateDecision,
  ReadinessGateResult,
  WorkflowStageKey,
  WorkflowStageResult,
} from "../types/workflow-orchestration.js";

export class WorkflowReadinessService {
  evaluate(stages: Record<WorkflowStageKey, WorkflowStageResult>): ReadinessGateResult {
    const checks: ReadinessCheckItem[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];
    const nextSteps: string[] = [];

    const stageA = stages.stage_a_architecture;
    const stageB = stages.stage_b_repository;
    const stageC = stages.stage_c_drift;
    const stageD = stages.stage_d_impact;
    const stageE = stages.stage_e_playground;
    const stageF = stages.stage_f_documentation;
    const stageG = stages.stage_g_verification;
    void stageE;

    // Check if stages are not evaluated at all
    if (!stageA || stageA.status === "not_started") {
      return {
        decision: "not_evaluated",
        summary: "Workflow has not been evaluated. Select an architecture version or run the workflow.",
        checks: [],
        blockers: ["Architecture stage has not been started."],
        warnings: [],
        nextSteps: ["Select a project architecture baseline and run workflow."],
        evaluatedAt: new Date().toISOString(),
      };
    }

    // 1. Architecture Stage Verification
    if (stageA.status === "completed" && Number(stageA.evidence.nodeCount || 0) > 0) {
      checks.push({
        id: "check_architecture_baseline",
        category: "architecture",
        name: "Architecture Baseline Stored",
        status: "pass",
        evidence: `Verified version v${stageA.sourceVersion?.versionNumber || 1} with ${stageA.evidence.nodeCount} component(s) and ${stageA.evidence.edgeCount} connection(s).`,
      });
    } else if (stageA.status === "needs_attention" || stageA.status === "failed") {
      const msg = "No saved architecture version exists for this project.";
      checks.push({
        id: "check_architecture_baseline",
        category: "architecture",
        name: "Architecture Baseline Stored",
        status: "fail",
        evidence: msg,
        actionRequired: "Create and publish an architecture version in Workspace or Architecture editor.",
      });
      blockers.push("Missing baseline architecture version.");
      nextSteps.push("Author and save an architecture version in the Architecture editor.");
    } else {
      checks.push({
        id: "check_architecture_baseline",
        category: "architecture",
        name: "Architecture Baseline Stored",
        status: "warn",
        evidence: "Architecture version exists but contains 0 components.",
        actionRequired: "Add components and connection relationships in Workspace canvas.",
      });
      warnings.push("Architecture version has 0 components defined.");
    }

    // 2. Repository Scan Success & Limitations
    if (stageB) {
      if (stageB.status === "completed") {
        const filesAnalyzed = Number(stageB.evidence.filesAnalyzed || 0);
        const scanLimitations = Array.isArray(stageB.evidence.scanLimitations) ? stageB.evidence.scanLimitations : [];
        if (scanLimitations.length > 0 || filesAnalyzed === 0) {
          checks.push({
            id: "check_repository_scan",
            category: "repository",
            name: "Repository Scan Coverage & Limitations",
            status: "warn",
            evidence: `Analyzed ${filesAnalyzed} file(s). Notice: ${scanLimitations.join("; ") || "Limited scan coverage"}`,
            actionRequired: "Review repository scan limitations and commit source code.",
          });
          warnings.push(`Repository scan coverage limitation: ${scanLimitations.join("; ") || "Limited files"}`);
        } else {
          checks.push({
            id: "check_repository_scan",
            category: "repository",
            name: "Repository Scan Coverage & Limitations",
            status: "pass",
            evidence: `Completed snapshot on commit ${stageB.sourceVersion?.commitSha?.slice(0, 7) || "HEAD"} (${filesAnalyzed} files scanned).`,
          });
        }
      } else if (stageB.status === "failed") {
        checks.push({
          id: "check_repository_scan",
          category: "repository",
          name: "Repository Scan Coverage & Limitations",
          status: "fail",
          evidence: `Repository scan failed: ${stageB.findingsSummary || "Analysis error"}`,
          actionRequired: "Re-run repository analysis or verify repository access credentials.",
        });
        blockers.push("Repository scan snapshot failed.");
        nextSteps.push("Resolve repository access errors and re-run repository analysis.");
      } else if (stageB.status === "needs_attention") {
        checks.push({
          id: "check_repository_scan",
          category: "repository",
          name: "Repository Scan Coverage & Limitations",
          status: "warn",
          evidence: "Repository is connected but no completed analysis snapshot exists.",
          actionRequired: "Trigger a repository analysis scan in Repository Intelligence.",
        });
        warnings.push("No repository analysis snapshot completed yet.");
        nextSteps.push("Run repository analysis in Repository Intelligence.");
      } else {
        checks.push({
          id: "check_repository_scan",
          category: "repository",
          name: "Repository Scan Coverage & Limitations",
          status: "not_executed",
          evidence: "No repository connected for this project.",
          actionRequired: "Connect a repository if repository verification is required.",
        });
      }
    }

    // 3. Unresolved High-Severity Drift Findings
    if (stageC) {
      if (stageC.status === "completed") {
        const criticalDrift = stageC.findings.filter((f) => f.severity === "critical");
        const highDrift = stageC.findings.filter((f) => f.severity === "high");
        const matchScore = Number(stageC.evidence.matchScore || 0);

        if (criticalDrift.length > 0) {
          checks.push({
            id: "check_drift_critical",
            category: "drift",
            name: "Architecture Drift — Critical Severity",
            status: "fail",
            evidence: `${criticalDrift.length} critical drift item(s) detected. Score: ${matchScore}%.`,
            actionRequired: "Remediate critical drift findings or update architecture baseline.",
          });
          blockers.push(`${criticalDrift.length} critical architecture drift finding(s) detected.`);
          nextSteps.push("Review and remediate critical drift findings in the Drift view.");
        } else {
          checks.push({
            id: "check_drift_critical",
            category: "drift",
            name: "Architecture Drift — Critical Severity",
            status: "pass",
            evidence: `0 critical drift items. Match score: ${matchScore}%.`,
          });
        }

        if (highDrift.length > 0) {
          checks.push({
            id: "check_drift_high",
            category: "drift",
            name: "Architecture Drift — High Severity",
            status: "warn",
            evidence: `${highDrift.length} high-severity drift item(s) detected.`,
            actionRequired: "Review high-severity drift findings to confirm intentional divergence.",
          });
          warnings.push(`${highDrift.length} high-severity architecture drift item(s) detected.`);
        }
      } else if (stageC.status === "failed") {
        checks.push({
          id: "check_drift_status",
          category: "drift",
          name: "Architecture Drift Analysis",
          status: "fail",
          evidence: stageC.findingsSummary || "Drift comparison encountered an error.",
          actionRequired: "Retry drift analysis stage.",
        });
        blockers.push("Drift comparison failed.");
      } else if (stageC.status === "not_started" || stageC.status === "needs_attention") {
        checks.push({
          id: "check_drift_status",
          category: "drift",
          name: "Architecture Drift Analysis",
          status: "not_executed",
          evidence: stageC.blockingReason || "Requires completed architecture version and repository analysis snapshot.",
          actionRequired: "Ensure architecture and repository snapshots are completed.",
        });
      }
    }

    // 4. Unresolved High-Risk Impact Findings
    if (stageD) {
      if (stageD.status === "completed") {
        const criticalImpact = stageD.findings.filter((f) => f.severity === "critical");
        const highImpact = stageD.findings.filter((f) => f.severity === "high");

        if (criticalImpact.length > 0) {
          checks.push({
            id: "check_impact_risks",
            category: "impact",
            name: "Engineering Impact Risk Assessment",
            status: "fail",
            evidence: `${criticalImpact.length} critical engineering risk(s) identified in impact analysis.`,
            actionRequired: "Address critical risk findings in proposed change plan.",
          });
          blockers.push(`${criticalImpact.length} critical impact risk(s) identified.`);
          nextSteps.push("Inspect risk mitigation steps in Impact Analysis.");
        } else if (highImpact.length > 0) {
          checks.push({
            id: "check_impact_risks",
            category: "impact",
            name: "Engineering Impact Risk Assessment",
            status: "warn",
            evidence: `${highImpact.length} high-risk item(s) detected in impact report.`,
            actionRequired: "Review change plan tasks and mitigation strategies.",
          });
          warnings.push(`${highImpact.length} high-risk impact item(s) require engineering attention.`);
        } else {
          checks.push({
            id: "check_impact_risks",
            category: "impact",
            name: "Engineering Impact Risk Assessment",
            status: "pass",
            evidence: `Impact analysis completed without critical or high risks (Report ${stageD.sourceVersion?.impactReportId || "verified"}).`,
          });
        }
      } else if (stageD.status === "ready" || stageD.status === "needs_attention") {
        checks.push({
          id: "check_impact_risks",
          category: "impact",
          name: "Engineering Impact Risk Assessment",
          status: "not_executed",
          evidence: "No impact analysis has been executed for this baseline yet.",
          actionRequired: "Select a component or proposed change in Impact Analysis if changes are planned.",
        });
      }
    }

    // 5. Verification: Missing or Insufficient Test Evidence
    if (stageG) {
      const testSuitesExecuted = Boolean(stageG.evidence.testSuitesExecuted);
      const testFilesCount = Number(stageG.evidence.testFilesCount || 0);
      const testRunner = stageG.evidence.testRunner as string | null;

      if (testSuitesExecuted) {
        checks.push({
          id: "check_test_execution",
          category: "testing",
          name: "Test Execution Verification",
          status: "pass",
          evidence: `Automated test execution verified with runner ${testRunner || "detected"}.`,
        });
      } else {
        checks.push({
          id: "check_test_execution",
          category: "testing",
          name: "Test Execution Verification",
          status: "warn",
          evidence: testFilesCount > 0
            ? `Static analysis detected ${testFilesCount} test file(s) (${testRunner || "runner detected"}), but test suites were NOT executed during static analysis.`
            : "No automated test suite execution evidence found in static scan.",
          actionRequired: "Run automated test verification in CI pipeline before deployment.",
        });
        warnings.push("Test suites have not been executed during static analysis.");
        nextSteps.push("Verify test execution results via CI or local test runner.");
      }

      // Security Checks
      const secChecks = Array.isArray(stageG.evidence.securityChecksExecuted) ? stageG.evidence.securityChecksExecuted : [];
      const secFindings = Number(stageG.evidence.securityFindingsCount || 0);
      if (secFindings > 0) {
        checks.push({
          id: "check_security_static",
          category: "security",
          name: "Static Code Security Verification",
          status: "warn",
          evidence: `${secFindings} security advisory finding(s) detected across ${secChecks.length} checks.`,
          actionRequired: "Review security findings in Repository Intelligence.",
        });
        warnings.push(`${secFindings} static security advisory finding(s) detected.`);
      } else if (secChecks.length > 0) {
        checks.push({
          id: "check_security_static",
          category: "security",
          name: "Static Code Security Verification",
          status: "pass",
          evidence: `${secChecks.length} static security checks executed with 0 advisories.`,
        });
      }

      const externalScanningConfigured = Boolean(stageG.evidence.externalScanningConfigured);
      if (!externalScanningConfigured) {
        checks.push({
          id: "check_security_scanner",
          category: "security",
          name: "External Security Scanner Availability",
          status: "warn",
          evidence: "External vulnerability scanner not configured. Static pattern checks alone do not constitute a full CVE vulnerability scan.",
          actionRequired: "Configure dedicated security vulnerability scanner.",
        });
        warnings.push("External security scanner not configured.");
      }
    }

    // 6. Stale or Missing Required Documentation
    if (stageF) {
      const totalDocs = Number(stageF.evidence.totalDocumentsCount || 0);
      const staleDocs = Number(stageF.evidence.staleDocumentsCount || 0);

      if (totalDocs === 0) {
        checks.push({
          id: "check_documentation_freshness",
          category: "documentation",
          name: "Documentation Freshness & Coverage",
          status: "warn",
          evidence: "No documentation documents generated for this project.",
          actionRequired: "Generate system documentation in Documentation Intelligence.",
        });
        warnings.push("No project documentation generated.");
        nextSteps.push("Generate architecture or API documentation in Documentation view.");
      } else if (staleDocs > 0) {
        checks.push({
          id: "check_documentation_freshness",
          category: "documentation",
          name: "Documentation Freshness & Coverage",
          status: "warn",
          evidence: `${staleDocs} of ${totalDocs} document(s) are stale due to source changes.`,
          actionRequired: "Regenerate stale documents to align with latest architecture and repository snapshots.",
        });
        warnings.push(`${staleDocs} document(s) are out of date.`);
        nextSteps.push("Regenerate outdated documents in Documentation view.");
      } else {
        checks.push({
          id: "check_documentation_freshness",
          category: "documentation",
          name: "Documentation Freshness & Coverage",
          status: "pass",
          evidence: `All ${totalDocs} document(s) match current source versions.`,
        });
      }
    }

    // 7. Uncertain Findings Requiring Manual Review
    const uncertainFindings: string[] = [];
    if (stageC) {
      const uncertainDrift = stageC.findings.filter((f) => f.category === "uncertain_match" || f.category === "coverage_limitation");
      if (uncertainDrift.length > 0) {
        uncertainFindings.push(`${uncertainDrift.length} uncertain architecture drift mapping(s)`);
      }
    }
    if (stageD) {
      const uncertainImpact = stageD.findings.filter((f) => f.title.toLowerCase().includes("uncertain") || f.description.toLowerCase().includes("uncertain"));
      if (uncertainImpact.length > 0) {
        uncertainFindings.push(`${uncertainImpact.length} uncertain impact correlation(s)`);
      }
    }
    if (uncertainFindings.length > 0) {
      checks.push({
        id: "check_uncertain_findings",
        category: "drift",
        name: "Uncertain Findings & Ambiguities",
        status: "warn",
        evidence: uncertainFindings.join("; "),
        actionRequired: "Manually review uncertain mappings and coverage limitations.",
      });
      warnings.push(`Manual review needed: ${uncertainFindings.join("; ")}`);
    }

    // Determine Final Readiness Decision
    let decision: ReadinessGateDecision = "ready";
    let summary = "";

    if (blockers.length > 0) {
      decision = "blocked";
      summary = `Workflow blocked by ${blockers.length} critical issue(s): ${blockers[0]}`;
    } else if (warnings.length > 0) {
      decision = "ready_with_warnings";
      summary = `Ready with warnings. ${warnings.length} finding(s) require engineering attention: ${warnings[0]}`;
    } else {
      decision = "ready";
      summary = "All required stages and evidence verified with no blocking or warning findings.";
    }

    return {
      decision,
      summary,
      checks,
      blockers,
      warnings,
      nextSteps,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const workflowReadinessService = new WorkflowReadinessService();
