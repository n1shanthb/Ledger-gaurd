import { redirect } from "next/navigation";

/** Compatibility alias — canonical hub is /protect */
export default function ConsoleAliasPage() {
  redirect("/protect");
}
