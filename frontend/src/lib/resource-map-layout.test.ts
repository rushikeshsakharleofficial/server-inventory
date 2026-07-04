import { describe, it, expect } from "vitest";
import { apiToFlow, layoutNodes, type RmApiData } from "./resource-map-layout";

function baseResource() {
  return { id: 1, name: "srv-1", type: "server", provider: "aws", region: "us-east-1" };
}

describe("layoutNodes", () => {
  it("places root category first and increments row per category", () => {
    const nodes = [
      { id: "root", category: "compute", type: "server", label: "root" },
      { id: "n1", category: "network", type: "vpc", label: "vpc" },
      { id: "n2", category: "network", type: "subnet", label: "subnet" },
    ];
    const pos = layoutNodes(nodes, "root");

    expect(pos.get("root")).toEqual({ x: 0, y: 0 });
    expect(pos.get("n1")?.x).toBeGreaterThan(0);
    expect(pos.get("n1")?.y).not.toBe(pos.get("n2")?.y);
  });
});

describe("apiToFlow", () => {
  it("infers root id from an edge source with no matching node", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [{ id: "n1", type: "vpc", category: "network", label: "vpc" }],
      edges: [{ from: "server-1", to: "n1", label: "has vpc" }],
    };

    const { nodes } = apiToFlow(data);
    const root = nodes.find(n => n.id === "server-1");
    expect(root).toBeDefined();
    expect((root!.data as any).isRoot).toBe(true);
    expect((root!.data as any).name).toBe("srv-1");
  });

  it("falls back to the compute/server-category node as root when no synthesized root is needed", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [
        { id: "compute-1", type: "server", category: "compute", label: "compute-1" },
        { id: "n1", type: "vpc", category: "network", label: "vpc" },
      ],
      edges: [{ from: "compute-1", to: "n1" }],
    };

    const { nodes } = apiToFlow(data);
    const root = nodes.find(n => (n.data as any).isRoot);
    expect(root?.id).toBe("compute-1");
  });

  it("excludes nodes not connected by any edge", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [
        { id: "compute-1", type: "server", category: "compute", label: "compute-1" },
        { id: "n1", type: "vpc", category: "network", label: "vpc" },
        { id: "orphan", type: "tag", category: "meta", label: "orphan" },
      ],
      edges: [{ from: "compute-1", to: "n1" }],
    };

    const { nodes } = apiToFlow(data);
    expect(nodes.some(n => n.id === "orphan")).toBe(false);
  });

  it("filters edges whose endpoints aren't in the visible node set", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [
        { id: "compute-1", type: "server", category: "compute", label: "compute-1" },
        { id: "n1", type: "vpc", category: "network", label: "vpc" },
      ],
      edges: [
        { from: "compute-1", to: "n1" },
        { from: "compute-1", to: "ghost-node" },
      ],
    };

    const { edges } = apiToFlow(data);
    expect(edges).toHaveLength(1);
    expect(edges[0].target).toBe("n1");
  });

  it("derives details string from vcpu/memory/size/rules/count properties", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [
        { id: "compute-1", type: "server", category: "compute", label: "compute-1", properties: { vcpu: 4, memory_gb: 8 } },
      ],
      edges: [],
    };

    const { nodes } = apiToFlow(data);
    const node = nodes.find(n => n.id === "compute-1");
    expect((node!.data as any).details).toBe("4 vCPU · 8 GB RAM");
  });

  it("drops null/undefined/empty property values from the node's properties map", () => {
    const data: RmApiData = {
      resource: baseResource(),
      nodes: [
        { id: "compute-1", type: "server", category: "compute", label: "compute-1", properties: { os: "linux", empty: "", missing: null } },
      ],
      edges: [],
    };

    const { nodes } = apiToFlow(data);
    const props = (nodes.find(n => n.id === "compute-1")!.data as any).properties;
    expect(props).toEqual({ os: "linux" });
  });
});
