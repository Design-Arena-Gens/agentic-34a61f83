import { Metadata } from "next";
import AgentWorkspace from "@/components/AgentWorkspace";

export const metadata: Metadata = {
  title: "AI Sales Agent Console",
  description:
    "বাংলাভাষী CARE মেথড ভিত্তিক AI সেলস এজেন্ট, Meta Business Suite Inbox-এর জন্য প্রস্তুত।"
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AgentWorkspace />
    </div>
  );
}
