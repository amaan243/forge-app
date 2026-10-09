import type {
  RepositorySnapshot,
  RepositoryAnalysisResult,
  FileCounts,
  LanguageBreakdownItem,
  DetectedFramework,
  DetectedRoute,
  DetectedEntryPoint,
  SecurityFinding,
  SecurityCheckResult,
  ReadinessFactor,
  ReadinessScoreBreakdown,
} from "../types/repository-intelligence.js";
import { isIgnoredPath } from "../integrations/github-repository-provider.js";

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  java: "Java",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "CSS",
  sass: "CSS",
  less: "CSS",
  sh: "Shell",
  bash: "Shell",
  yml: "YAML",
  yaml: "YAML",
  json: "JSON",
  toml: "TOML",
  xml: "XML",
  md: "Markdown",
};

export class RepositoryAnalyzerService {
  analyze(snapshot: RepositorySnapshot): RepositoryAnalysisResult {
    const rawFiles = snapshot.files || [];
    const totalFilesDiscovered = rawFiles.length;

    // 1. Policy & Secret Filters
    const hasEnvFile = rawFiles.some(
      (f) => /(^|\/)\.env(\.[a-zA-Z0-9_-]+)?$/i.test(f.path) && !/(^|\/)\.env\.(example|sample|template)$/i.test(f.path)
    );
    const files = rawFiles.filter((file) => !isIgnoredPath(file.path));

    const warnings: string[] = [];
    if (hasEnvFile) {
      warnings.push("Sensitive environment file detected in repository structure; contents safely excluded from analysis.");
    }

    // 2. Classify and count files
    const manifestExtensions = ["package.json", "requirements.txt", "pyproject.toml", "pom.xml", "go.mod", "cargo.toml"];
    const manifestFiles = files.filter((f) =>
      manifestExtensions.some((m) => f.path.toLowerCase() === m || f.path.toLowerCase().endsWith("/" + m))
    );

    const isCodeFile = (path: string) => {
      const lower = path.toLowerCase();
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const isManifest = manifestExtensions.some((m) => lower === m || lower.endsWith("/" + m));
      return (Boolean(EXTENSION_LANGUAGE_MAP[ext]) && ext !== "md") || isManifest;
    };

    const eligibleSourceFilesList = files.filter((f) => isCodeFile(f.path));
    const eligibleSourceFiles = eligibleSourceFilesList.length;
    const analyzedSourceFiles = eligibleSourceFilesList.filter((f) => (f.content || "").trim().length > 0).length;
    const manifestFilesProcessed = manifestFiles.length;
    const skippedFiles = totalFilesDiscovered - eligibleSourceFiles;
    const failedFiles = 0;

    const fileCounts: FileCounts = {
      totalFilesDiscovered,
      eligibleSourceFiles,
      analyzedSourceFiles,
      skippedFiles,
      failedFiles,
      manifestFilesProcessed,
    };

    // 3. Language Breakdown
    const languageFileCounts: Record<string, { count: number; extensions: Set<string>; evidence: string[] }> = {};
    for (const file of eligibleSourceFilesList) {
      const ext = file.path.split(".").pop()?.toLowerCase() || "";
      const langName = EXTENSION_LANGUAGE_MAP[ext] || ext.toUpperCase();
      if (!languageFileCounts[langName]) {
        languageFileCounts[langName] = { count: 0, extensions: new Set(), evidence: [] };
      }
      languageFileCounts[langName].count += 1;
      languageFileCounts[langName].extensions.add("." + ext);
      if (languageFileCounts[langName].evidence.length < 3) {
        languageFileCounts[langName].evidence.push(file.path);
      }
    }

    const totalCodeFiles = eligibleSourceFiles || 1;
    const languagesBreakdown: LanguageBreakdownItem[] = Object.entries(languageFileCounts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        percentage: Math.round((data.count / totalCodeFiles) * 100),
        extensions: Array.from(data.extensions),
        evidence: data.evidence,
      }))
      .sort((a, b) => b.count - a.count);

    const languages: Record<string, number> = {};
    for (const file of files) {
      const ext = file.path.split(".").pop()?.toLowerCase();
      if (ext) {
        languages[ext] = (languages[ext] || 0) + 1;
      }
    }

    // 4. Manifests & Dependency Inventory
    const dependencies: RepositoryAnalysisResult["dependencies"] = [];
    const detectedFrameworksMap = new Map<string, DetectedFramework>();
    const externalIntegrations = new Set<string>();

    for (const file of files) {
      const lower = file.path.toLowerCase();
      if (lower.endsWith("package.json")) {
        this.parsePackageJson(file.path, file.content, dependencies, detectedFrameworksMap, externalIntegrations);
      } else if (lower.endsWith("requirements.txt")) {
        this.parseRequirementsTxt(file.path, file.content, dependencies, detectedFrameworksMap, externalIntegrations);
      } else if (lower.endsWith("pyproject.toml")) {
        this.parsePyProjectToml(file.path, file.content, dependencies, detectedFrameworksMap, externalIntegrations);
      } else if (lower.endsWith("pom.xml")) {
        this.parsePomXml(file.path, file.content, dependencies, detectedFrameworksMap);
      }
    }

    // 5. Config-based Framework Detection
    for (const file of files) {
      const lower = file.path.toLowerCase();
      if (/vite\.config\.[a-z0-9]+/i.test(lower) && !detectedFrameworksMap.has("Vite")) {
        detectedFrameworksMap.set("Vite", {
          name: "Vite",
          ecosystem: "npm",
          evidenceFile: file.path,
          evidenceType: "config_file",
          confidence: "high",
          category: "tooling",
        });
      }
      if (/tailwind\.config\.[a-z0-9]+/i.test(lower) && !detectedFrameworksMap.has("Tailwind CSS")) {
        detectedFrameworksMap.set("Tailwind CSS", {
          name: "Tailwind CSS",
          ecosystem: "npm",
          evidenceFile: file.path,
          evidenceType: "config_file",
          confidence: "high",
          category: "styling",
        });
      }
      if (/next\.config\.[a-z0-9]+/i.test(lower) && !detectedFrameworksMap.has("Next.js")) {
        detectedFrameworksMap.set("Next.js", {
          name: "Next.js",
          ecosystem: "npm",
          evidenceFile: file.path,
          evidenceType: "config_file",
          confidence: "high",
          category: "frontend",
        });
      }
    }

    // 6. Infrastructure & Deployment
    const infrastructure: Record<string, unknown> = {
      docker: false,
      dockerCompose: false,
      ci: false,
      kubernetes: false,
      hasEnvFile,
    };

    for (const file of files) {
      const lower = file.path.toLowerCase();
      if (/^dockerfile(?:\.|$)/i.test(file.path) || lower.endsWith("/dockerfile")) {
        infrastructure.docker = true;
      }
      if (/docker-compose(?:\.[a-z0-9_-]+)?\.(ya?ml)$/i.test(file.path)) {
        infrastructure.dockerCompose = true;
      }
      if (file.path.startsWith(".github/workflows/")) {
        infrastructure.ci = true;
      }
      if (/(k8s|kubernetes|helm)\//i.test(file.path)) {
        infrastructure.kubernetes = true;
      }
    }

    // 7. Environment Variables Metadata (names only, values never stored)
    const detectedEnvVars = new Set<string>();
    for (const file of files) {
      if (/\.env\.(example|sample|template)$/i.test(file.path) && file.content) {
        const matches = file.content.matchAll(/^\s*([A-Z0-9_]{2,})\s*=/gm);
        for (const m of matches) detectedEnvVars.add(m[1]);
      }
      if (/\.(ts|tsx|js|jsx)$/i.test(file.path) && file.content) {
        const matches = file.content.matchAll(/process\.env\.([A-Z0-9_]{2,})/g);
        for (const m of matches) detectedEnvVars.add(m[1]);
      }
    }

    // 8. Testing Signals
    const testFiles: string[] = [];
    let detectedTestRunner: string | null = null;
    for (const file of files) {
      if (/\.(test|spec)\.(ts|tsx|js|jsx|py)$/i.test(file.path) || /(^|\/)(tests?|__tests__)\//i.test(file.path)) {
        testFiles.push(file.path);
      }
      if (/vitest\.config\./i.test(file.path)) detectedTestRunner = "Vitest";
      if (/jest\.config\./i.test(file.path)) detectedTestRunner = "Jest";
      if (/pytest\.ini$|setup\.cfg$/i.test(file.path) && file.content.includes("pytest")) detectedTestRunner = "Pytest";
    }

    if (!detectedTestRunner) {
      if (dependencies.some((d) => d.name === "vitest")) detectedTestRunner = "Vitest";
      else if (dependencies.some((d) => d.name === "jest")) detectedTestRunner = "Jest";
      else if (dependencies.some((d) => d.name === "mocha")) detectedTestRunner = "Mocha";
      else if (dependencies.some((d) => d.name === "pytest")) detectedTestRunner = "Pytest";
    }

    // 9. Entry Points Detection (Confirmed vs Probable)
    const entryPoints: DetectedEntryPoint[] = [];
    for (const file of files) {
      const content = file.content || "";
      // Express Server bootstrap
      if (/(server|app|index)\.(js|ts|mjs|cjs)$/i.test(file.path) && content.includes(".listen(")) {
        entryPoints.push({
          path: file.path,
          kind: "backend_server",
          evidence: "Express server bootstrap with .listen()",
          confidence: "confirmed",
        });
      }
      // React frontend entry point
      if (/(main|index)\.(jsx|tsx|js|ts)$/i.test(file.path) && (content.includes("createRoot") || content.includes("ReactDOM.render"))) {
        entryPoints.push({
          path: file.path,
          kind: "frontend_app",
          evidence: "React DOM bootstrap (createRoot)",
          confidence: "confirmed",
        });
      }
      // FastAPI / Python service
      if (/\.py$/i.test(file.path) && (content.includes("FastAPI(") || content.includes("Flask("))) {
        entryPoints.push({
          path: file.path,
          kind: "ml_service",
          evidence: "FastAPI / Python application instance declaration",
          confidence: "confirmed",
        });
      }
    }

    // 10. Route Discovery & Mounted Express Router Resolution
    const routes = this.discoverRoutes(files);

    // 11. Security Checks & Findings
    const security = this.runStaticSecurityChecks(files, rawFiles);

    // 12. Architecture Readiness Score (Deterministic & Documented 6-Factor Model)
    const readiness = this.calculateReadinessScore({
      entryPoints,
      routes,
      manifestsProcessed: manifestFilesProcessed,
      dependenciesCount: dependencies.length,
      databaseCount: dependencies.filter((d) =>
        /mongodb|mongoose|postgres|mysql|sqlite|redis|prisma/i.test(d.name)
      ).length,
      envVarsCount: detectedEnvVars.size,
      testCount: testFiles.length,
      testRunner: detectedTestRunner,
    });

    const detectedFrameworksList = Array.from(detectedFrameworksMap.values());
    const frameworkNames = detectedFrameworksList.map((f) => f.name);

    const databases = dependencies
      .filter((d) => /postgres|mysql|mongodb|redis|prisma|typeorm|sequelize|sqlalchemy|mongoose|sqlite/i.test(d.name))
      .map((d) => d.name);

    const source = files.filter((f) => /\.(ts|tsx|js|jsx|py|java|go)$/.test(f.path));
    const services = source
      .filter((f) => /(service|worker|handler|manager|use-case|controller)/i.test(f.path))
      .map((f) => f.path);

    const apiFiles = source.filter((f) => /(route|controller|api|server|endpoint|main|app)/i.test(f.path));
    const apis = apiFiles.map((f) => f.path);

    const architecture = {
      frontend: source.filter((f) => /(components|pages|app\/|views|client)/i.test(f.path)).map((f) => f.path),
      backend: source.filter((f) => /(server|controller|route|api|backend)/i.test(f.path)).map((f) => f.path),
      services,
      databases,
      apis,
      routes,
      entryPoints,
      authentication: dependencies.some((d) => /auth|passport|jsonwebtoken|bcrypt|supabase|clerk|lucia/i.test(d.name)) || routes.some((r) => /auth|login|signup|register/i.test(r.path)),
      technologies: frameworkNames,
      externalIntegrations: Array.from(externalIntegrations),
    };

    const metrics = {
      fileCount: totalFilesDiscovered,
      dependencyCount: dependencies.length,
      serviceCount: services.length,
      apiCount: routes.length,
      databaseCount: databases.length,
      routeCount: routes.length,
      entryPointCount: entryPoints.length,
      testCount: testFiles.length,
      infrastructureComplexity: Object.values(infrastructure).filter(Boolean).length,
    };

    return {
      languages,
      frameworks: frameworkNames,
      dependencies,
      infrastructure,
      architecture,
      metrics,
      analysisData: {
        commitSha: snapshot.commitSha,
        branch: snapshot.repository?.default_branch || "main",
        filesAnalyzed: files.length,
        fileCounts,
        languagesBreakdown,
        detectedFrameworks: detectedFrameworksList,
        entryPoints: entryPoints.map((ep) => ep.path),
        entryPointDetails: entryPoints,
        testFiles: testFiles.slice(0, 20),
        testRunner: detectedTestRunner,
        testCount: testFiles.length,
        detectedEnvVars: Array.from(detectedEnvVars),
        externalIntegrations: Array.from(externalIntegrations),
        warnings,
        security,
        readiness,
        detectedFiles: files
          .map((f) => f.path)
          .filter((p) =>
            /(package\.json|requirements|pyproject|pom\.xml|Dockerfile|docker-compose|vite\.config|tailwind\.config)/i.test(p)
          ),
      },
    };
  }

  private discoverRoutes(files: RepositorySnapshot["files"]): DetectedRoute[] {
    const routesMap = new Map<string, DetectedRoute>();

    // Step A: Find router mounts in Express server files
    // Maps router file path (e.g. 'server/routes/userRoutes.js') to mount prefix (e.g. '/api/users')
    const fileMountPrefixes = new Map<string, string>();

    // Step A1: Inspect server/app files that import router files and mount them via app.use(...)
    const serverFiles = files.filter(
      (f) => /(^|\/)(server|app|index|main)\.(js|ts|mjs|cjs)$/i.test(f.path) && f.content
    );

    for (const serverFile of serverFiles) {
      const content = serverFile.content;
      const serverDir = serverFile.path.includes("/")
        ? serverFile.path.slice(0, serverFile.path.lastIndexOf("/"))
        : "";

      // Match import statements: import userRouter from './routes/userRoutes.js';
      const importMatches = content.matchAll(
        /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g
      );
      const varToFileMap = new Map<string, string>();
      for (const m of importMatches) {
        const varName = m[1];
        let importPath = m[2];
        if (importPath.startsWith(".")) {
          // Normalize relative path
          importPath = this.resolveRelativePath(serverDir, importPath);
          varToFileMap.set(varName, importPath);
        }
      }

      // Match require statements: const userRouter = require('./routes/userRoutes');
      const requireMatches = content.matchAll(
        /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g
      );
      for (const m of requireMatches) {
        const varName = m[1];
        let reqPath = m[2];
        if (reqPath.startsWith(".")) {
          reqPath = this.resolveRelativePath(serverDir, reqPath);
          varToFileMap.set(varName, reqPath);
        }
      }

      // Match app.use('/prefix', routerVar)
      const mountMatches = content.matchAll(
        /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g
      );
      for (const m of mountMatches) {
        const mountPrefix = m[1];
        const routerVar = m[2];
        const targetPath = varToFileMap.get(routerVar);
        if (targetPath) {
          // Look for matching file in repository files
          const matchedFile = files.find(
            (f) =>
              f.path === targetPath ||
              f.path === targetPath + ".js" ||
              f.path === targetPath + ".ts" ||
              f.path.replace(/\.[^/.]+$/, "") === targetPath.replace(/\.[^/.]+$/, "")
          );
          if (matchedFile) {
            fileMountPrefixes.set(matchedFile.path, mountPrefix);
          }
        }
      }

      // Direct app routes in server file (e.g. app.get('/', ...))
      this.extractExpressRoutesFromFile(serverFile, "", routesMap, "direct_app_route");
    }

    // Step B: Inspect all router / controller / api files
    for (const file of files) {
      if (!file.content) continue;
      // Skip server files handled in Step A
      if (serverFiles.some((sf) => sf.path === file.path)) continue;

      const isRouteFile =
        /(^|\/)(routes?|routers?|controllers?|apis?|endpoints?)\//i.test(file.path) ||
        /(route|routes|router|routers|controller)\.[a-z0-9]+$/i.test(file.path);

      if (isRouteFile && /\.(js|ts|mjs|cjs|jsx|tsx)$/i.test(file.path)) {
        const mountPrefix = fileMountPrefixes.get(file.path) || "";
        this.extractExpressRoutesFromFile(
          file,
          mountPrefix,
          routesMap,
          mountPrefix ? "mounted_router" : "direct_app_route"
        );
      }

      // Python / FastAPI routes
      if (/\.py$/i.test(file.path)) {
        this.extractFastAPIRoutesFromFile(file, routesMap);
      }
    }

    return Array.from(routesMap.values());
  }

  private resolveRelativePath(baseDir: string, relative: string): string {
    const parts = (baseDir ? baseDir.split("/") : []).concat(relative.split("/"));
    const resolved: string[] = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    return resolved.join("/");
  }

  private parseRouteArgs(line: string, startIndex: number): string[] {
    let depth = 0;
    let current = "";
    const args: string[] = [];

    for (let i = startIndex; i < line.length; i++) {
      const char = line[i];
      if (char === "(" || char === "[" || char === "{") {
        depth++;
        current += char;
      } else if (char === ")" || char === "]" || char === "}") {
        if (depth === 0) {
          if (current.trim()) args.push(current.trim());
          break;
        }
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        if (current.trim()) args.push(current.trim());
        current = "";
      } else if (char === ";" && depth === 0) {
        if (current.trim()) args.push(current.trim());
        break;
      } else {
        current += char;
      }
    }
    return args;
  }

  private extractExpressRoutesFromFile(
    file: { path: string; content: string },
    mountPrefix: string,
    routesMap: Map<string, DetectedRoute>,
    defaultBasis: "mounted_router" | "direct_app_route"
  ): void {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match (router|app|aiRouter|userRouter|etc).(get|post|put|delete|patch)('path'
      const regex = /(?:[A-Za-z0-9_]+)?\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/gi;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const routeDeclaredPath = match[2];

        // Find arguments starting after the path
        const matchEndIndex = regex.lastIndex;
        const afterMatch = line.slice(matchEndIndex);
        const commaOffset = afterMatch.indexOf(",");

        let handler: string | undefined = undefined;
        let middleware: string[] | undefined = undefined;

        if (commaOffset !== -1) {
          const args = this.parseRouteArgs(line, matchEndIndex + commaOffset + 1);
          if (args.length > 0) {
            handler = args[args.length - 1];
            if (args.length > 1) {
              middleware = args.slice(0, -1);
            }
          }
        }

        // Resolve path with mountPrefix
        let resolvedPath = routeDeclaredPath;
        if (mountPrefix) {
          const cleanPrefix = mountPrefix.endsWith("/") ? mountPrefix.slice(0, -1) : mountPrefix;
          const cleanRoute = routeDeclaredPath.startsWith("/") ? routeDeclaredPath : "/" + routeDeclaredPath;
          resolvedPath = cleanRoute === "/" ? cleanPrefix : cleanPrefix + cleanRoute;
        }

        const dedupeKey = `Express:${method}:${resolvedPath}:${file.path}`;
        if (!routesMap.has(dedupeKey)) {
          routesMap.set(dedupeKey, {
            method,
            path: resolvedPath,
            framework: "Express",
            file: file.path,
            line: i + 1,
            handler: handler && handler.length < 50 ? handler : undefined,
            middleware: middleware && middleware.length > 0 ? middleware : undefined,
            confidence: mountPrefix ? "high" : "high",
            detectionBasis: defaultBasis,
          });
        }
      }
    }
  }

  private extractFastAPIRoutesFromFile(
    file: { path: string; content: string },
    routesMap: Map<string, DetectedRoute>
  ): void {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match @app.post("/predict") or @router.get("/...")
      const decoratorMatch = /@(?:app|router)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/i.exec(line);
      if (decoratorMatch) {
        const method = decoratorMatch[1].toUpperCase();
        const path = decoratorMatch[2];

        // Next line usually has def function_name(...)
        let handler: string | undefined = undefined;
        if (i + 1 < lines.length) {
          const defMatch = /def\s+([A-Za-z0-9_]+)\s*\(/.exec(lines[i + 1]);
          if (defMatch) handler = defMatch[1];
        }

        const dedupeKey = `FastAPI:${method}:${path}:${file.path}`;
        if (!routesMap.has(dedupeKey)) {
          routesMap.set(dedupeKey, {
            method,
            path,
            framework: "FastAPI",
            file: file.path,
            line: i + 1,
            handler,
            confidence: "high",
            detectionBasis: "decorator",
          });
        }
      }
    }
  }

  private runStaticSecurityChecks(
    files: RepositorySnapshot["files"],
    rawFiles: RepositorySnapshot["files"]
  ): SecurityCheckResult {
    const findings: SecurityFinding[] = [];
    const checksExecuted = [
      "Hardcoded secret & credential pattern scan",
      "Sensitive environment file detection",
      "Permissive CORS configuration scan",
      "Insecure transport & endpoint scan",
    ];

    // 1. Sensitive environment files in tree
    for (const f of rawFiles) {
      if (/(^|\/)\.env(\.[a-zA-Z0-9_-]+)?$/i.test(f.path) && !/(^|\/)\.env\.(example|sample|template)$/i.test(f.path)) {
        findings.push({
          rule: "SENSITIVE_ENV_FILE",
          severity: "high",
          file: f.path,
          message: "Real environment file detected in repository tree. Contents were safely excluded from analysis.",
        });
      }
    }

    // 2. Scan source files for hardcoded secrets, wildcard CORS, and insecure configs
    for (const file of files) {
      if (!file.content) continue;
      const lines = file.content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // AWS Access Key Pattern
        if (/AKIA[0-9A-Z]{16}/.test(line)) {
          findings.push({
            rule: "HARDCODED_AWS_KEY",
            severity: "critical",
            file: file.path,
            line: i + 1,
            message: "Detected potential hardcoded AWS Access Key ID. Secrets must be loaded via environment variables.",
            snippet: "AKIA***REDACTED***",
          });
        }

        // RSA Private Key Header
        if (/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(line)) {
          findings.push({
            rule: "HARDCODED_PRIVATE_KEY",
            severity: "critical",
            file: file.path,
            line: i + 1,
            message: "Detected private key certificate header in source file. Keys must not be committed to source control.",
            snippet: "-----BEGIN ***REDACTED***",
          });
        }

        // Permissive CORS wildcard check
        if (/app\.use\(\s*cors\(\s*\)\s*\)/.test(line)) {
          findings.push({
            rule: "PERMISSIVE_CORS_WILDCARD",
            severity: "medium",
            file: file.path,
            line: i + 1,
            message: "Permissive CORS configuration detected: cors() without origin restriction allows all origins.",
            snippet: "app.use(cors())",
          });
        }
      }
    }

    return {
      checksExecuted,
      filesScanned: files.length,
      findings,
      externalScanningConfigured: false,
      advisory:
        "External vulnerability scanning (CVE / Dependabot) is not configured. Static analysis scanned repository files for common architectural and static security risks.",
    };
  }

  private calculateReadinessScore(params: {
    entryPoints: DetectedEntryPoint[];
    routes: DetectedRoute[];
    manifestsProcessed: number;
    dependenciesCount: number;
    databaseCount: number;
    envVarsCount: number;
    testCount: number;
    testRunner: string | null;
  }): ReadinessScoreBreakdown {
    const factors: ReadinessFactor[] = [];

    // Factor 1: Entry Points (max 15)
    const confirmedCount = params.entryPoints.filter((e) => e.confidence === "confirmed").length;
    let entryPointsPts = confirmedCount >= 2 ? 15 : confirmedCount === 1 ? 12 : 5;
    factors.push({
      name: "Entry Points & Bootstrapping",
      points: entryPointsPts,
      maxPoints: 15,
      status: entryPointsPts >= 12 ? "pass" : "partial",
      description:
        confirmedCount >= 2
          ? "Confirmed both backend server and client bootstrap entry points."
          : confirmedCount === 1
            ? "Confirmed primary server entry point."
            : "Probable application entry point identified.",
    });

    // Factor 2: API Endpoints & Routes (max 20)
    let routePts = params.routes.length >= 10 ? 20 : params.routes.length > 0 ? 15 : 0;
    factors.push({
      name: "API Endpoints & Route Resolution",
      points: routePts,
      maxPoints: 20,
      status: routePts >= 15 ? "pass" : "fail",
      description:
        params.routes.length > 0
          ? `Successfully resolved ${params.routes.length} unique routes with HTTP methods and source lines.`
          : "No explicit API route declarations detected.",
    });

    // Factor 3: Manifests & Dependency Management (max 20)
    let manifestPts = params.manifestsProcessed >= 2 && params.dependenciesCount >= 10 ? 20 : params.manifestsProcessed >= 1 ? 15 : 0;
    factors.push({
      name: "Manifests & Dependency Management",
      points: manifestPts,
      maxPoints: 20,
      status: manifestPts >= 15 ? "pass" : "fail",
      description: `Processed ${params.manifestsProcessed} package manifests with ${params.dependenciesCount} dependencies inventoried.`,
    });

    // Factor 4: Data Layer & Persistence (max 15)
    let dbPts = params.databaseCount > 0 ? 15 : 0;
    factors.push({
      name: "Data Layer & Persistence",
      points: dbPts,
      maxPoints: 15,
      status: dbPts > 0 ? "pass" : "partial",
      description:
        dbPts > 0
          ? "Database integration detected (MongoDB / Mongoose / PostgreSQL / ORM)."
          : "No primary database client library identified.",
    });

    // Factor 5: Configuration & Environment (max 15)
    let configPts = params.envVarsCount >= 3 ? 15 : params.envVarsCount > 0 ? 10 : 5;
    factors.push({
      name: "Configuration & Environment",
      points: configPts,
      maxPoints: 15,
      status: configPts >= 10 ? "pass" : "partial",
      description: `Identified ${params.envVarsCount} environment variable references with secret redaction preserved.`,
    });

    // Factor 6: Automated Testing Suite (max 15)
    let testPts = params.testCount > 0 ? 15 : 0;
    factors.push({
      name: "Automated Testing Suite",
      points: testPts,
      maxPoints: 15,
      status: testPts > 0 ? "pass" : "fail",
      description:
        testPts > 0
          ? `Found ${params.testCount} test suites with ${params.testRunner || "test runner"} configured.`
          : "No automated unit or integration test files detected in repository tree.",
    });

    const totalScore = factors.reduce((sum, f) => sum + f.points, 0);
    const rating = totalScore >= 80 ? "Production Ready" : totalScore >= 60 ? "Standard Architecture" : "Incomplete Architecture";

    return {
      score: totalScore,
      rating,
      factors,
    };
  }

  private parsePackageJson(
    filePath: string,
    content: string,
    dependencies: RepositoryAnalysisResult["dependencies"],
    frameworksMap: Map<string, DetectedFramework>,
    externalIntegrations: Set<string>
  ): void {
    try {
      if (!content.trim()) return;
      const pkg = JSON.parse(content) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };

      const direct = Object.keys({ ...pkg.dependencies });
      const dev = Object.keys({ ...pkg.devDependencies });

      if (pkg.name) {
        dependencies.push({
          name: pkg.name,
          version: "workspace",
          ecosystem: "npm",
          type: "infrastructure",
          metadata: { dependencies: [...direct, ...dev] },
        });
      }

      const sections = [
        ["runtime", pkg.dependencies],
        ["development", pkg.devDependencies],
        ["peer", pkg.peerDependencies],
      ] as const;

      for (const [type, values] of sections) {
        for (const [name, version] of Object.entries(values ?? {})) {
          dependencies.push({ name, version, ecosystem: "npm", type, metadata: {} });

          // Framework mapping
          if (["react", "react-dom"].includes(name) && !frameworksMap.has("React")) {
            frameworksMap.set("React", {
              name: "React",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "frontend",
            });
          }
          if (["express", "@expressjs/express"].includes(name) && !frameworksMap.has("Express")) {
            frameworksMap.set("Express", {
              name: "Express",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "backend",
            });
          }
          if (["vite"].includes(name) && !frameworksMap.has("Vite")) {
            frameworksMap.set("Vite", {
              name: "Vite",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "tooling",
            });
          }
          if (["tailwindcss"].includes(name) && !frameworksMap.has("Tailwind CSS")) {
            frameworksMap.set("Tailwind CSS", {
              name: "Tailwind CSS",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "styling",
            });
          }
          if (["mongoose", "mongodb"].includes(name) && !frameworksMap.has("MongoDB")) {
            frameworksMap.set("MongoDB", {
              name: "MongoDB",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "database",
            });
          }
          if (["pg", "@supabase/supabase-js", "postgres"].includes(name) && !frameworksMap.has("PostgreSQL")) {
            frameworksMap.set("PostgreSQL", {
              name: "PostgreSQL",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "database",
            });
          }
          if (["prisma", "@prisma/client"].includes(name) && !frameworksMap.has("Prisma")) {
            frameworksMap.set("Prisma", {
              name: "Prisma",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "database",
            });
          }
          if (["redis", "ioredis"].includes(name) && !frameworksMap.has("Redis")) {
            frameworksMap.set("Redis", {
              name: "Redis",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "database",
            });
          }
          if (["@nestjs/core"].includes(name) && !frameworksMap.has("NestJS")) {
            frameworksMap.set("NestJS", {
              name: "NestJS",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "backend",
            });
          }
          if (["next"].includes(name) && !frameworksMap.has("Next.js")) {
            frameworksMap.set("Next.js", {
              name: "Next.js",
              ecosystem: "npm",
              version,
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "frontend",
            });
          }

          // External Integrations
          if (name.includes("stripe")) externalIntegrations.add("Stripe");
          if (name.includes("sendgrid")) externalIntegrations.add("SendGrid");
          if (name.includes("twilio")) externalIntegrations.add("Twilio");
          if (name.includes("openai")) externalIntegrations.add("OpenAI");
          if (name.includes("supabase")) externalIntegrations.add("Supabase");
        }
      }
    } catch {
      // Handled malformed manifests
    }
  }

  private parseRequirementsTxt(
    filePath: string,
    content: string,
    dependencies: RepositoryAnalysisResult["dependencies"],
    frameworksMap: Map<string, DetectedFramework>,
    externalIntegrations: Set<string>
  ): void {
    if (!content.trim()) return;

    if (!frameworksMap.has("Python")) {
      frameworksMap.set("Python", {
        name: "Python",
        ecosystem: "pip",
        version: ">=3.9",
        evidenceFile: filePath,
        evidenceType: "manifest_dependency",
        confidence: "high",
        category: "other",
      });
    }

    const lines = content.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("-")) continue;
      const match = /^([a-zA-Z0-9_.-]+)(?:([<>=~!]=?)(.+))?/.exec(line);
      if (match) {
        const name = match[1].toLowerCase();
        const version = match[3] ?? "latest";
        dependencies.push({ name, version, ecosystem: "pip", type: "runtime", metadata: {} });

        if (["fastapi"].includes(name) && !frameworksMap.has("FastAPI")) {
          frameworksMap.set("FastAPI", {
            name: "FastAPI",
            ecosystem: "pip",
            version,
            evidenceFile: filePath,
            evidenceType: "manifest_dependency",
            confidence: "high",
            category: "backend",
          });
        }
        if (["flask"].includes(name) && !frameworksMap.has("Flask")) {
          frameworksMap.set("Flask", {
            name: "Flask",
            ecosystem: "pip",
            version,
            evidenceFile: filePath,
            evidenceType: "manifest_dependency",
            confidence: "high",
            category: "backend",
          });
        }
        if (["django"].includes(name) && !frameworksMap.has("Django")) {
          frameworksMap.set("Django", {
            name: "Django",
            ecosystem: "pip",
            version,
            evidenceFile: filePath,
            evidenceType: "manifest_dependency",
            confidence: "high",
            category: "backend",
          });
        }
        if (["openai"].includes(name)) externalIntegrations.add("OpenAI");
        if (["boto3"].includes(name)) externalIntegrations.add("AWS");
      }
    }
  }

  private parsePyProjectToml(
    filePath: string,
    content: string,
    dependencies: RepositoryAnalysisResult["dependencies"],
    frameworksMap: Map<string, DetectedFramework>,
    externalIntegrations: Set<string>
  ): void {
    if (!content.trim()) return;
    if (!frameworksMap.has("Python")) {
      frameworksMap.set("Python", {
        name: "Python",
        ecosystem: "pip",
        evidenceFile: filePath,
        evidenceType: "manifest_dependency",
        confidence: "high",
        category: "other",
      });
    }
    const lines = content.split("\n");
    let inDepsSection = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("[") && line.endsWith("]")) {
        inDepsSection = /dependencies/i.test(line);
        continue;
      }
      if (inDepsSection && line && !line.startsWith("#")) {
        const match = /^([a-zA-Z0-9_.-]+)\s*=\s*["']([^"']+)["']/.exec(line);
        if (match) {
          const name = match[1].toLowerCase();
          dependencies.push({ name, version: match[2], ecosystem: "pip", type: "runtime", metadata: {} });
          if (["fastapi"].includes(name) && !frameworksMap.has("FastAPI")) {
            frameworksMap.set("FastAPI", {
              name: "FastAPI",
              ecosystem: "pip",
              version: match[2],
              evidenceFile: filePath,
              evidenceType: "manifest_dependency",
              confidence: "high",
              category: "backend",
            });
          }
          if (["openai"].includes(name)) externalIntegrations.add("OpenAI");
        }
      }
    }
  }

  private parsePomXml(
    filePath: string,
    content: string,
    dependencies: RepositoryAnalysisResult["dependencies"],
    frameworksMap: Map<string, DetectedFramework>
  ): void {
    if (!content.trim()) return;
    if (!frameworksMap.has("Java")) {
      frameworksMap.set("Java", {
        name: "Java",
        ecosystem: "maven",
        evidenceFile: filePath,
        evidenceType: "manifest_dependency",
        confidence: "high",
        category: "other",
      });
    }
    const blocks = content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g);
    for (const b of blocks) {
      const blockText = b[1];
      const groupId = /<groupId>(.*?)<\/groupId>/i.exec(blockText)?.[1]?.trim();
      const artifactId = /<artifactId>(.*?)<\/artifactId>/i.exec(blockText)?.[1]?.trim();
      const version = /<version>(.*?)<\/version>/i.exec(blockText)?.[1]?.trim() || "managed";
      if (artifactId) {
        const fullName = groupId ? `${groupId}:${artifactId}` : artifactId;
        dependencies.push({ name: fullName, version, ecosystem: "maven", type: "runtime", metadata: {} });
        if (artifactId.includes("spring-boot") || (groupId && groupId.includes("springframework.boot"))) {
          frameworksMap.set("Spring Boot", {
            name: "Spring Boot",
            ecosystem: "maven",
            version,
            evidenceFile: filePath,
            evidenceType: "manifest_dependency",
            confidence: "high",
            category: "backend",
          });
        }
      }
    }
  }
}