import { Link } from "react-router-dom";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-fade-up">
      <div className="inline-flex p-5 rounded-3xl bg-destructive/10 border border-destructive/20 mb-6 shadow-xl shadow-destructive/10">
        <ShieldOff className="w-12 h-12 text-destructive" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Access Denied</h1>
      <p className="text-muted-foreground max-w-sm mb-8">
        You don't have permission to view this page. Contact your Super Admin to request access.
      </p>
      <Button asChild variant="outline" className="rounded-xl gap-2">
        <Link to="/dashboard">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  );
}
