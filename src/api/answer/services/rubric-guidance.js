"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_RUBRIC_DIR = path.join(process.cwd(), "criterias", "criteria");
const RUBRIC_DIR = process.env.RUBRIC_JSON_DIR
  ? path.resolve(process.cwd(), process.env.RUBRIC_JSON_DIR)
  : DEFAULT_RUBRIC_DIR;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const SUBJECT_ALLOWLIST = new Set(
  String(process.env.RUBRIC_GUIDED_EVALUATION_SUBJECTS || "")
    .split(",")
    .map((value) => normalizeKey(value))
    .filter(Boolean)
);

const SUBJECT_RULES = [
  { fileName: "economics.json", matches: (subject) => subject.includes("economics") },
  { fileName: "psychology.json", matches: (subject) => subject.includes("psychology") },
  {
    fileName: "english-lang-lit.json",
    matches: (subject) => subject.includes("english") && (subject.includes("lang") || subject.includes("lit") || subject.includes("literature")),
  },
  { fileName: "tok-essay.json", matches: (subject) => subject.includes("tok") || subject.includes("theoryofknowledge") },
  { fileName: "ee.json", matches: (subject) => subject === "ee" || subject.includes("extendedessay") },
  { fileName: "cs.json", matches: (subject) => subject === "cs" || subject.includes("computerscience") },
  {
    fileName: "ess.json",
    matches: (subject) => subject === "ess" || subject.includes("environmentalsystemsandsocieties") || subject.includes("environmentalsystems"),
  },
  { fileName: "maths.json", matches: (subject) => subject.includes("maths") || subject.includes("mathematics") || subject.includes("math") },
  { fileName: "business-mgmt.json", matches: (subject) => subject.includes("businessmgmt") || subject.includes("businessmanagement") },
  { fileName: "global-politics.json", matches: (subject) => subject.includes("globalpolitics") },
  { fileName: "sciences-2025.json", matches: (subject) => subject.includes("science") || subject.includes("sciences2025") },
];

let rubricCatalogCache = null;

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isRubricGuidedEvaluationEnabled() {
  return TRUE_VALUES.has(String(process.env.ENABLE_RUBRIC_GUIDED_EVALUATION || "").toLowerCase());
}

function isSubjectEnabled(subjectName) {
  if (!isRubricGuidedEvaluationEnabled()) return false;
  if (SUBJECT_ALLOWLIST.size === 0) return false;

  const normalizedSubject = normalizeKey(subjectName);
  if (!normalizedSubject) return false;

  return SUBJECT_ALLOWLIST.has(normalizedSubject);
}

function readJsonFile(filePath) {
  const rawText = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(rawText);
  return { parsed, rawText };
}

function loadRubricCatalog() {
  if (rubricCatalogCache) return rubricCatalogCache;

  const catalog = [];
  const seenFiles = new Set();
  const directories = [RUBRIC_DIR, path.join(process.cwd(), "criterias")];

  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;

    const stat = fs.statSync(directory);
    if (!stat.isDirectory()) continue;

    const stack = [directory];
    while (stack.length > 0) {
      const currentDirectory = stack.pop();
      const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          stack.push(entryPath);
          continue;
        }

        if (!entry.name.toLowerCase().endsWith(".json")) continue;
        const normalizedPath = path.resolve(entryPath);
        if (seenFiles.has(normalizedPath)) continue;

        seenFiles.add(normalizedPath);

        try {
          const { parsed, rawText } = readJsonFile(normalizedPath);
          catalog.push({
            fileName: entry.name,
            filePath: normalizedPath,
            slug: normalizeKey(path.basename(entry.name, ".json")),
            rawRubric: parsed,
            rawText,
            hash: crypto.createHash("sha256").update(rawText).digest("hex"),
          });
        } catch (error) {
          catalog.push({
            fileName: entry.name,
            filePath: normalizedPath,
            slug: normalizeKey(path.basename(entry.name, ".json")),
            rawRubric: null,
            rawText: null,
            hash: null,
            error: error.message,
          });
        }
      }
    }
  }

  rubricCatalogCache = catalog;
  return catalog;
}

