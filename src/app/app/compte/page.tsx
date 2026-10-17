import type { Metadata } from "next";
import { ProfileForm } from "@/components/identity/profile-form";
import { requireActor } from "@/lib/session";
import { getProfile } from "@/modules/identity/application/profile-service";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const actor = await requireActor("/app/compte");
  const profile = await getProfile(actor);
  return <ProfileForm profile={profile} />;
}
