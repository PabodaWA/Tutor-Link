import { Redirect } from "expo-router";

import { useAuth } from "@/context/auth-context";
import { TutorDiscovery } from "@/features/lasiru/tutor-discovery";

export default function DiscoverRoute() {
  const { user } = useAuth();
  if (user?.role === "tutor") return <Redirect href="/tutor-requests" />;
  return <TutorDiscovery />;
}