function validateDescriptorRanges(descriptors, maxMarks) {
  if (descriptors === undefined || descriptors === null) {
    return { valid: true, errors: [] };
  }

  if (!descriptors || typeof descriptors !== "object" || Array.isArray(descriptors)) {
    return { valid: false, errors: ["Criterion descriptors must be an object."] };
  }

  const errors = [];
  const validatedKeys = new Set();

  for (const [rangeKey, description] of Object.entries(descriptors)) {
    if (!rangeKey || typeof rangeKey !== "string") {
      errors.push("Criterion descriptor ranges must be non-empty strings.");
      continue;
    }

    const rangeMatch = rangeKey.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!rangeMatch) {
      errors.push(`Invalid descriptor range: ${rangeKey}`);
      continue;
    }

    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2] ?? rangeMatch[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start > end) {
      errors.push(`Invalid descriptor range bounds: ${rangeKey}`);
      continue;
    }

    if (Number.isFinite(maxMarks) && end > maxMarks) {
      errors.push(`Descriptor range ${rangeKey} exceeds maxMarks ${maxMarks}.`);
      continue;
    }

    if (typeof description !== "string") {
      errors.push(`Descriptor text for range ${rangeKey} must be a string.`);
      continue;
    }

    validatedKeys.add(rangeKey);
  }

  return { valid: errors.length === 0, errors, keys: validatedKeys };
}

function normalizeCriterion(rawCriterion, { requireId = false } = {}) {
  if (!rawCriterion || typeof rawCriterion !== "object" || Array.isArray(rawCriterion)) {
    return { valid: false, errors: ["Each criterion must be an object."] };
  }

  const id = typeof rawCriterion.id === "string" ? rawCriterion.id.trim() : "";
  const name = typeof rawCriterion.name === "string" ? rawCriterion.name.trim() : "";
  const maxValue = Number(rawCriterion.maxMarks ?? rawCriterion.max);

  const errors = [];
  if (requireId && !id) errors.push("Criterion id is required.");
  if (!name) errors.push("Criterion name is required.");
  if (!Number.isFinite(maxValue) || maxValue < 0) errors.push(`Invalid criterion max for ${name || id || "unknown"}.`);

  const descriptorValidation = validateDescriptorRanges(rawCriterion.descriptors, maxValue);
  if (!descriptorValidation.valid) errors.push(...descriptorValidation.errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      ...(id ? { id } : {}),
      name,
      maxMarks: maxValue,
      descriptors: rawCriterion.descriptors && typeof rawCriterion.descriptors === "object" && !Array.isArray(rawCriterion.descriptors)
        ? rawCriterion.descriptors
        : undefined,
    },
  };
}

function adaptRubricToRuntimeShape(rawRubric, { requireIds = false, questionMaxMarks = null, source = "unknown" } = {}) {
  if (!rawRubric || typeof rawRubric !== "object" || Array.isArray(rawRubric)) {
    return {
      valid: false,
      errors: ["Rubric must be an object."],
      runtimeRubric: null,
      source,
      hash: null,
      snapshot: null,
    };
  }

  if (!Array.isArray(rawRubric.criteria) || rawRubric.criteria.length === 0) {
    return {
      valid: false,
      errors: ["Rubric must contain a non-empty criteria array."],
      runtimeRubric: null,
      source,
      hash: null,
      snapshot: rawRubric,
    };
  }

  const normalizedCriteria = [];
  const errors = [];
  const ids = new Set();
  const names = new Set();
  let totalMaxMarks = 0;

  for (const rawCriterion of rawRubric.criteria) {
    const normalized = normalizeCriterion(rawCriterion, { requireId: requireIds });
    if (!normalized.valid) {
      errors.push(...normalized.errors);
      continue;
    }

    const criterion = normalized.value;
    if (criterion.id) {
      if (ids.has(criterion.id)) {
        errors.push(`Duplicate criterion id: ${criterion.id}`);
        continue;
      }
      ids.add(criterion.id);
    }

    if (names.has(criterion.name)) {
      errors.push(`Duplicate criterion name: ${criterion.name}`);
      continue;
    }
    names.add(criterion.name);

    normalizedCriteria.push(criterion);
    totalMaxMarks += criterion.maxMarks;
  }

  if (normalizedCriteria.length === 0) {
    return {
      valid: false,
      errors: errors.length > 0 ? errors : ["No valid criteria found in rubric."],
      runtimeRubric: null,
      source,
      hash: null,
      snapshot: rawRubric,
    };
  }

  if (Number.isFinite(questionMaxMarks) && totalMaxMarks > questionMaxMarks) {
    errors.push(`Rubric max marks ${totalMaxMarks} exceeds question max ${questionMaxMarks}.`);
  }

  const snapshotText = JSON.stringify(rawRubric);
  const runtimeRubric = {
    criteria: normalizedCriteria,
    rubricSource: source,
  };

  return {
    valid: errors.length === 0,
    errors,
    runtimeRubric,
    source,
    hash: crypto.createHash("sha256").update(snapshotText).digest("hex"),
    snapshot: rawRubric,
    totalMaxMarks,
  };
}

