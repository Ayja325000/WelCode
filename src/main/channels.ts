export const IPC_CHANNELS = {
  defaultWorkspace: "agent:defaultWorkspace",
  settingsGet: "settings:get",
  settingsSave: "settings:save",
  sessionOpenStorageDir: "session:openStorageDir",
  sessionList: "session:list",
  sessionCreate: "session:create",
  agentRun: "agent:run",
  approvalResolve: "agent:approval:resolve",
  eventStep: "agent:event:step",
  eventRunCompleted: "agent:event:completed",
  eventApprovalRequest: "agent:event:approvalRequest"
} as const;
