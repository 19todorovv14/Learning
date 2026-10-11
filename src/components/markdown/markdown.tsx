import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import { remarkCallouts } from "./remark-callouts";
import { cn } from "@/lib/utils";

const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: true }], remarkDirective, remarkCallouts] as const;
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }]] as const;

/** Рендерира учебен Markdown (без суров HTML — безопасно срещу XSS). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-lesson", className)}>
      <ReactMarkdown
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remarkPlugins={remarkPlugins as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={rehypePlugins as any}
        components={{
          a: ({ href, children, ...props }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Кратък inline Markdown (за въпроси и отговори в тестове). */
export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return <Markdown className={cn("max-w-none text-[15px] leading-relaxed [&>*+*]:mt-2", className)}>{children}</Markdown>;
}
