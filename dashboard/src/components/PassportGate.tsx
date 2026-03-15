'use client';

import { useEffect, useState } from 'react';
import { shouldAllowSubmission } from '@/lib/passport-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import types
let PassportScoreWidgetRef: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DarkThemeRef: any = undefined;

interface PassportGateProps {
  children: React.ReactNode;
  onVerified?: (score: number) => void;
}

/**
 * Sybil resistance gate using Human Passport.
 *
 * When Passport API keys are configured (NEXT_PUBLIC_PASSPORT_API_KEY,
 * NEXT_PUBLIC_PASSPORT_SCORER_ID), renders the Passport verification widget.
 * Users must achieve a humanity score >= 20 to access children.
 *
 * When keys are NOT configured, falls back to a demo mode with a
 * "Simulate Verification" button so the hackathon demo still works.
 */
export function PassportGate({ children, onVerified }: PassportGateProps) {
  const apiKey = process.env.NEXT_PUBLIC_PASSPORT_API_KEY ?? '';
  const scorerId = process.env.NEXT_PUBLIC_PASSPORT_SCORER_ID ?? '';

  const demoMode = !apiKey || !scorerId;

  const [verified, setVerified] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Dynamically import the Passport widget in production mode
  useEffect(() => {
    if (!demoMode && !widgetLoaded) {
      import('@human.tech/passport-embed').then((mod) => {
        PassportScoreWidgetRef = mod.PassportScoreWidget;
        DarkThemeRef = mod.DarkTheme;
        setWidgetLoaded(true);
      });
    }
  }, [demoMode, widgetLoaded]);

  // Handle demo mode simulation
  const handleSimulate = () => {
    const simulatedScore = 25;
    setScore(simulatedScore);
    setVerified(shouldAllowSubmission(simulatedScore, true, true));
    onVerified?.(simulatedScore);
  };

  // Demo mode fallback
  if (demoMode) {
    if (verified && score !== null && score >= 20) {
      return (
        <div>
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm font-medium">
                Demo Mode
              </span>
              <span className="text-gray-400 text-sm">
                Passport API keys not configured -- demo mode active
              </span>
            </div>
            <p className="mt-1 text-sm text-green-400">
              Humanity verified (score: {score})
            </p>
          </div>
          {children}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-amber-500/30 bg-gray-900 p-6">
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-amber-400 text-sm font-medium">
            Passport API keys not configured -- demo mode active
          </p>
          <p className="mt-1 text-gray-400 text-xs">
            Set NEXT_PUBLIC_PASSPORT_API_KEY and NEXT_PUBLIC_PASSPORT_SCORER_ID to enable real verification.
          </p>
        </div>

        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-gray-200">
            Humanity Verification Required
          </h3>
          <p className="mb-6 text-sm text-gray-400">
            Verify your humanity to submit proposals. Minimum score: 20.
          </p>
          <button
            onClick={handleSimulate}
            className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
          >
            Simulate Verification
          </button>
        </div>
      </div>
    );
  }

  // Production mode with real Passport widget
  if (verified && score !== null && score >= 20) {
    return (
      <div>
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <p className="text-sm text-green-400">
            Humanity verified (score: {score})
          </p>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold text-gray-200">
          Humanity Verification Required
        </h3>
        <p className="mb-6 text-sm text-gray-400">
          Verify your humanity to submit proposals. Minimum score: 20.
        </p>
      </div>

      {widgetLoaded && PassportScoreWidgetRef ? (
        <div className="flex justify-center">
          <PassportScoreWidgetRef
            apiKey={apiKey}
            scorerId={scorerId}
            address=""
            generateSignatureCallback={async (_message: string) => {
              // Stub for hackathon -- production would connect to user's browser wallet
              // via window.ethereum or a wallet adapter to sign the message.
              return '';
            }}
            theme={DarkThemeRef}
            collapseMode="off"
          />
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="h-20 w-64 animate-pulse rounded-lg bg-gray-800" />
        </div>
      )}
    </div>
  );
}
