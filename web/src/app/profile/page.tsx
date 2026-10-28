import { redirect } from "next/navigation";

export default function ProfilePage() {
  redirect("/resume-studio?tab=content");
}
