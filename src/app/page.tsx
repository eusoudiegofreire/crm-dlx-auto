import { redirect } from "next/navigation";

// A raiz redireciona pro dashboard (middleware vai checar auth no PASSO 4)
export default function RootPage() {
  redirect("/dashboard");
}
