import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { apiToFlow, type RmApiData } from "@/lib/resource-map-layout";
import { FlowInner, PropsPanel } from "@/components/resource-map-view";
import { Modal } from "@/components/ui-bits";

/** Live cloud topology of one database or Kubernetes cluster. */
export function ResourceMapDialog({ kind, id, name, onClose }: Readonly<{
  kind: "database" | "kubernetes"; id: number; name: string; onClose: () => void;
}>) {
  const [active, setActive] = useState<Node | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["resource-map", kind, id],
    queryFn: () => api<RmApiData>(`/api/resource-map/${kind}/${id}`),
    retry: false,
  });
  const flow = useMemo(() => (data ? apiToFlow(data) : null), [data]);

  let body: React.ReactNode;
  if (isLoading) body = <p className="p-6 text-sm text-muted-foreground">Fetching topology…</p>;
  else if (error) body = <p className="p-6 text-sm text-red-500">{(error as Error).message}</p>;
  else if (!flow || !data?.edges.length) {
    body = <p className="p-6 text-sm text-muted-foreground">The provider returned no connected resources.</p>;
  } else {
    body = (
      <ReactFlowProvider>
        <FlowInner nodes={flow.nodes} edges={flow.edges} onNodeClick={setActive} />
      </ReactFlowProvider>
    );
  }

  return (
    <Modal onClose={onClose} className="bg-background border border-border rounded-lg p-5 w-full max-w-4xl shadow-lg">
      <div role="dialog" aria-modal="true" aria-label={`Resource map: ${name}`} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Resource map: {name}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        <div className="rounded-lg border border-border" style={{ height: 420 }}>{body}</div>
        <div className="rounded-lg border border-border overflow-auto" style={{ maxHeight: 200 }}>
          <PropsPanel node={active} />
        </div>
      </div>
    </Modal>
  );
}
