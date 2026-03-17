import Link from "next/link";
import { CopsLogo } from "~~/components/ui/CopsLogo";

const features = [
  { label: "Ethereum Secured", icon: "shield" },
  { label: "FHE Encryption", icon: "lock" },
  { label: "USDC Stablecoin", icon: "dollar" },
] as const;

function FeatureBadge({ label, icon }: { label: string; icon: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-base-300/50
                 bg-base-200/60 px-4 py-2 text-xs font-medium text-base-content/70"
    >
      <FeatureIcon icon={icon} />
      {label}
    </span>
  );
}

function FeatureIcon({ icon }: { icon: string }) {
  const cls = "h-4 w-4 text-primary";
  switch (icon) {
    case "shield":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cls}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "lock":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cls}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "dollar":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cls}
          aria-hidden="true"
        >
          <path d="M10.75 6.5a.75.75 0 00-1.5 0v.25a2.5 2.5 0 000 4.5v2.1a1.002 1.002 0 01-.596-.367.75.75 0 10-1.208.89A2.501 2.501 0 009.25 15.25v.25a.75.75 0 001.5 0v-.25a2.5 2.5 0 000-4.5V8.6c.263.047.5.178.696.367a.75.75 0 101.208-.89A2.501 2.501 0 0010.75 6.75V6.5zM9.25 8.6v1.15a1 1 0 010-1.15zm1.5 4.65v-1.15a1 1 0 010 1.15z" />
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-1.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function Home() {
  return (
    <div className="hero-glow relative flex min-h-[80vh] flex-col items-center justify-center gap-12 px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <CopsLogo className="h-16 sm:h-20" />
        <p className="text-xl font-medium text-base-content/80 sm:text-2xl">Confidential Onchain Payroll System</p>
        <p className="max-w-lg text-base-content/50">
          Pay employees in encrypted USDC. Salary amounts, balances, and transfers stay private on-chain using fully
          homomorphic encryption.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {features.map(f => (
          <FeatureBadge key={f.label} label={f.label} icon={f.icon} />
        ))}
      </div>

      <div className="flex gap-4">
        <Link href="/employer" className="btn btn-primary rounded-full px-8">
          Employer Dashboard
        </Link>
        <Link href="/employee" className="btn btn-outline rounded-full px-8">
          Employee Portal
        </Link>
      </div>

      <p className="text-xs text-base-content/30">
        Live on Sepolia &middot; Powered by{" "}
        <a
          href="https://bootnode.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-base-content/50"
        >
          BootNode
        </a>
      </p>
    </div>
  );
}
