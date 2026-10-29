import { redirect } from "next/navigation";

export default function JobsIndexPage() {
  redirect("/jobs/new");
}
