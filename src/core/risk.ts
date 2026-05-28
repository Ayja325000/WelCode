export interface RiskAssessment {
  level: "low" | "medium" | "high";
  requiresApproval: boolean;
  reason: string;
}

const HIGH_RISK_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /\brm\s+-rf\b/i, reason: "Recursive delete detected." },
  { regex: /\bdel\s+\/[sqf]/i, reason: "Windows delete command detected." },
  { regex: /\brmdir\s+\/s\b/i, reason: "Recursive directory removal detected." },
  { regex: /\bgit\s+reset\s+--hard\b/i, reason: "Destructive git reset detected." },
  { regex: /\bgit\s+clean\s+-fd/i, reason: "Destructive git clean detected." },
  { regex: /\bformat\s+[a-z]:/i, reason: "Disk formatting command detected." },
  { regex: /\bsudo\b/i, reason: "Privilege escalation attempt detected." }
];

const MEDIUM_RISK_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /\bgit\s+checkout\b/i, reason: "Branch/working tree mutation possible." },
  { regex: /\bnpm\s+install\b/i, reason: "Dependency mutation command detected." },
  { regex: /\bmove-item\b/i, reason: "File move operation detected." },
  { regex: /\bremove-item\b/i, reason: "Potential file deletion detected." }
];

export function assessCommandRisk(command: string): RiskAssessment {
  for (const entry of HIGH_RISK_PATTERNS) {
    if (entry.regex.test(command)) {
      return { level: "high", requiresApproval: true, reason: entry.reason };
    }
  }

  for (const entry of MEDIUM_RISK_PATTERNS) {
    if (entry.regex.test(command)) {
      return { level: "medium", requiresApproval: true, reason: entry.reason };
    }
  }

  return { level: "low", requiresApproval: false, reason: "No risky pattern detected." };
}
