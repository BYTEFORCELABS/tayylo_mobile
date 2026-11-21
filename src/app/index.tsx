import * as React from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { bootstrapSession, useSession } from "@/lib/auth/session";
import { useBusiness } from "@/lib/use-business";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ErrorState } from "@/components/ui/states";
import { colors } from "@/theme/tokens";

/**
 * Entry route: sends people where the web's root + app shell would —
 * Welcome when signed out, Explore for customers, Onboarding for tailors
 * without a studio yet, otherwise Today.
 */
export default function Index() {
  const status = useSession(s => s.status);
  const role = useSession(s => s.me?.role);
  const { business, status: businessStatus, refresh } = useBusiness();

  if (status === "loading") return <BrandLoader label="Opening Tayylo" />;
  if (status === "error") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.canvas }}>
        <ErrorState title="Couldn't open your workspace" description="We couldn't reach Tayylo. Check your connection and try again." onRetry={() => bootstrapSession()} />
      </View>
    );
  }
  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (role === "customer") return <Redirect href="/discover" />;

  if (businessStatus === "loading") return <BrandLoader label="Opening your workspace" />;
  if (businessStatus === "error") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.canvas }}>
        <ErrorState title="Couldn't open your workspace" description="We couldn't reach Tayylo. Check your connection and try again." onRetry={() => refresh()} />
      </View>
    );
  }
  return <Redirect href={business ? "/today" : "/onboarding"} />;
}
