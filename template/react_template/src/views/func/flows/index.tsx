import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { FlowEditor } from "@/components/workflow/FlowEditor";
import type { Flow } from "@/components/workflow/lib/types";

import { getFlow, updateFlow } from "./flowStore";

const FlowEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const initial = useMemo(() => (id ? getFlow(id) : null), [id]);
  const [flow, setFlow] = useState<Flow | null>(initial);

  useEffect(() => {
    if (id) setFlow(getFlow(id));
  }, [id]);

  const onPersist = useCallback(
    async (body: Partial<Flow>) => {
      if (!id) throw new Error("missing flow id");
      const updated = updateFlow(id, body);
      setFlow(updated);
      return updated;
    },
    [id],
  );

  if (!id || !flow) {
    return <Navigate to="/flows" replace />;
  }

  return (
    <div className="sections sections-flow">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-slate-200 bg-white/90 text-sm">
        <Link
          to="/flows"
          className="text-brand-600 hover:text-brand-700 hover:underline"
        >
          ← Flows
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-800 truncate">{flow.name}</span>
        <span className="text-xs text-slate-400 font-mono">{flow.id}</span>
      </div>
      <div className="flex-1 min-h-0">
        <FlowEditor
          key={`${flow.id}-${flow.updatedAt}`}
          initialFlow={flow}
          onPersist={onPersist}
        />
      </div>
    </div>
  );
};

export default FlowEditPage;
