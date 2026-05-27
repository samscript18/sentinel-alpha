import dynamicImport from "next/dynamic";
import { AgentFlow } from "../components/agent-flow";
import { Hero } from "../components/hero";

export const dynamic = "force-dynamic";

const AnalysisConsole = dynamicImport(
  () => import("../components/analysis-console").then((module) => module.AnalysisConsole),
  { ssr: false }
);

export default function Page() {
  return (
    <main className="min-h-screen overflow-x-hidden px-3 py-3 text-white sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <Hero />
        <AgentFlow />
        <AnalysisConsole />
      </div>
    </main>
  );
}
