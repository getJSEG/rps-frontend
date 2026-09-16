import { redirect } from "next/navigation";

/** Old /login URLs land on the storefront, where sign-in lives in the navbar. */
export default function LoginRoutePage() {
  redirect("/");
}
