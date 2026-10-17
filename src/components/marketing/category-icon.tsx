import type { LucideIcon } from "lucide-react";
import { Aperture, Armchair, Baby, Bed, Building2, Cake, Camera, Car, Castle, ChefHat, ClipboardList, Disc3, Flower2, Mic, Moon, Music, Package, Palette, PartyPopper, Scissors, Smile, Sparkles, Video, WandSparkles } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  moon: Moon,
  "party-popper": PartyPopper,
  "clipboard-list": ClipboardList,
  castle: Castle,
  "building-2": Building2,
  "chef-hat": ChefHat,
  cake: Cake,
  camera: Camera,
  video: Video,
  "disc-3": Disc3,
  music: Music,
  "wand-sparkles": WandSparkles,
  smile: Smile,
  mic: Mic,
  palette: Palette,
  "flower-2": Flower2,
  sparkles: Sparkles,
  scissors: Scissors,
  package: Package,
  armchair: Armchair,
  aperture: Aperture,
  car: Car,
  bed: Bed,
};

/** Category icons are stored as lucide names in the database; unknown names fall back to a sparkle. */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
