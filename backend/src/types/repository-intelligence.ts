export type RepositoryProviderName = "github" | "gitlab" | "bitbucket";
export type RepositoryAccessType = "public" | "private";
export type AnalysisStatus = "queued" | "running" | "completed" | "failed";
export type DependencyType = "runtime" | "development" | "peer" | "infrastructure";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type DriftItemType = "missing" | "extra" | "mismatch";
export type DriftSeverity = "low" | "medium" | "high" | "critical";

export interface RepositoryRecord { id: string; project_id: string; provider: RepositoryProviderName; repository_url: string; repository_name: string; owner: string; default_branch: string; access_type: RepositoryAccessType; external_repository_id: string; credential_reference?: string; connected_by: string; created_at: string; updated_at: string }
export interface RepositoryFile { path: string; content: string }
export interface RepositorySnapshot { repository: RepositoryRecord; commitSha: string; files: RepositoryFile[] }
export interface RepositoryAnalysis { id: string; repository_id: string; project_id: string; commit_sha: string; status: AnalysisStatus; frameworks: Record<string, unknown>; languages: Record<string, unknown>; dependencies: Record<string, unknown>; infrastructure: Record<string, unknown>; architecture: Record<string, unknown>; metrics: Record<string, unknown>; analysis_data: Record<string, unknown>; started_at: string | null; completed_at: string | null; created_at: string }
export interface DependencyRecord { id: string; project_id: string; repository_analysis_id: string; name: string; version: string; ecosystem: string; type: DependencyType; risk_level: RiskLevel; metadata: Record<string, unknown>; created_at: string }
export interface DependencyGraph { nodes: Array<{ id: string; name: string; version: string; ecosystem: string; risk: RiskLevel; depth: number; fanIn: number; fanOut: number }>; edges: Array<{ source: string; target: string; relationship: "depends_on" }>; circularCandidates: string[][] }
export interface DriftAnalysis { id: string; project_id: string; architecture_version_id: string; repository_analysis_id: string; match_score: number; summary: string; status: AnalysisStatus; created_at: string }
export interface DriftItem { id: string; drift_analysis_id: string; type: DriftItemType; severity: DriftSeverity; expected: Record<string, unknown>; actual: Record<string, unknown>; description: string; recommendation: string; metadata: Record<string, unknown> }
export interface RepositoryAnalysisResult { languages: Record<string, number>; frameworks: string[]; dependencies: Array<{ name: string; version: string; ecosystem: string; type: DependencyType; metadata?: Record<string, unknown> }>; infrastructure: Record<string, unknown>; architecture: Record<string, unknown>; metrics: Record<string, number>; analysisData: Record<string, unknown> }