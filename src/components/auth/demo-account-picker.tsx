import { demoSignInAction } from "@/app/(auth)/connexion/actions";
import { DEMO_ACCOUNTS, DEMO_GROUP_LABELS, type DemoAccountGroup } from "@/modules/identity/domain/demo-accounts";
import { DemoSubmit } from "./demo-submit";

const GROUPS: DemoAccountGroup[] = ["organizer", "professional", "staff"];

/**
 * Demo mode only (the caller checks `isDemo`): one button per seeded account, grouped by role.
 * A single form with one submit button per account; the clicked button carries the account key.
 */
export function DemoAccountPicker({ next }: { next?: string }) {
  return (
    <section aria-labelledby="demo-accounts-h" className="rounded-xl border bg-muted/40 p-4">
      <h2 id="demo-accounts-h" className="font-heading text-base font-semibold">
        Se connecter avec un compte de démonstration
      </h2>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">Un clic suffit, sans identifiant ni mot de passe. Les comptes et leurs données sont fictifs.</p>
      <form action={demoSignInAction} className="mt-4 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        {GROUPS.map((group) => (
          <fieldset key={group}>
            <legend className="text-sm font-medium">{DEMO_GROUP_LABELS[group]}</legend>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.filter((a) => a.group === group).map((a) => (
                <li key={a.key}>
                  <DemoSubmit value={a.key} name={a.name} role={a.role} />
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </form>
    </section>
  );
}
