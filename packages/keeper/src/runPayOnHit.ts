import { loadSecrets } from "./ring";
import { startPayOnHit } from "./payOnHit";

startPayOnHit(loadSecrets());
