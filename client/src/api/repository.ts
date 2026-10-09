import apiClient from "./client";

export interface RepositoryRecord {
  id: string;
  project_id: string;
  provider: "github" | "gitlab" | "bitbucket";
  repository_url: string;
  repository_name: string;
  owner: string;
  default_branch: string;
  access_type: "public" | "private";
  external_repository_id: string;
  credential_reference?: string;
  connected_by?: string;
  created_at: string;
  updated_at: string;
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
  extensions?: string[];
  evidence?: string[];
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
  status: "queued" | "running" | "completed" | "failed";
  frameworks: string[] | DetectedFramework[] | Record<string, unknown>;
  languages: Record<string, number>;
  dependencies: Array<{
    name: string;
    version: string;
    ecosystem: string;
    type: string;
    metadata?: Record<string, unknown>;
  }>;
  infrastructure: {
    docker?: boolean;
    dockerCompose?: boolean;
    ci?: boolean;
    kubernetes?: boolean;
    hasEnvFile?: boolean;
    [key: string]: unknown;
  };
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
    entryPoints?: string[] | DetectedEntryPoint[];
    entryPointDetails?: DetectedEntryPoint[];
    testFiles?: string[];
    testRunner?: string | null;
    testCount?: number;
    detectedEnvVars?: string[];
    detectedFrameworks?: DetectedFramework[];
    languagesBreakdown?: LanguageBreakdownItem[];
    externalIntegrations?: string[];
    warnings?: string[];
    security?: SecurityCheckResult;
    readiness?: ReadinessScoreBreakdown;
    error?: string;
    [key: string]: unknown;
  };
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ConnectRepositoryInput {
  repository_url: string;
  branch?: string;
  provider?: "github" | "gitlab" | "bitbucket";
  access_type?: "public" | "private";
  credential_reference?: string;
}

export interface RepositoryStatusResponse {
  repository: RepositoryRecord | null;
  latestAnalysis: RepositoryAnalysis | null;
  latestAttempt?: RepositoryAnalysis | null;
  latestSuccessful?: RepositoryAnalysis | null;
  activeAnalysis: RepositoryAnalysis | null;
}

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  ecosystem: string;
  risk: "low" | "medium" | "high" | "critical";
  depth: number;
  fanIn: number;
  fanOut: number;
  type?: string;
  kind?: "package" | "internal";
  isUnused?: boolean;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relationship: "depends_on" | "imports";
}

export interface DependencyGraphResponse {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularCandidates: string[][];
  unusedDependencies?: string[];
  vulnerabilityScanningConfigured: boolean;
  notice?: string;
}

export interface DriftItem {
  id?: string;
  drift_analysis_id?: string;
  type: "missing" | "extra" | "mismatch";
  severity: "low" | "medium" | "high" | "critical";
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  description: string;
  recommendation: string;
  metadata: {
    confidence: "high" | "medium" | "low";
    evidence: string[];
    affectedComponent: string;
    findingType: string;
    category: string;
  };
}

export interface DriftAnalysis {
  id: string;
  project_id: string;
  architecture_version_id: string;
  repository_analysis_id: string;
  match_score: number;
  summary: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  drift_items?: DriftItem[];
}

export interface RunDriftInput {
  architecture_version_id?: string;
}

// 1. Repository Connection & Status
export async function getRepositoryStatus(projectId: string): Promise<RepositoryStatusResponse> {
  const response = await apiClient.get<{ success: boolean; data: RepositoryStatusResponse }>(
    `/api/v1/projects/${projectId}/repository`
  );
  return response.data.data;
}

export async function connectRepository(
  projectId: string,
  input: ConnectRepositoryInput
): Promise<RepositoryRecord> {
  const response = await apiClient.post<{ success: boolean; data: RepositoryRecord }>(
    `/api/v1/projects/${projectId}/repository/connect`,
    input
  );
  return response.data.data;
}

export async function disconnectRepository(projectId: string): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${projectId}/repository`);
}

export async function triggerRepositoryAnalysis(
  projectId: string,
  branch?: string
): Promise<RepositoryAnalysis> {
  const response = await apiClient.post<{ success: boolean; data: RepositoryAnalysis }>(
    `/api/v1/projects/${projectId}/repository/analyze`,
    branch ? { branch } : {}
  );
  return response.data.data;
}

export async function getRepositoryAnalyses(projectId: string): Promise<RepositoryAnalysis[]> {
  const response = await apiClient.get<{ success: boolean; data: RepositoryAnalysis[] }>(
    `/api/v1/projects/${projectId}/repository/analyses`
  );
  return response.data.data;
}

export async function getLatestAnalysis(projectId: string): Promise<RepositoryAnalysis | null> {
  const response = await apiClient.get<{ success: boolean; data: RepositoryAnalysis | null }>(
    `/api/v1/projects/${projectId}/repository/analysis/latest`
  );
  return response.data.data;
}

// 2. Dependencies
export async function getDependencies(
  projectId: string,
  filters?: { type?: string; risk?: string; ecosystem?: string }
): Promise<DependencyGraphResponse> {
  const response = await apiClient.get<{ success: boolean; data: DependencyGraphResponse }>(
    `/api/v1/projects/${projectId}/dependencies`,
    { params: filters }
  );
  return response.data.data;
}

// 3. Architecture Drift
export async function runDriftAnalysis(
  projectId: string,
  input?: RunDriftInput
): Promise<DriftAnalysis & { items: DriftItem[] }> {
  const response = await apiClient.post<{ success: boolean; data: DriftAnalysis & { items: DriftItem[] } }>(
    `/api/v1/projects/${projectId}/drift/analyze`,
    input ?? {}
  );
  return response.data.data;
}

export async function getDriftAnalyses(projectId: string): Promise<DriftAnalysis[]> {
  const response = await apiClient.get<{ success: boolean; data: DriftAnalysis[] }>(
    `/api/v1/projects/${projectId}/drift`
  );
  return response.data.data;
}

export async function getDriftAnalysis(
  projectId: string,
  analysisId: string
): Promise<DriftAnalysis> {
  const response = await apiClient.get<{ success: boolean; data: DriftAnalysis }>(
    `/api/v1/projects/${projectId}/drift/${analysisId}`
  );
  return response.data.data;
}

export async function getDriftRemediation(
  projectId: string,
  analysisId: string
): Promise<any> {
  const response = await apiClient.post<{ success: boolean; data: any }>(
    `/api/v1/projects/${projectId}/drift/${analysisId}/remediation`
  );
  return response.data.data;
}
