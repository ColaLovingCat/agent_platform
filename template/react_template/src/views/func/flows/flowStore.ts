import { nanoid } from "nanoid";

import type { Flow, FlowType, TriggerType } from "@/components/workflow/lib/types";
import { makeStarterFlow } from "@/components/workflow/lib/types";

import seedFile from "./datas.json";

const STORAGE_KEY = "react_template:flows";

type FlowListPayload = { data: Flow[] };

function seedFlows(): Flow[] {
  const fromFile = (seedFile as FlowListPayload).data ?? [];
  if (fromFile.length > 0) return fromFile;
  return [
    makeStarterFlow("flow_demo_chat", "Demo Chat Assistant", "chat", "react"),
    makeStarterFlow("flow_demo_dag", "Demo DAG Pipeline", "manual", "dag"),
  ];
}

function readStorage(): Flow[] {
  if (typeof window === "undefined") return seedFlows();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FlowListPayload;
      if (Array.isArray(parsed.data) && parsed.data.length > 0) {
        return parsed.data;
      }
    }
  } catch {
    /* fall through to seed */
  }
  const initial = seedFlows();
  writeStorage(initial);
  return initial;
}

function writeStorage(flows: Flow[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: flows }));
}

export function listFlows(): Flow[] {
  return readStorage();
}

export function getFlow(id: string): Flow | null {
  return readStorage().find((f) => f.id === id) ?? null;
}

export function createFlow(input: {
  name: string;
  description?: string;
  flowType: FlowType;
  triggerType: TriggerType;
}): Flow {
  const id = `flow_${nanoid(8)}`;
  const flow = makeStarterFlow(id, input.name.trim(), input.triggerType, input.flowType);
  if (input.description?.trim()) {
    flow.description = input.description.trim();
  }
  const now = new Date().toISOString();
  flow.createdAt = now;
  flow.updatedAt = now;

  const flows = readStorage();
  flows.unshift(flow);
  writeStorage(flows);
  return flow;
}

export function updateFlow(id: string, patch: Partial<Flow>): Flow {
  const flows = readStorage();
  const idx = flows.findIndex((f) => f.id === id);
  if (idx < 0) throw new Error(`Flow not found: ${id}`);

  const now = new Date().toISOString();
  const updated: Flow = {
    ...flows[idx],
    ...patch,
    id: flows[idx].id,
    updatedAt: now,
  };
  flows[idx] = updated;
  writeStorage(flows);
  return updated;
}

export function deleteFlow(id: string): void {
  const flows = readStorage().filter((f) => f.id !== id);
  writeStorage(flows);
}

export function resetFlowsFromSeed(): Flow[] {
  const initial = seedFlows();
  writeStorage(initial);
  return initial;
}
