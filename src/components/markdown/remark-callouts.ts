import type { Root } from "mdast";
import { visit } from "unist-util-visit";

const CALLOUTS: Record<string, string> = {
  definition: "Определение",
  tip: "Съвет",
  warning: "Внимание",
  example: "Пример",
  remember: "Запомни",
  formula: "Формула",
  note: "Бележка",
};

type DirectiveNode = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  attributes?: Record<string, string | null | undefined>;
  children: Array<{ type: string; data?: { directiveLabel?: boolean }; children?: unknown[]; value?: string }>;
  data?: Record<string, unknown>;
};

/**
 * Превръща :::definition[Заглавие] … ::: в <div class="callout callout-definition">.
 * Непознатите директиви се връщат като обикновен текст (напр. „10:30“).
 */
export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      const n = node as unknown as DirectiveNode;
      if (n.type !== "containerDirective" && n.type !== "leafDirective" && n.type !== "textDirective") return;

      if (n.type === "containerDirective" && CALLOUTS[n.name]) {
        const labelIdx = n.children.findIndex((c) => c.data?.directiveLabel);
        let titleChildren: unknown[] = [{ type: "text", value: CALLOUTS[n.name] }];
        if (labelIdx !== -1) {
          titleChildren = (n.children[labelIdx].children as unknown[]) ?? titleChildren;
          n.children.splice(labelIdx, 1);
        }
        n.data = { hName: "div", hProperties: { className: ["callout", `callout-${n.name}`] } };
        n.children.unshift({
          type: "paragraph",
          data: { hName: "div", hProperties: { className: ["callout-title"] } } as never,
          children: titleChildren,
        } as never);
        return;
      }

      // Непозната директива → обратно в текст
      if (parent && typeof index === "number") {
        const prefix = n.type === "containerDirective" ? ":::" : n.type === "leafDirective" ? "::" : ":";
        const text = { type: "text", value: prefix + n.name };
        if (n.type === "textDirective") {
          (parent.children as unknown[]).splice(index, 1, text, ...(n.children as unknown[]));
        } else {
          (parent.children as unknown[]).splice(index, 1, { type: "paragraph", children: [text] }, ...(n.children as unknown[]));
        }
      }
    });
  };
}
