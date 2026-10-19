import type { ComponentType } from "react";
import type { TemplateProps } from "./_shared";
import Argentique from "./argentique";
import AtelierCreatif from "./atelier-creatif";
import BohemeLin from "./boheme-lin";
import CarnetVoyage from "./carnet-voyage";
import ChampetrePierre from "./champetre-pierre";
import Confettis from "./confettis";
import CorporateNet from "./corporate-net";
import EditorialLuxe from "./editorial-luxe";
import GalerieNoire from "./galerie-noire";
import JardinFleuri from "./jardin-fleuri";
import LumiereStudio from "./lumiere-studio";
import MinimalIvoire from "./minimal-ivoire";
import ModerneGrille from "./moderne-grille";
import NatureForet from "./nature-foret";
import NidDouillet from "./nid-douillet";
import NuitElectrique from "./nuit-electrique";
import PanoramaPhoto from "./panorama-photo";
import PoudreRose from "./poudre-rose";
import RondeEnfantine from "./ronde-enfantine";
import SaugeElegante from "./sauge-elegante";
import SceneOuverte from "./scene-ouverte";
import TableGourmande from "./table-gourmande";
import TerrasseAzur from "./terrasse-azur";
import VeloursSpectacle from "./velours-spectacle";

/** One component per registry key. Unknown keys fall back to minimal-ivoire in the renderer. */
export const TEMPLATE_COMPONENTS: Record<string, ComponentType<TemplateProps>> = {
  "nid-douillet": NidDouillet,
  "ronde-enfantine": RondeEnfantine,
  "sauge-elegante": SaugeElegante,
  "minimal-ivoire": MinimalIvoire,
  confettis: Confettis,
  "atelier-creatif": AtelierCreatif,
  "editorial-luxe": EditorialLuxe,
  "boheme-lin": BohemeLin,
  "champetre-pierre": ChampetrePierre,
  "panorama-photo": PanoramaPhoto,
  "corporate-net": CorporateNet,
  "moderne-grille": ModerneGrille,
  "table-gourmande": TableGourmande,
  "poudre-rose": PoudreRose,
  "galerie-noire": GalerieNoire,
  argentique: Argentique,
  "nuit-electrique": NuitElectrique,
  "scene-ouverte": SceneOuverte,
  "velours-spectacle": VeloursSpectacle,
  "jardin-fleuri": JardinFleuri,
  "nature-foret": NatureForet,
  "lumiere-studio": LumiereStudio,
  "terrasse-azur": TerrasseAzur,
  "carnet-voyage": CarnetVoyage,
};
