export type RepositoryProviderName = "github" | "gitlab" | "bitbucket";
export type RepositoryAccessType = "public" | "private";
export type AnalysisStatus = "queued" | "running" | "completed" | "failed";
export type DependencyType = "runtime" | "development" | "peer" | "infrastructure";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type DriftItemType = "missing" | "extra" | "mismatch" | "uncertain" | "coverage_limitation" | "limitation" | "integration_mismatch";
export type DriftFindingType =
  | "missing_component"
  | "extra_module"
  | "technology_mismatch"
  | "integration_mismatch"
  | "uncertain_match"
  | "coverage_limitation";
export type DriftSeverity = "low" | "medium" | "high" | "critical";

export interface RepositoryRecord {
  id: string;
  project_id: string;
  provider: RepositoryProviderName;
  repository_url: string;
  repository_name: string;
  owner: string;
  default_branch: string;
  access_type: RepositoryAccessType;
  external_repository_id: string;
  credential_reference?: string;
  connected_by: string;
  created_at: string;
  updated_at: string;
}

export interface RepositoryFile {
  path: string;
  content: string;
  size?: number;
}

export interface RepositorySnapshot {
  repository: RepositoryRecord;
  commitSha: string;
  files: RepositoryFile[];
}

export interface FileCounts {
  totalFilesDiscovered: number;
  eligibleSourceFiles: number;
  analyzedSourceFiles: number;
  skippedFiles: number;
  failedFiles: number;
  manifestFilesProcessed: number;
}

export interface LanguageBreakdownItem {
  name: string;
  count: number;
  percentage: number;
  extensions: string[];
  evidence: string[];
}

export interface DetectedFramework {
  name: string;
  ecosystem: string;
  version?: string;
  evidenceFile: string;
  evidenceType: "manifest_dependency" | "config_file" | "source_import" | "entry_point";
  confidence: "high" | "medium";
  category: "frontend" | "backend" | "database" | "ml" | "styling" | "tooling" | "other";
}

export interface DetectedRoute {
  method: string;
  path: string;
  framework: "Express" | "FastAPI" | "NestJS" | "Flask" | "Other";
  file: string;
  line?: number;
  handler?: string;
  middleware?: string[];
  confidence: "high" | "medium" | "inferred";
  detectionBasis: "mounted_router" | "direct_app_route" | "decorator" | "inferred";
}

export interface DetectedEntryPoint {
  path: string;
  kind: "backend_server" | "frontend_app" | "ml_service" | "worker" | "script";
  evidence: string;
  confidence: "confirmed" | "probable";
}

export interface SecurityFinding {
  rule: string;
  severity: "low" | "medium" | "high" | "critical";
  file: string;
  line?: number;
  message: string;
  snippet?: string;
}

export interface SecurityCheckResult {
  checksExecuted: string[];
  filesScanned: number;
  findings: SecurityFinding[];
  externalScanningConfigured: boolean;
  advisory: string;
}

export interface ReadinessFactor {
  name: string;
  points: number;
  maxPoints: number;
  status: "pass" | "partial" | "fail";
  description: string;
}

export interface ReadinessScoreBreakdown {
  score: number;
  rating: string;
  factors: ReadinessFactor[];
}

