import { supabaseAdmin } from "../lib/supabase.js";
import type {
  KnowledgeGraphSnapshot,
  KnowledgeGraphEntityNode,
  KnowledgeGraphRelationship,
  KnowledgeGraphSummary,
  KnowledgeGraphCoverage,
} from "../types/knowledge-graph.js";

function mapRowToSnapshot(row: Record<string, unknown>): KnowledgeGraphSnapshot {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    architectureVersionId: row.architecture_version_id ? String(row.architecture_version_id) : null,
    repositoryId: row.repository_id ? String(row.repository_id) : null,
    repositoryAnalysisId: row.repository_analysis_id ? String(row.repository_analysis_id) : null,
    sourceHash: String(row.source_hash || ""),
    sourceContext: (row.summary as any)?.sourceContext || {},
    entities: (row.entities as KnowledgeGraphEntityNode[]) || [],
    relationships: (row.relationships as KnowledgeGraphRelationship[]) || [],
    summary: (row.summary as KnowledgeGraphSummary) || {
      totalEntities: 0,
      totalRelationships: 0,
      entityTypeCounts: {},
      relationTypeCounts: {},
      verifiedRelationsCount: 0,
      inferredRelationsCount: 0,
      uncertainRelationsCount: 0,
      staleRelationsCount: 0,
    },
    coverage: (row.coverage as KnowledgeGraphCoverage) || {
      totalRequirements: 0,
      mappedRequirementsCount: 0,
      totalComponents: 0,
      mappedComponentsCount: 0,
      totalRoutes: 0,
      testedRoutesCount: 0,
      totalModules: 0,
      documentedModulesCount: 0,
      totalDriftFindings: 0,
      linkedDriftFindingsCount: 0,
      gaps: {
        requirementsWithoutArchitecture: [],
        componentsWithoutRepository: [],
        routesWithoutTests: [],
        modulesWithoutDocumentation: [],
        staleSources: [],
      },
      overallCoveragePercentage: 0,
    },
    status: (row.status as KnowledgeGraphSnapshot["status"]) || "completed",
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const knowledgeGraphRepository = {
  async findByHash(projectId: string, sourceHash: string): Promise<KnowledgeGraphSnapshot | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("knowledge_graph_snapshots")
        .select()
        .eq("project_id", projectId)
        .eq("source_hash", sourceHash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[knowledgeGraphRepository] findByHash warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToSnapshot(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[knowledgeGraphRepository] findByHash caught error:", err);
      return null;
    }
  },

  async findLatest(projectId: string): Promise<KnowledgeGraphSnapshot | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("knowledge_graph_snapshots")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[knowledgeGraphRepository] findLatest warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToSnapshot(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[knowledgeGraphRepository] findLatest caught error:", err);
      return null;
    }
  },

  async save(
    input: Omit<KnowledgeGraphSnapshot, "id" | "createdAt" | "updatedAt">
  ): Promise<KnowledgeGraphSnapshot> {
    try {
      const { data, error } = await supabaseAdmin
        .from("knowledge_graph_snapshots")
        .insert({
          project_id: input.projectId,
          workspace_id: input.workspaceId,
          architecture_version_id: input.architectureVersionId || null,
          repository_id: input.repositoryId || null,
          repository_analysis_id: input.repositoryAnalysisId || null,
          source_hash: input.sourceHash,
          entities: input.entities,
          relationships: input.relationships,
          summary: {
            ...input.summary,
            sourceContext: input.sourceContext,
          },
          coverage: input.coverage,
          status: input.status || "completed",
          created_by: input.createdBy || null,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRowToSnapshot(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[knowledgeGraphRepository] save caught error, falling back to in-memory snapshot:", err);
      return {
        ...input,
        id: `kg-snap-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async markStale(projectId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from("knowledge_graph_snapshots")
        .update({ status: "stale" })
        .eq("project_id", projectId)
        .eq("status", "completed");
    } catch (err) {
      console.warn("[knowledgeGraphRepository] markStale caught error:", err);
    }
  },
};
