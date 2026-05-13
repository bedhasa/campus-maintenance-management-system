import { redirect } from "next/navigation";

export default function Home() {
  // This will immediately move the user to the login page
  redirect("/login");

  // This part will no longer be visible to the user
  return null;
}