export interface RepositoryAnalysis {
  id: string;
  repository_id: string;
  project_id: string;
  commit_sha: string;
  status: AnalysisStatus;
  frameworks: string[] | DetectedFramework[] | Record<string, unknown>;
  languages: Record<string, number> | Record<string, unknown>;
  dependencies: Array<Record<string, unknown>> | Record<string, unknown>;
  infrastructure: Record<string, unknown>;
  architecture: {
    frontend?: string[];
    backend?: string[];
    services?: string[];
    databases?: string[];
    apis?: string[];
    routes?: DetectedRoute[];
    entryPoints?: DetectedEntryPoint[];
    authentication?: boolean;
    technologies?: string[];
    externalIntegrations?: string[];
    [key: string]: unknown;
  };
  metrics: {
    fileCount?: number;
    dependencyCount?: number;
    serviceCount?: number;
    apiCount?: number;
    databaseCount?: number;
    routeCount?: number;
    entryPointCount?: number;
    testCount?: number;
    infrastructureComplexity?: number;
    [key: string]: unknown;
  };
  analysis_data: {
    commitSha?: string;
    branch?: string;
    filesAnalyzed?: number;
    fileCounts?: FileCounts;
    languagesBreakdown?: LanguageBreakdownItem[];
    detectedFrameworks?: DetectedFramework[];
    detectedEnvVars?: string[];
    entryPoints?: string[] | DetectedEntryPoint[];
    testRunner?: string | null;
    testFiles?: string[];
    testCount?: number;
    externalIntegrations?: string[];
    warnings?: string[];
    security?: SecurityCheckResult;
    readiness?: ReadinessScoreBreakdown;
    error?: string | null;
    [key: string]: unknown;
  };
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DependencyRecord {
  id: string;
  project_id: string;
  repository_analysis_id: string;
  name: string;
  version: string;
  ecosystem: string;
  type: DependencyType;
  risk_level: RiskLevel;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DependencyGraph {
  nodes: Array<{
    id: string;
    name: string;
    version: string;
    ecosystem: string;
    risk: RiskLevel;
    depth: number;
    fanIn: number;
    fanOut: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: "depends_on";
  }>;
  circularCandidates: string[][];
  unusedDependencies?: string[];
  vulnerabilityScanningConfigured?: boolean;
  notice?: string;
}

export interface DriftCategoryCounts {
  missing_component: number;
  extra_module: number;
  technology_mismatch: number;
  integration_mismatch: number;
  uncertain_match: number;
  coverage_limitation: number;
}

export interface DriftSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DriftCounts {
  total: number;
  byCategory: DriftCategoryCounts;
  bySeverity: DriftSeverityCounts;
}

export interface DriftFindingMetadata {
  confidence: "high" | "medium" | "low";
  evidence: string[];
  affectedComponent: string;
  affectedNodeId?: string;
  findingType: DriftFindingType;
  category: string;
  title?: string;
  sourceFilePaths?: string[];
  relatedApiRoutes?: string[];
  relatedDependencies?: string[];
  confidenceReason?: string;
  [key: string]: unknown;
}

export interface DriftAnalysis {
  id: string;
  project_id: string;
  repository_id?: string | null;
  architecture_version_id: string;
  repository_analysis_id: string;
  match_score: number;
  summary: string;
  status: AnalysisStatus;
  counts?: DriftCounts;
  created_at: string;
  completed_at?: string | null;
  drift_items?: DriftItem[];
}

export interface DriftItem {
  id?: string;
  drift_analysis_id?: string;
  type: DriftItemType;
  severity: DriftSeverity;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  description: string;
  recommendation: string;
  metadata: DriftFindingMetadata;
}

export interface RepositoryAnalysisResult {
  languages: Record<string, number>;
  frameworks: string[];
  dependencies: Array<{
    name: string;
    version: string;
    ecosystem: string;
    type: DependencyType;
    metadata?: Record<string, unknown>;
  }>;
  infrastructure: Record<string, unknown>;
  architecture: {
    frontend: string[];
    backend: string[];
    services: string[];
    databases: string[];
    apis: string[];
    routes: DetectedRoute[];
    entryPoints: DetectedEntryPoint[];
    authentication: boolean;
    technologies: string[];
    externalIntegrations: string[];
  };
  metrics: Record<string, number>;
  analysisData: {
    commitSha: string;
    branch: string;
    filesAnalyzed: number;
    fileCounts: FileCounts;
    languagesBreakdown: LanguageBreakdownItem[];
    detectedFrameworks: DetectedFramework[];
    entryPoints: string[];
    entryPointDetails: DetectedEntryPoint[];
    testFiles: string[];
    testRunner: string | null;
    testCount: number;
    detectedEnvVars: string[];
    externalIntegrations: string[];
    warnings: string[];
    security: SecurityCheckResult;
    readiness: ReadinessScoreBreakdown;
    detectedFiles: string[];
  };
}