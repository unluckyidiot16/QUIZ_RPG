// apps/student/src/app/AppShell.tsx
import { Outlet } from "react-router-dom";
import AppHeader from "../widgets/AppHeader";

export default function AppShell() {
  return (
    <div className="min-h-dvh grid grid-rows-[auto_1fr] bg-slate-950 text-white">
      <AppHeader />
      <main className="overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
