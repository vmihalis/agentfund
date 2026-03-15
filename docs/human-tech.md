# Human Passport Embed Documentation

> Docs: [docs.passport.xyz/building-with-passport/embed](https://docs.passport.xyz/building-with-passport/embed)
> Component Reference: [docs.passport.xyz/building-with-passport/embed/component-reference](https://docs.passport.xyz/building-with-passport/embed/component-reference)
> Developer Portal: [developer.passport.xyz](https://developer.passport.xyz)
> Embed Playground: [embed-playground.passport.xyz](https://embed-playground.passport.xyz)
> Live Demo: [passport-sample-embed-demo.vercel.app](https://passport-sample-embed-demo.vercel.app)

## Overview

Passport Embed is a React component for integrating Human Passport's Stamps-based identity verification directly in your app. It provides Sybil protection by gating content based on Unique Humanity Scores, without redirecting users elsewhere. Privacy-preserving: site owners receive only scores, not personal data.

## Getting Access

### Step 1: Create API Keys

1. Visit [developer.passport.xyz](https://developer.passport.xyz)
2. Authenticate by connecting a wallet
3. Navigate to "API Keys" section
4. Click "+ Create a Key" to generate keys
5. **You need TWO API keys**: one for the Embed component, one for Stamps API requests
6. Store credentials securely

### Step 2: Create a Scorer

1. From Developer Portal, navigate to "Scorer" section
2. Click "+ Create a Scorer"
3. Input: Scorer name, description, score threshold (20 recommended)
4. Retrieve your Scorer ID from the Scorers page

**Important**: Use a single Scorer for both the Embed and the Stamps API requests.

## Installation

### Prerequisites
- React application (v18+)
- Embed API key and Scorer ID from Developer Portal

### Install Package

```bash
npm install @human.tech/passport-embed@latest
# or
yarn add @human.tech/passport-embed@latest
```

## Basic Setup

```typescript
import { PassportScoreWidget, DarkTheme } from "@human.tech/passport-embed";

const EMBED_API_KEY = "<YOUR_EMBED_API_KEY>";
const SCORER_ID = "<YOUR_SCORER_ID>";

function MyPage() {
  const userAddress = "0x...";

  const signMessage = async (message: string): Promise<string> => {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });
    return await window.ethereum.request({
      method: "personal_sign",
      params: [message, accounts[0]]
    });
  };

  return (
    <PassportScoreWidget
      apiKey={EMBED_API_KEY}
      scorerId={SCORER_ID}
      address={userAddress}
      generateSignatureCallback={signMessage}
      theme={DarkTheme}
    />
  );
}
```

## Component API: PassportScoreWidget

### Props Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | `string` | Yes | Embed API key from Developer Portal |
| `scorerId` | `string \| number` | Yes | Scorer configuration ID |
| `address` | `string \| undefined` | No | User's wallet address. If not provided, component can prompt wallet connection |
| `connectWalletCallback` | `() => Promise<string>` | No | Callback to prompt user to connect wallet when address is undefined |
| `generateSignatureCallback` | `(message: string) => Promise<string>` | Yes | Callback to confirm user controls wallet. Takes message, returns signed message |
| `collapseMode` | `"shift" \| "overlay" \| "off"` | No | Controls collapsible behavior. `shift` (default, pushes content), `overlay` (on top), `off` (always expanded) |
| `theme` | `PassportWidgetTheme` | No | `DarkTheme` or `LightTheme` (defaults to DarkTheme) |
| `className` | `string` | No | Additional CSS class for container |

### Import

```typescript
import { PassportScoreWidget, DarkTheme, LightTheme } from "@human.tech/passport-embed";
```

## React Hook: usePassportScore

Fetches user's Passport score and verification status programmatically.

```typescript
import { usePassportScore } from "@human.tech/passport-embed";

function MyComponent() {
  const { score, isPassing, loading, error } = usePassportScore({
    apiKey: PASSPORT_API_KEY,
    scorerId: PASSPORT_SCORER_ID,
    address: userAddress
  });

  if (loading) return <p>Loading score...</p>;
  if (error) return <p>Error fetching score.</p>;

  return (
    <div>
      <p>Your Passport score: {score}</p>
      {isPassing ? (
        <p>You meet the threshold!</p>
      ) : (
        <p>You don't meet the required score yet.</p>
      )}
    </div>
  );
}
```

### Hook Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | `string` | Your Embed API key |
| `scorerId` | `string \| number` | Your Scorer ID |
| `address` | `string` | User's wallet address |

### Hook Return Values

| Return | Type | Description |
|--------|------|-------------|
| `score` | `number` | User's Passport score for the given scorer |
| `isPassing` | `boolean` | True if user's score meets threshold |
| `loading` | `boolean` | True while score is being fetched |
| `error` | `Error` | Any error occurring while fetching |

## Security Notes

**Frontend values can be spoofed.** Do NOT trust `usePassportScore` for sensitive program protection. Instead:
1. Use `isPassing` as a **signal** to trigger a backend verification request
2. Verify via the **Stamps API** server-side for protecting sensitive features

## Component Behavior

1. **Initial State**: Detects if address is provided; shows wallet connection prompt or immediately fetches score
2. **Loading**: Shows loading indicator while fetching; displays user-friendly error messages on failure
3. **Score Display**: Shows user's stamp-based Unique Humanity Score after retrieval
4. **Verification Flow**: Guides users to verify additional stamps if below threshold; auto-updates score
5. **Collapse/Expand**: With shift/overlay modes, starts minimized; expands on click

## Advanced Configuration

### Overlay Mode

```tsx
<PassportScoreWidget
  apiKey={API_KEY}
  scorerId={SCORER_ID}
  collapseMode="overlay"
  address={userAddress}
  generateSignatureCallback={signMessage}
  theme={DarkTheme}
/>
```

### With Wallet Connection Callback

```tsx
<PassportScoreWidget
  apiKey={API_KEY}
  scorerId={SCORER_ID}
  connectWalletCallback={async () => {
    // Connect wallet logic
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    return accounts[0];
  }}
  generateSignatureCallback={signMessage}
  theme={LightTheme}
/>
```

## Embed Playground

Use [embed-playground.passport.xyz](https://embed-playground.passport.xyz) to:
- Visually configure the widget
- Preview changes in real-time
- Generate ready-to-use code

## Current Limitations

- Currently supports Passport Stamps verification only
- Individual verification flows (zk KYC, zk Biometrics, zk Proof of Clean Hands) are in development
- On-chain minting of Passport is a future feature

## Developer Support

- Telegram: [t.me/+Mcp9RsRV7tVmYjZh](https://t.me/+Mcp9RsRV7tVmYjZh)
- Tutorial: "Protecting Sensitive Programs with Passport Embed"
