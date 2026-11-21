# Tayylo Mobile — architecture & porting guide

Tayylo Mobile is the native (Expo / React Native) form of the Tayylo web app
(`../tayylo`, Next.js). The **web app is the source of truth** for product,
design and behaviour; this app reproduces it screen for screen against the same
backend (`/api/*` routes of the web app). It is not a redesign.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 58, React Native 0.88 (New Architecture), React 19, TypeScript strict |
| Navigation | expo-router (`src/app`), Stack + custom floating tab bar |
| Server state | TanStack Query (`src/lib/api/query.ts`) — same keys/invalidations as the web cache |
| Client state | Zustand (session, shell, toasts) |
| Auth | Auth.js session cookie, captured into an encrypted cookie jar (expo-secure-store) |
| UI | Hand-built design system mirroring `tayylo/src/app/globals.css` (`src/theme`, `src/components/ui`) |
| Icons | lucide-react-native (stroke 1.75) + Tayylo garment / measurement artwork (react-native-svg) |
| Motion | react-native-reanimated 4, gesture-handler 3 (hook API: `usePanGesture`) |

## Layout

```
src/
  app/                 routes only (thin files that render feature screens)
    _layout.tsx        fonts, providers, splash, route guards (Stack.Protected)
    index.tsx          entry redirect (welcome / onboarding / today / discover)
    welcome.tsx  auth/index.tsx  auth/reset.tsx  onboarding.tsx
    (tailor)/          tailor workspace: business guard, Create sheet, offline banner
      (tabs)/          today · clients · orders · settings (+ centre Create button)
      clients/[id]/index.tsx, clients/[id]/edit.tsx
      orders/new.tsx, orders/[id]/index.tsx, orders/[id]/invoice.tsx, orders/[id]/receipt.tsx
      measure.tsx  explore.tsx  search.tsx
    (customer)/        discover (Explore) · account
  features/<module>/   screens and module-only components
  components/
    ui/                design-system primitives (see table below)
    brand/             Logo, GarmentIcon, MeasurementIcon/Figure, SuccessMark, BrandLoader, StitchLoader
    shell/             FloatingNav (tab bar), CreateSheet, useShell (openQuickAdd / openSearch)
    order-list-item.tsx, payment-dialog.tsx, client-picker.tsx, garment-picker.tsx, add-client-sheet.tsx
  lib/
    api/http.ts        fetch + cookie jar, ApiRequestError, NetworkError
    api/repos.ts       businessRepo, customerRepo, measurementRepo, templateRepo, orderRepo,
                       exploreRepo, meRepo, accountRepo, exportData, resetWorkspace, isDuplicatePhone
    api/query.ts       qk keys, useCustomers/useOrders/useTemplates/useCustomer/useMeasurements/
                       useOrdersByCustomer/useOrder/useMeasurementSet, prefetch*, invalidate, setQueryData
    auth/session.ts    useSession, signIn, register, signOut, requestPasswordReset, resetPassword
    use-business.ts    useBusiness() → { business, currency, unit, status, refresh }, useMe(), setCachedBusiness
    format.ts orders.ts measurements.ts notifications.ts explore.ts fabrics.ts   (ported 1:1 from web)
    garment-icons.ts measurement-art*.ts                                         (copied from web)
    images.ts          pickImage, chooseImageSource, compressPhoto, makeThumbnail, preparePhoto, prepareLogo
    static-images.ts   resolveImage(url) for every stored image URL, getGarmentImage
  theme/               tokens.ts (colours, radii, shadows), typography.ts (Urbanist scale)
  generated/           measurement SVGs (scripts/generate-assets.mjs)
```

## Web → mobile component map

| Web | Mobile |
| --- | --- |
| `<p>/<span>/<h1>` + text classes | `Text` (`variant`: display/title/headline/body/label/caption/overline, `weight`, `color`, `tabular`, `size`) — never RN `Text` directly |
| `Button` | `Button` (`variant`, `size`, `block`, `loading`, `icon`/`iconRight` = lucide component, `onPress`) |
| `Card`, `Panel`, `TapeRule` | same names in `ui/card` |
| `Input`, `Textarea`, `Select` | same names in `ui/input` (`onChangeText`; `Select` takes `options` and opens a picker sheet) |
| `Tag`, `StatusTag`, `DeltaChip` | same names in `ui/tag` |
| `Avatar` | `ui/avatar` |
| `List`, `ListItem`, `IconTile` | `ui/list` (`onPress` instead of `href`; `IconTile icon={LucideIcon}`) |
| `EmptyState`, `ErrorState`, `Skeleton`, `ListSkeleton`, `LoadingRegion`, `OfflineBanner` | `ui/states` (`EmptyState icon={LucideIcon}` or `art={node}`) |
| `SegmentedControl`, `Chip`, `SearchField` | `ui/choice` |
| `Tabs` | `ui/tabs` |
| `BottomSheet` | `ui/sheet` `BottomSheet` (`title`, `description`, `footer`) |
| `Dialog` + `DialogContent/Header/Title/Description/Footer` | `ui/sheet` `Dialog` (`title`, `description` props) + `DialogFooter` |
| `Keypad`, `MeasurementCell/Grid/Sheet/Display`, `Calendar` | same names |
| `PageHeader`, `PageBody`, `Section`, `Overline`, `BackButton`, `useBack` | `ui/page`: wrap a screen in `<Screen header={{ title, back, actions, variant }} tabBar?>`; `Section`, `Overline`, `BackButton`, `useBack` |
| `toast` (sonner) | `toast` from `ui/toast` — same signature |
| `window.confirm` | `Alert.alert` with a `destructive` button |
| `<Link href>` / `router.push` | `router.push("/orders/123")` from expo-router |
| `navigator.share` / WhatsApp link / clipboard | `Share.share`, `Linking.openURL("https://wa.me/…")`, `expo-clipboard` |
| file input / camera | `chooseImageSource` + `pickImage` + `compressPhoto`/`makeThumbnail` (`lib/images`) |

Hover becomes press; `onMouseEnter` prefetch becomes `onPressIn`. Desktop-only
(`lg:`) layouts are dropped; the **phone layout of the web app is the reference**.

## Rules

- Colours, radii and shadows only from `src/theme/tokens.ts` (all copied from the web CSS).
- Same copy, same validation, same business rules, same API payloads as the web.
- Every stored image URL is rendered through `resolveImage()`.
- Writes go through the repos, which invalidate exactly the cache keys the web invalidates.
- No WebViews, no mock data.
