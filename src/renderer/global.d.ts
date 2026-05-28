import type { IpcApi } from "../shared/types";

declare global {
  interface Window {
    agentApi: IpcApi;
  }
}

export {};
