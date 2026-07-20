import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { readAppState } from "@/lib/store";
import { AdminWorkbench } from "@/components/admin-workbench";
import { Card, Pill, SectionHeading } from "@/components/ui";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const state = await readAppState();

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill>Espace propriétaire</Pill>
            </div>
            <SectionHeading
              eyebrow="Votre univers"
              title="Façonnez Emberdex à votre image"
              description="Choisissez vos couleurs, faites évoluer vos règles et gardez une copie de tout ce qui compte."
            />
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            Connecté en tant que <span className="text-[color:var(--text)]">{session.ownerName}</span>
          </p>
        </div>
      </Card>

      <AdminWorkbench state={state} />
    </div>
  );
}