function validateCriterionOutput(criterionBreakdown, rubric, questionMaxMarks = null) {
  if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  if (!criterionBreakdown || typeof criterionBreakdown !== "object" || Array.isArray(criterionBreakdown)) {
    return { valid: false, errors: ["Criterion breakdown must be an object when a rubric is active."], warnings: [] };
  }

  const rubricLookup = new Map(rubric.criteria.map((criterion) => [criterion.name, criterion]));
  const errors = [];
  const warnings = [];
  let totalMarks = 0;

  for (const [criterionName, value] of Object.entries(criterionBreakdown)) {
    const criterion = rubricLookup.get(criterionName);
    if (!criterion) {
      errors.push(`Unknown criterion output: ${criterionName}`);
      continue;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`Criterion output for ${criterionName} must be an object.`);
      continue;
    }

    const marks = Number(value.marks);
    if (!Number.isFinite(marks)) {
      errors.push(`Criterion output for ${criterionName} must contain numeric marks.`);
      continue;
    }

    if (marks < 0 || marks > Number(criterion.maxMarks)) {
      errors.push(`Criterion output for ${criterionName} exceeds maxMarks ${criterion.maxMarks}.`);
      continue;
    }

    totalMarks += marks;
  }

  if (Number.isFinite(questionMaxMarks) && totalMarks > questionMaxMarks) {
    errors.push(`Criterion total ${totalMarks} exceeds question max ${questionMaxMarks}.`);
  }

  for (const criterion of rubric.criteria) {
    if (!Object.prototype.hasOwnProperty.call(criterionBreakdown, criterion.name)) {
      warnings.push(`Missing criterion output for ${criterion.name}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function resolveSubjectRubric(subjectName) {
  const normalizedSubject = normalizeKey(subjectName);
  if (!normalizedSubject) {
    return null;
  }

  const catalog = loadRubricCatalog();
  const defaultRule = SUBJECT_RULES.find((rule) => rule.matches(normalizedSubject));
  const subjectFileName = defaultRule?.fileName || null;

  const explicitMatch = subjectFileName
    ? catalog.find((entry) => entry.fileName.toLowerCase() === subjectFileName.toLowerCase())
    : null;

  if (explicitMatch?.rawRubric) {
    return adaptRubricToRuntimeShape(explicitMatch.rawRubric, {
      requireIds: true,
      source: explicitMatch.fileName,
      questionMaxMarks: null,
    });
  }

  const fallbackMatch = catalog.find((entry) => entry.slug === normalizedSubject || entry.slug.includes(normalizedSubject) || normalizedSubject.includes(entry.slug));
  if (fallbackMatch?.rawRubric) {
    return adaptRubricToRuntimeShape(fallbackMatch.rawRubric, {
      requireIds: true,
      source: fallbackMatch.fileName,
      questionMaxMarks: null,
    });
  }

  return null;
}

function getRubricEvaluationContext({ subjectName, partRubric, questionMaxMarks = null } = {}) {
  const featureEnabled = isRubricGuidedEvaluationEnabled();
  const subjectEnabled = isSubjectEnabled(subjectName);
  const partRubricContext = adaptRubricToRuntimeShape(partRubric, {
    requireIds: false,
    source: "part.rubric",
    questionMaxMarks,
  });

  const subjectRubricContext = featureEnabled && subjectEnabled
    ? resolveSubjectRubric(subjectName)
    : null;

  const selectedRubricContext = subjectRubricContext?.valid
    ? subjectRubricContext
    : (partRubricContext.valid ? partRubricContext : null);

  return {
    featureEnabled,
    subjectEnabled,
    selectedRubricContext,
    runtimeRubric: selectedRubricContext?.runtimeRubric || null,
    rubricHash: selectedRubricContext?.hash || null,
    rubricSource: selectedRubricContext?.source || null,
    rubricSnapshot: selectedRubricContext?.snapshot || null,
    validationErrors: selectedRubricContext?.errors || [],
    partRubricContext,
    subjectRubricContext,
  };
}

module.exports = {
  adaptRubricToRuntimeShape,
  getRubricEvaluationContext,
  isRubricGuidedEvaluationEnabled,
  resolveSubjectRubric,
  validateCriterionOutput,
  validateDescriptorRanges,
};