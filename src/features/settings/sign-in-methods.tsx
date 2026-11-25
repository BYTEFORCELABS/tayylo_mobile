// "Sign in with Apple" row for Settings (tailors) and Account (customers):
// connect Apple to the signed-in account, or disconnect it while another way
// to sign in remains. Port of tayylo/src/components/settings/sign-in-methods.tsx,
// using the native Apple sheet instead of the web redirect.

import * as React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { toast } from "@/components/ui/toast";
import { ApiRequestError, NetworkError } from "@/lib/api/http";
import { queryClient, toKey } from "@/lib/api/query";
import { signInMethodsRepo } from "@/lib/api/repos";
import { AppleSignInCancelled, isAppleSignInAvailable, linkApple, SignInError } from "@/lib/auth/session";

function AppleGlyph({ size = 18, color = "#000" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 37 59 127.6 107.2 126.1 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-83.5 102.6-120.6-65.2-30.7-61.7-90-61.7-91.4zM255.3 100.6c26.7-31.8 24.3-60.8 23.5-71.2-23.6 1.4-51 16.5-66.5 35-17.1 19.8-27.3 44.4-25.1 70.5 24.1 1.9 46-11.2 68.1-34.3z"
      />
    </Svg>
  );
}

const KEY = toKey("sign-in-methods");

export function SignInMethodsSection({ style }: { style?: StyleProp<ViewStyle> }) {
  const { data } = useQuery({ queryKey: KEY, queryFn: signInMethodsRepo.get, staleTime: 60_000 });
  const [available, setAvailable] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    isAppleSignInAvailable().then(ok => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  const apple = data?.identities.find(i => i.provider === "apple");
  if (!data || (!apple && !(available && data.available.appleNative))) return null;

  const connect = async () => {
    setBusy(true);
    try {
      await linkApple();
      await queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("Apple is connected. You can now sign in with Apple.");
    } catch (e) {
      if (!(e instanceof AppleSignInCancelled)) {
        toast.error(
          e instanceof ApiRequestError || e instanceof SignInError
            ? e.message
            : e instanceof NetworkError
              ? e.message
              : "Couldn't connect Apple. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await signInMethodsRepo.disconnect("apple");
      await queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("Apple disconnected");
    } catch (e) {
      toast.error(e instanceof ApiRequestError || e instanceof NetworkError ? e.message : "Couldn't disconnect Apple");
    } finally {
      setBusy(false);
    }
  };

  return (
    <List style={style}>
      <ListItem
        leading={<IconTile icon={AppleGlyph} />}
        title="Sign in with Apple"
        subtitle={apple ? (apple.isPrivateEmail ? "Connected · email hidden by Apple" : `Connected${apple.email ? ` · ${apple.email}` : ""}`) : "Not connected"}
        trailing={
          apple ? (
            <Button variant="ghost" size="sm" loading={busy} onPress={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button variant="secondary" size="sm" loading={busy} onPress={connect}>
              Connect
            </Button>
          )
        }
      />
    </List>
  );
}
